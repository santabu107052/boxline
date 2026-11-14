/**
 * render.js — Canvas 2D cho bàn cờ. Nguồn: docs/20-DESIGN.md §6, §7.
 *
 * Nguyên tắc:
 *  - DPR cap 2x, `ctx.setTransform(dpr,0,0,dpr,0,0)` → mọi toạ độ là CSS px.
 *  - Màu ĐỌC TỪ CSS var qua getComputedStyle (không hardcode hex), nghe 'themechange'.
 *  - Thứ tự vẽ 10 lớp đúng §6.4.
 *  - Chỉ chạy requestAnimationFrame KHI CÓ animation; bàn tĩnh thì không vẽ lặp.
 *  - prefers-reduced-motion: tắt E1–E5 (hiện ngay), E8 crossfade do CSS lo.
 *
 * API: createRenderer(canvas, deps) → { resize(), draw(state, uiState), animateMove(...),
 *      setThemeColors(), destroy(), geometry() }
 */
import { CANVAS, MOTION } from './config.js';
import { boxMissing, edgeKey, isInteriorEdge } from './engine.js';

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
const easeOutBack = (t, c1 = 1.4) => {
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** Đường bo góc thủ công cho Safari < 16.4 (khi ctx.roundRect không có). */
function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, rad);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{onFrame?:Function, reducedMotion?:boolean}} deps
 */
export function createRenderer(canvas, deps = {}) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const wrapper = canvas.parentElement || canvas;
  let dpr = 1;
  let cssW = 0;
  let cssH = 0;
  let pad = CANVAS.PAD_MOBILE;
  let step = 0;
  let originX = 0;
  let originY = 0;
  let boardPx = 0;
  let colors = null;
  let rafId = 0;
  let anims = [];
  let lastState = null;
  let lastUi = null;
  let lastN = 0;
  let destroyed = false;
  let reduced = !!deps.reducedMotion;
  let motionQuery = null;
  let resizeObserver = null;
  let resizeTimer = 0;
  let themeBound = false;

  /* -------------------------------------------------------- màu CSS var */

  function readColors() {
    const root = document.documentElement;
    if (!root || typeof getComputedStyle !== 'function') return null;
    const cs = getComputedStyle(root);
    const v = (name) => (cs.getPropertyValue(name) || '').trim();
    return {
      surface1: v('--surface-1'),
      borderStrong: v('--border-strong'),
      gridLine: v('--grid-line'),
      dot: v('--grid-dot'),
      players: { A: v('--player-a'), B: v('--player-b') },
      playersHover: { A: v('--player-a-hover'), B: v('--player-b-hover') },
      boxFill: { A: v('--box-a-bg'), B: v('--box-b-bg') },
      boxStroke: { A: v('--box-a-border'), B: v('--box-b-border') },
      pattern: { A: v('--player-a-pattern'), B: v('--player-b-pattern') },
      focus: v('--focus-ring'),
      focusGap: v('--focus-ring-gap'),
      accent: v('--accent'),
      danger: v('--danger'),
    };
  }

  function setThemeColors() {
    colors = readColors();
  }

  /* -------------------------------------------------------- kích thước */

  function measure() {
    const rect = wrapper.getBoundingClientRect ? wrapper.getBoundingClientRect() : null;
    const w = Math.max(0, Math.round((rect ? rect.width : wrapper.clientWidth) || 0));
    const h = Math.max(0, Math.round((rect ? rect.height : wrapper.clientHeight) || 0));
    return { w, h };
  }

  function resize(force = false) {
    const { w, h } = measure();
    if (w <= 0 || h <= 0) return;
    // Bỏ qua nếu kích thước không đổi VÀ không bị ép (tránh gán lại width mỗi frame).
    if (!force && Math.min(w, h) === cssW && step > 0 && lastState && lastState.n === lastN) return;
    cssW = w;
    cssH = h;
    dpr = Math.min(globalThis.devicePixelRatio || 1, CANVAS.DPR_CAP);
    pad = cssW < 480 ? CANVAS.PAD_MOBILE : CANVAS.PAD_DESKTOP;
    const n = lastState ? lastState.n : (lastN || 5);
    lastN = n;
    // Canvas LUÔN vuông (cạnh = min(khung) − 2*PAD): bàn nằm chính giữa, không lệch trên/dưới.
    const side = Math.max(0, Math.min(cssW, cssH));
    canvas.style.width = `${side}px`;
    canvas.style.height = `${side}px`;
    canvas.width = Math.round(side * dpr);
    canvas.height = Math.round(side * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    cssW = side;
    cssH = side;
    boardPx = Math.max(0, side - 2 * pad);
    step = boardPx / n;
    originX = (cssW - boardPx) / 2;
    originY = (cssH - boardPx) / 2;
    if (lastState) paint(performance.now());
  }

  function geometry() {
    return { dpr, cssW, cssH, pad, step, originX, originY, boardPx };
  }

  /** Toạ độ tâm dot (i=col, j=row). */
  function dot(i, j) {
    return { x: originX + i * step, y: originY + j * step };
  }

  function edgePoints(edge) {
    const [r, c, o] = edge;
    if (o === 'H') {
      const a = dot(c, r);
      return { x1: a.x, y1: a.y, x2: a.x + step, y2: a.y };
    }
    const a = dot(c, r);
    return { x1: a.x, y1: a.y, x2: a.x, y2: a.y + step };
  }

  /** Ô → hình chữ nhật trong bàn. */
  function boxRect(br, bc) {
    const a = dot(bc, br);
    return { x: a.x, y: a.y, w: step, h: step };
  }

  /* ------------------------------------------------------- hiệu ứng */

  function pushAnim(anim) {
    anims.push(anim);
    startLoop();
  }

  /**
   * Vòng rAF DUY NHẤT của renderer — chỉ chạy khi còn animation.
   *
   * - Tab ẩn (`document.hidden`): KHÔNG xếp thêm khung và KHÔNG vẽ (tiết kiệm pin, §7.3).
   *   Khi tab hiện lại, `visibilitychange` vẽ nốt trạng thái cuối / tiếp tục animation.
   * - `deps.onInputTick` (nếu có): gọi mỗi khung để main.js xả input đang chờ sớm hơn
   *   thay vì chờ hết animation (input không bị khoá — §6.6).
   */
  function startLoop() {
    if (rafId || destroyed) return;
    if (typeof document !== 'undefined' && document.hidden) {
      // Tab ẩn: vẽ ngay trạng thái cuối (không animate) rồi dừng; không giữ rAF.
      anims = [];
      if (lastState) paint(performance.now());
      return;
    }
    const frame = () => {
      rafId = 0;
      const now = performance.now();
      anims = anims.filter((a) => now - a.t0 < a.dur);
      if (lastState) paint(now);
      if (typeof deps.onInputTick === 'function') {
        try { deps.onInputTick(); } catch { /* input không bao giờ làm chết vòng vẽ */ }
      }
      if (anims.length) rafId = requestAnimationFrame(frame);
      else if (typeof deps.onFrame === 'function') deps.onFrame(0);
    };
    rafId = requestAnimationFrame(frame);
  }

  /**
   * Chạy hiệu ứng cho một nước đi vừa tô.
   * @param {{edge:Array, player:'A'|'B', closed:Array<[number,number]>, combo?:number}} move
   */
  let idleTimer = 0;

  function animateMove(move) {
    if (!move || !move.edge) return;
    // Reduced-motion: bỏ hiệu ứng chuyển động nhưng VẪN đánh dấu nước vừa đi (vẽ tĩnh) để người
    // chơi tiếp theo nhận ra đối thủ vừa đi đâu — đây là thông tin, không phải trang trí.
    if (reduced) {
      pushAnim({ kind: 'edge', t0: performance.now(), dur: MOTION.E1_EDGE_MS, edge: move.edge, player: move.player });
      return;
    }
    const t0 = performance.now();
    // E1 — cạnh vẽ ra 160ms; E2 — ô đóng 260ms (trễ dần theo E5: k*90ms, cap 480ms)
    pushAnim({ kind: 'edge', t0, dur: MOTION.E1_EDGE_MS, edge: move.edge, player: move.player });
    const closed = move.closed || [];
    closed.forEach(([br, bc], k) => {
      const delay = Math.min(MOTION.E5_STAGGER_CAP_MS, k * MOTION.E5_STAGGER_MS);
      pushAnim({ kind: 'box', t0: t0 + delay, dur: MOTION.E2_BOX_MS, br, bc, player: move.player, k });
      // E3 — pop 180ms ngay sau E2
      pushAnim({
        kind: 'pop', t0: t0 + delay + MOTION.E2_BOX_MS, dur: MOTION.E3_POP_MS,
        br, bc, player: move.player, k,
      });
    });
  }

  /* ------------------------------------------------------------- vẽ */

  function requestDraw(immediate = false) {
    if (immediate) {
      paint(performance.now());
      return;
    }
    startLoop();
    if (!rafId && lastState) startLoop();
  }

  function edgeWidthFor(n) {
    return n <= 5 ? CANVAS.EDGE_W_SMALL : CANVAS.EDGE_W_BIG;
  }
  function dotRadiusFor(n) {
    return n <= 5 ? CANVAS.DOT_R_SMALL : CANVAS.DOT_R_BIG;
  }
  function boxRadiusFor() {
    return cssW <= 400 ? CANVAS.BOX_RADIUS_NARROW : CANVAS.BOX_RADIUS;
  }

  function animOf(kind, pred) {
    for (const a of anims) if (a.kind === kind && pred(a)) return a;
    return null;
  }

  function paint(now) {
    if (!lastState || !colors || step <= 0) return;
    const state = lastState;
    const ui = lastUi || {};
    const n = state.n;
    const ew = edgeWidthFor(n);
    const dotR = dotRadiusFor(n);
    const radius = boxRadiusFor();

    // 1) Xoá sạch theo kích thước CSS px.
    ctx.clearRect(0, 0, cssW, cssH);

    // 3) Viền ngoài đã tô sẵn — vẽ TRƯỚC mọi thứ.
    ctx.save();
    ctx.strokeStyle = colors.borderStrong;
    ctx.lineWidth = CANVAS.BORDER_W;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.rect(originX, originY, boardPx, boardPx);
    ctx.stroke();
    ctx.restore();

    // 4) Ô đã tô (fill tint + viền bo góc + hoa tiết + nhãn).
    for (let br = 0; br < n; br++) {
      for (let bc = 0; bc < n; bc++) {
        const owner = state.boxes[br * n + bc];
        if (!owner) continue;
        const anim = animOf('box', (a) => a.br === br && a.bc === bc);
        let scale = 1;
        let alpha = 1;
        let strokeProgress = 1;
        let patternAlpha = 1;
        if (anim) {
          const t = Math.max(0, Math.min(1, (now - anim.t0) / anim.dur));
          scale = 0.92 + 0.08 * easeOutBack(t);
          alpha = easeOutQuad(t);
          strokeProgress = t;
          patternAlpha = Math.max(0, Math.min(1, (t - 0.38) / 0.62));
        }
        const pop = animOf('pop', (a) => a.br === br && a.bc === bc);
        if (pop) {
          const t = Math.max(0, Math.min(1, (now - pop.t0) / pop.dur));
          const peak = 1.04 + Math.min(0.06, 0.02 * Math.max(0, (pop.k || 0)));
          // 1.0 → peak → 1.0
          scale *= t < 0.5 ? 1 + (peak - 1) * (t / 0.5) : peak - (peak - 1) * ((t - 0.5) / 0.5);
        }
        drawBox(br, bc, owner, { scale, alpha, strokeProgress, patternAlpha, radius, ui, state, dotR });
      }
    }

    // 5) Preview ô sẽ bị đóng (alpha thấp) — vẽ trước cạnh.
    if (ui.previewEdge && ui.previewBoxes && !reduced) {
      for (const [br, bc] of ui.previewBoxes) {
        drawPreviewBox(br, bc, ui.previewPlayer || state.turn);
      }
    }

    // 6) Cạnh đã vẽ của cả 2 người.
    ctx.save();
    ctx.lineCap = 'round';
    for (const [key, owner] of state.edges) {
      const [o, rc] = [key[0], key.slice(1)];
      const [r, c] = rc.split(',').map(Number);
      const edge = [r, c, o];
      let progress = 1;
      let alpha = 1;
      const a = animOf('edge', (x) => edgeKey(x.edge) === key);
      if (a) {
        const t = Math.max(0, Math.min(1, (now - a.t0) / a.dur));
        progress = easeOutCubic(t);
        alpha = Math.max(0, Math.min(1, t / 0.375)); // alpha 0→1 trong 60ms đầu
      }
      drawEdgeStroke(edge, owner, ew, progress, alpha, false);
    }
    ctx.restore();

    // 7) Preview cạnh hover.
    if (ui.previewEdge && !reduced) {
      const player = ui.previewPlayer || state.turn;
      ctx.save();
      ctx.globalAlpha = CANVAS.PREVIEW_ALPHA;
      ctx.lineCap = 'round';
      drawEdgeStroke(ui.previewEdge, player, CANVAS.PREVIEW_W, 1, 1, true);
      ctx.restore();
    }

    // 8) Dot (dot active của nước vừa đi có scale).
    ctx.save();
    const activeKeys = new Set();
    const activeOwner = new Map(); // "c,r" -> 'A'|'B'
    for (const a of anims) {
      if (a.kind !== 'edge') continue;
      const [r, c, o] = a.edge;
      const ends = o === 'H' ? [`${c},${r}`, `${c + 1},${r}`] : [`${c},${r}`, `${c},${r + 1}`];
      for (const k of ends) {
        activeKeys.add(k);
        activeOwner.set(k, a.player);
      }
    }
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const p = dot(i, j);
        const isActive = activeKeys.has(`${i},${j}`);
        let rr = isActive ? CANVAS.DOT_R_ACTIVE : dotR;
        if (isActive) {
          const a = animOf('edge', (x) => {
            const [er, ec, eo] = x.edge;
            const ends = eo === 'H' ? [`${ec},${er}`, `${ec + 1},${er}`] : [`${ec},${er}`, `${ec},${er + 1}`];
            return ends.includes(`${i},${j}`);
          });
          if (a) {
            const t = Math.max(0, Math.min(1, (now - a.t0) / a.dur));
            // 1 → 1.35 → 1.0
            rr *= t < 0.5 ? 1 + 0.35 * (t / 0.5) : 1.35 - 0.35 * ((t - 0.5) / 0.5);
          }
        }
        ctx.beginPath();
        // Dot active mang MÀU của người vừa vẽ cạnh đó (không phải người đang tới lượt).
        const owner = isActive ? (activeOwner.get(`${i},${j}`) || lastMovePlayer()) : null;
        ctx.fillStyle = owner ? (colors.players[owner] || colors.dot) : colors.dot;
        ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // 9) VFX "NƯỚC VỪA ĐI" — LUÔN vẽ, tồn tại suốt lượt (không phải hiệu ứng 320ms như trước),
    //    để người chơi tiếp theo dễ theo dõi quân vừa được đánh dấu ở đâu:
    //      • quầng sáng màu người vừa đi bao quanh cạnh (halo),
    //      • cạnh tô đậm hơn + lõi sáng,
    //      • 2 đầu cạnh có "mắt xuyến" nhấp nháy chậm theo thời gian,
    //      • mũi tên nhỏ chạy dọc cạnh theo hướng người ta vẽ (chỉ một chiều, giúp mắt bám).
    //    Reduced-motion: chỉ giữ quầng sáng tĩnh + cạnh đậm (không nhấp nháy, không mũi tên chạy).
    if (ui.lastMoveEdge) {
      const owner = ui.lastMoveEdgePlayer || state.turn;
      const col = colors.players[owner] || colors.accent;
      const pts = edgePoints(ui.lastMoveEdge);
      const len = step;
      ctx.save();
      ctx.lineCap = 'round';
      // 9a) Quầng sáng ngoài — RẤT nhẹ để không bị đọc thành "ô đã tô" hay "preview cạnh".
      // (bản đầu 0.22 + rộng 0.34*step trông như một thanh đậm, che mất dáng mảnh của cạnh.)
      ctx.globalAlpha = 0.13;
      ctx.strokeStyle = col;
      ctx.lineWidth = ew + step * 0.2;
      ctx.beginPath();
      ctx.moveTo(pts.x1, pts.y1);
      ctx.lineTo(pts.x2, pts.y2);
      ctx.stroke();
      // 9b) Lõi sáng (mảnh, đậm) — vẫn thấy rõ trên cả nền sáng và tối.
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(1.4, ew * 0.48);
      ctx.beginPath();
      ctx.moveTo(pts.x1, pts.y1);
      ctx.lineTo(pts.x2, pts.y2);
      ctx.stroke();
      // 9c) Hai đầu cạnh: vòng tròn viền + lõi đặc.
      const endPulse = reduced ? 1 : 1 + 0.12 * Math.sin(now / 320);
      for (const [px, py] of [[pts.x1, pts.y1], [pts.x2, pts.y2]]) {
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(4, step * 0.115) * endPulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(3, step * 0.07) * endPulse, 0, Math.PI * 2);
        ctx.fill();
      }
      // 9e) Nhịp "thở" nhẹ cho vòng đầu cạnh / mũi tên chạy: vẽ lại mỗi ~90ms khi bàn TĨNH.
    // Bàn tĩnh thì vòng rAF tự dừng (không tốn pin); chỉ hẹn một nhịp để hiệu ứng tiếp tục sống.
    if (!reduced && !rafId) {
      if (typeof idleTimer === 'number') globalThis.clearTimeout(idleTimer);
      idleTimer = globalThis.setTimeout(() => {
        idleTimer = 0;
        if (!destroyed && rafId === 0 && lastState) paint(performance.now());
      }, 90);
    }

    // 9d) Mũi tên nhỏ chạy dọc cạnh (bỏ khi reduced-motion).
      if (!reduced) {
        const cycle = 1100;
        const k = ((now % cycle) / cycle);
        const dx = (pts.x2 - pts.x1) / len;
        const dy = (pts.y2 - pts.y1) / len;
        const travel = 0.28 + 0.44 * k;                 // chạy trong 28%–72% chiều dài cạnh
        const cx = pts.x1 + (pts.x2 - pts.x1) * travel;
        const cy = pts.y1 + (pts.y2 - pts.y1) * travel;
        const a = Math.max(0, Math.min(1, Math.sin(k * Math.PI)));  // mờ hai đầu, rõ ở giữa
        const size = Math.max(3.2, step * 0.075);
        ctx.globalAlpha = 0.85 * a;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx + dx * size, cy + dy * size);
        ctx.lineTo(cx - dx * size * 0.6 - dy * size * 0.75, cy - dy * size * 0.6 + dx * size * 0.75);
        ctx.lineTo(cx - dx * size * 0.6 + dy * size * 0.75, cy - dy * size * 0.6 - dx * size * 0.75);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 10) Focus ring bàn phím (chỉ vẽ khi điều hướng bằng phím).
    if (ui.focusEdge && ui.keyboardActive) {
      const pts = edgePoints(ui.focusEdge);
      const off = CANVAS.FOCUS_RING_OFFSET;
      ctx.save();
      ctx.strokeStyle = colors.focus;
      ctx.lineWidth = CANVAS.FOCUS_RING_W;
      if ('setLineDash' in ctx) ctx.setLineDash([]);
      ctx.beginPath();
      // Halo ngoài để nổi trên mọi nền.
      ctx.strokeStyle = colors.focusGap;
      ctx.lineWidth = CANVAS.FOCUS_RING_W + 2 * off + 2;
      ctx.moveTo(pts.x1, pts.y1);
      ctx.lineTo(pts.x2, pts.y2);
      ctx.stroke();
      ctx.strokeStyle = colors.focus;
      ctx.lineWidth = CANVAS.FOCUS_RING_W;
      ctx.beginPath();
      ctx.moveTo(pts.x1, pts.y1);
      ctx.lineTo(pts.x2, pts.y2);
      ctx.stroke();
      ctx.restore();
    }

    // Vòng cảnh báo ô ở tutorial bước 4 (nếu có).
    if (ui.warnBox) {
      const [br, bc] = ui.warnBox;
      const r = boxRect(br, bc);
      ctx.save();
      ctx.strokeStyle = ui.warnFlash ? colors.danger : colors.players.B;
      ctx.globalAlpha = ui.warnFlash ? 0.95 : 0.85;
      ctx.lineWidth = ui.warnFlash ? 3 : 2;
      ctx.setLineDash && ctx.setLineDash(ui.warnFlash ? [] : [5, 4]);
      roundRectPath(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 6, radius);
      ctx.stroke();
      ctx.setLineDash && ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function lastMovePlayer() {
    if (lastUi && lastUi.lastMovePlayer) return lastUi.lastMovePlayer;
    return lastState ? lastState.turn : 'A';
  }

  function drawEdgeStroke(edge, owner, width, progress, alpha, preview) {
    const pts = edgePoints(edge);
    const x2 = pts.x1 + (pts.x2 - pts.x1) * progress;
    const y2 = pts.y1 + (pts.y2 - pts.y1) * progress;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = preview ? colors.accent : colors.players[owner];
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pts.x1, pts.y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBox(br, bc, owner, opts) {
    const { scale, alpha, strokeProgress, patternAlpha, radius, ui, state } = opts;
    const r = boxRect(br, bc);
    const inset = step * CANVAS.BOX_INSET_RATIO;
    const w = (r.w - 2 * inset) * scale;
    const h = (r.h - 2 * inset) * scale;
    const x = r.x + inset + (r.w - 2 * inset - w) / 2;
    const y = r.y + inset + (r.h - 2 * inset - h) / 2;
    const pat = ui.colorblindSafe !== false;

    ctx.save();
    ctx.globalAlpha = alpha;
    // Nền tint
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = colors.boxFill[owner];
    ctx.fill();

    // Hoa tiết (clip theo đường bo góc)
    if (pat && patternAlpha > 0) {
      ctx.save();
      roundRectPath(ctx, x, y, w, h, radius);
      ctx.clip();
      ctx.globalAlpha = alpha * patternAlpha;
      ctx.strokeStyle = colors.pattern[owner];
      ctx.fillStyle = colors.pattern[owner];
      if (owner === 'A') {
        // A: lưới chấm 6×6
        const gap = CANVAS.PATTERN_DOT_GAP;
        for (let yy = y + gap / 2; yy < y + h; yy += gap) {
          for (let xx = x + gap / 2; xx < x + w; xx += gap) {
            ctx.beginPath();
            ctx.arc(xx, yy, CANVAS.PATTERN_DOT_R, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        // B: gạch chéo 45°, bước 7px
        const gap = CANVAS.PATTERN_LINE_GAP;
        ctx.lineWidth = CANVAS.PATTERN_LINE_W;
        for (let off = -h; off < w; off += gap) {
          ctx.beginPath();
          ctx.moveTo(x + off, y + h);
          ctx.lineTo(x + off + h, y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Viền vẽ theo chu vi từ góc trên-trái (E2)
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = colors.boxStroke[owner];
    ctx.lineWidth = CANVAS.BOX_BORDER_W;
    const per = 2 * (w + h);
    if (strokeProgress >= 1) {
      roundRectPath(ctx, x, y, w, h, radius);
      ctx.stroke();
    } else if ('setLineDash' in ctx) {
      ctx.setLineDash([per, per]);
      ctx.lineDashOffset = per * (1 - strokeProgress);
      roundRectPath(ctx, x, y, w, h, radius);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    // Nhãn A/B (tuỳ chọn)
    if (ui.boxLabels && step > 34) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colors.boxStroke[owner];
      ctx.font = `600 ${CANVAS.BOX_LABEL_FS}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(owner, x + w / 2, y + h / 2);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPreviewBox(br, bc, player) {
    const r = boxRect(br, bc);
    const inset = step * CANVAS.BOX_INSET_RATIO;
    ctx.save();
    ctx.globalAlpha = CANVAS.PREVIEW_BOX_ALPHA;
    roundRectPath(ctx, r.x + inset, r.y + inset, r.w - 2 * inset, r.h - 2 * inset, boxRadiusFor());
    ctx.fillStyle = colors.boxFill[player === 'B' ? 'B' : 'A'];
    ctx.fill();
    ctx.restore();
  }

  /* --------------------------------------------------------- public */

  function draw(state, uiState) {
    lastState = state;
    lastUi = uiState || {};
    if (!colors) setThemeColors();
    // Kích thước canvas phải khớp khung hiện tại ở MỌI lần vẽ (đổi bàn, xoay, đóng mở màn).
    if (step <= 0 || lastN !== state.n) resize(true);
    else resize();
    paint(performance.now());
  }

  function onThemeChange() {
    setThemeColors();
    if (lastState) paint(performance.now());
  }

  function onMotionChange(e) {
    reduced = !!e.matches;
    anims = []; // đổi chế độ chuyển động giữa lúc animate → bỏ animation dở, vẽ trạng thái cuối
    if (lastState) paint(performance.now());
  }

  /** Tab hiện lại → vẽ nốt trạng thái cuối và báo main.js xả input đang chờ. */
  function onVisibility() {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      anims = [];
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      return;
    }
    if (lastState) paint(performance.now());
    if (anims.length) startLoop();
    if (typeof deps.onVisibility === 'function') {
      try { deps.onVisibility(); } catch { /* bỏ qua */ }
    }
  }

  // Lắng nghe theme + reduced-motion.
  try {
    globalThis.addEventListener('themechange', onThemeChange);
    themeBound = true;
  } catch {
    /* bỏ qua */
  }
  try {
    if (typeof matchMedia === 'function') {
      motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
      reduced = !!motionQuery.matches;
      if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange);
      else if (motionQuery.addListener) motionQuery.addListener(onMotionChange);
    }
  } catch {
    /* bỏ qua */
  }

  // Tab ẩn/hiện (dừng vẽ khi ẩn — tiết kiệm pin, §7.3).
  let visBound = false;
  try {
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', onVisibility);
      visBound = true;
    }
  } catch {
    /* bỏ qua */
  }

  // ResizeObserver có debounce 80ms.
  try {
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(() => {
        globalThis.clearTimeout(resizeTimer);
        resizeTimer = globalThis.setTimeout(() => resize(), MOTION.RESIZE_DEBOUNCE_MS);
      });
      resizeObserver.observe(wrapper);
    }
  } catch {
    /* bỏ qua */
  }

  resize();

  function destroy() {
    destroyed = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    if (idleTimer) { globalThis.clearTimeout(idleTimer); idleTimer = 0; }
    anims = [];
    try {
      if (themeBound) globalThis.removeEventListener('themechange', onThemeChange);
    } catch {
      /* bỏ qua */
    }
    try {
      if (motionQuery && motionQuery.removeEventListener) motionQuery.removeEventListener('change', onMotionChange);
      else if (motionQuery && motionQuery.removeListener) motionQuery.removeListener(onMotionChange);
    } catch {
      /* bỏ qua */
    }
    try {
      if (resizeObserver) resizeObserver.disconnect();
    } catch {
      /* bỏ qua */
    }
    try {
      if (visBound) document.removeEventListener('visibilitychange', onVisibility);
    } catch {
      /* bỏ qua */
    }
    globalThis.clearTimeout(resizeTimer);
  }

  /** Cập nhật highlight (gọi khi cần vẽ lại có animation ngắn). */
  function tick() {
    if (anims.length) startLoop();
  }

  return {
    resize,
    draw,
    animateMove,
    setThemeColors,
    geometry,
    edgePoints,
    boxRect,
    dot,
    tick,
    destroy,
    get reducedMotion() { return reduced; },
    /** Chỉ true khi đang có animation chạy (kiểm chứng "không rAF khi tĩnh"). */
    get animating() { return anims.length > 0; },
  };
}

/** Mô tả cạnh cho aria-label (dùng chung với lưới ẩn). */
export function edgeLabel(edge, n) {
  const [r, c, o] = edge;
  const type = o === 'H' ? 'ngang' : 'dọc';
  return `Cạnh ${type} hàng ${r + 1} cột ${c + 1}`;
}

/** Truy vấn tiện cho tests/UI: đếm ô còn thiếu của một state. */
export function openBoxCount(state) {
  let k = 0;
  for (let br = 0; br < state.n; br++) {
    for (let bc = 0; bc < state.n; bc++) if (!state.boxes[br * state.n + bc]) k++;
  }
  return k;
}

export { isInteriorEdge, boxMissing, edgeKey };
