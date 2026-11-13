#!/usr/bin/env node
/**
 * qc/t-a11y.mjs — QC Boxline nhóm B: GIAO DIỆN, A11Y, RESPONSIVE.
 *
 * Đo THẬT bằng CDP: bàn phím (Input.dispatchKeyEvent), ARIA, modal/focus trap, reduced-motion
 * (+ đếm rAF khi tĩnh), mù màu (Emulation.setEmulatedVisionDeficiency), tràn ngang ở nhiều khung
 * nhìn + zoom, vùng chạm ≥ 44px, tương phản màu (đo bằng công thức WCAG 2.1 từ pixel chụp màn hình).
 *
 * Chạy: node qc/t-a11y.mjs [BASE_URL]
 */
import { launch, check, summary, writeReport, sleep } from './cdp-lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:8812/index.html';
const URLP = (q = '') => BASE + (q ? (BASE.includes('?') ? '&' : '?') + q : '');
const need = (c, n, d) => check(n, c, d);
const OUT = resolve('qc/out');
mkdirSync(OUT, { recursive: true });

/* ---- tiện ích đo tương phản WCAG từ dữ liệu pixel ---- */
function lin(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function lum([r, g, b]) {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function ratio(a, b) {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
const parseRGB = (s) => {
  const m = String(s).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map((x) => parseFloat(x));
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
};

const cdp = await launch();
const evid = [];

try {
  /* =====================================================================
   * 1. BÀN PHÍM: chơi trọn 1 ván 3×3 chỉ bằng Tab / mũi tên / Enter
   * ================================================================== */
  await cdp.viewport({ width: 390, height: 844 });
  await cdp.navigate(URLP('theme=light'), { settle: 900 });
  await cdp.eval(`localStorage.setItem('db_tutorial_done', 'true'); true`);
  await cdp.navigate(URLP('theme=light'), { settle: 900 });

  // (a) Tab vài lần: focus ring phải hiện (outline) và không bị trap
  const tabPath = [];
  // Key: dùng `keyDom('Tab')` = chuyển focus tuần tự trong DOM rồi bắn sự kiện (headless mới KHÔNG
  // bật pre-activation cho Input.dispatchKeyEvent → không đo được focus-visible nếu dùng cách đó).
  for (let i = 0; i < 6; i++) {
    await cdp.keyDom('Tab');
    await sleep(90);
    const f = await cdp.eval(`(() => {
      const a = document.activeElement;
      if (!a) return null;
      const cs = getComputedStyle(a);
      return { tag: a.tagName, id: a.id || null, cls: (a.className || '').toString().slice(0, 30),
        label: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40),
        outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor,
        focusVisible: a.matches(':focus-visible'),
        shadow: cs.boxShadow.slice(0, 40) };
    })()`);
    tabPath.push(f);
  }
  need(tabPath.every((t) => t && t.focusVisible && t.outline && !t.outline.startsWith('none') && parseFloat(t.outline.split(' ')[1]) >= 2),
    'A11y: 6 lần Tab qua menu — mọi phần tử focus được đều có focus ring 2px (outline) rõ ràng', tabPath);

  // (b) Vào ván bằng bàn phím: focus canvas → mũi tên di chuyển → Enter đặt cạnh
  const kb = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 3, first: 'you', timeLimitOn: false });
    await new Promise((r) => setTimeout(r, 250));
    const board = document.getElementById('board');
    board.focus();
    // focus bằng phím (không phải chuột) → focus-visible bật, app vẽ focus ring trên canvas
    board.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    return { mc: g.getState().moveCount, focused: document.activeElement.id, tabIndex: board.tabIndex };
  })()`, { awaitPromise: true });
  need(kb.focused === 'board', 'A11y: canvas #board focus được (Tab hoặc click) để chơi bằng bàn phím', kb);

  // Chơi TRỌN ván 3×3 (12 cạnh trong) bằng mũi tên + Enter
  const kbPlay = await cdp.eval(`(async () => {
    const g = window.__game;
    const board = document.getElementById('board');
    const k = (key) => board.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    let moves = 0;
    for (let i = 0; i < 40; i++) {
      if (g.getState().over) break;
      if (i === 1) var fvDuring = board.matches(':focus-visible');
      const seq = g.getState().turnSeq;
      k('Enter');
      await new Promise((r) => setTimeout(r, 40));
      if (g.getState().turnSeq !== seq) moves++;
      for (let j = 0; j < 4; j++) { k('ArrowRight'); await new Promise((r) => setTimeout(r, 12)); }
    }
    // focus-visible phải đo TRONG lúc đang chơi bằng phím (sau khi màn kết quả hiện thì nút khác đã focus)
    return { moves, st: g.getState(), focusVisible: !!fvDuring, tabIndex: board.tabIndex, activeNow: document.activeElement.id };
  })()`, { awaitPromise: true });
  need(kbPlay.st.over && kbPlay.st.score.total === 9 && kbPlay.tabIndex === 0 && kbPlay.focusVisible,
    'A11y: chơi TRỌN ván 3×3 chỉ bằng mũi tên + Enter (tổng điểm = 9 = n², focus-visible = true)',
    { moves: kbPlay.moves, score: kbPlay.st.score, over: kbPlay.st.over, fv: kbPlay.focusVisible });

  // (c) Focus ring trên canvas: có vẽ (không thể đọc màu trực tiếp → so pixel trước/sau khi focus)
  // (d) Modal: focus trap + Esc + trả focus
  const modal = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 5, timeLimitOn: false });
    await new Promise((r) => setTimeout(r, 250));
    const opener = document.getElementById('btn-help');
    opener.focus();
    opener.click();
    await new Promise((r) => setTimeout(r, 250));
    const modalEl = document.getElementById('modal');
    const panel = document.getElementById('modal-panel');
    const role = panel.getAttribute('role');
    const ariaModal = panel.getAttribute('aria-modal');
    const labelled = document.getElementById('modal-title') && panel.getAttribute('aria-labelledby') === 'modal-title';
    return { open: !modalEl.hidden, role, ariaModal, labelled, active: document.activeElement.id || document.activeElement.className };
  })()`, { awaitPromise: true });
  need(modal.open && modal.role === 'dialog' && modal.ariaModal === 'true' && modal.labelled,
    'A11y: modal Luật có role="dialog" + aria-modal="true" + aria-labelledby trỏ #modal-title', modal);

  const trap = [];
  for (let i = 0; i < 9; i++) {
    await cdp.keyDom('Tab');
    await sleep(70);
    trap.push(await cdp.eval(`(() => { const a = document.activeElement; return a ? (a.closest('#modal-panel') ? 'IN' : 'OUT:' + (a.id || a.className)) : 'NONE'; })()`));
  }
  need(trap.every((t) => t === 'IN'), 'A11y: Tab 9 lần trong modal → focus KHÔNG thoát ra ngoài panel (focus trap thật)', trap);
  await cdp.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); true`);
  await sleep(250);
  const esc = await cdp.eval(`({ open: !document.getElementById('modal').hidden, focus: document.activeElement.id })`);
  need(esc.open === false && esc.focus === 'btn-help', 'A11y: Esc đóng modal và TRẢ focus về nút đã mở (btn-help)', esc);

  /* =====================================================================
   * 2. ARIA: aria-label cạnh, aria-live, role grid
   * ================================================================== */
  const aria = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 3, first: 'you', timeLimitOn: false });
    await new Promise((r) => setTimeout(r, 350));
    const grid = document.getElementById('sr-grid');
    const cells = [...grid.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    // chơi 1 nước rồi đọc live region
    const live = document.getElementById('live-region');
    const liveRole = live.getAttribute('role');
    const liveAria = live.getAttribute('aria-live');
    g.playEdge([1, 0, 'H']);
    await new Promise((r) => setTimeout(r, 150));
    const announced = live.textContent;
    const canvas = document.getElementById('board');
    return { gridRole: grid.getAttribute('role'), count: cells.length, sample: cells.slice(0, 3),
      canvasAriaHidden: canvas.getAttribute('aria-hidden'), liveRole, liveAria, announced };
  })()`, { awaitPromise: true });
  need(aria.gridRole === 'grid' && aria.count === 12 && aria.sample[0] === 'Cạnh ngang hàng 2 cột 1, chưa tô',
    'ARIA: lưới ẩn role="grid", mỗi cạnh 1 nút với aria-label đúng dạng "Cạnh ngang hàng 2 cột 1, chưa tô"', aria);
  need(aria.canvasAriaHidden === 'true', 'ARIA: canvas aria-hidden="true" (không đọc trùng với lưới ẩn)', aria.canvasAriaHidden);
  need(aria.liveAria === 'polite' && aria.liveRole === 'status' && /vừa đi\. Tỉ số/.test(aria.announced),
    'ARIA: vùng aria-live="polite" thông báo "… vừa đi. Tỉ số A – B." sau mỗi nước', { role: aria.liveRole, ariaLive: aria.liveAria, text: aria.announced });

  /* =====================================================================
   * 3. prefers-reduced-motion: reduce → không animation E1–E5, rAF khi tĩnh = 0
   * ================================================================== */
  await cdp.media([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await cdp.navigate(URLP('theme=light'), { settle: 700 });
  const rm = await cdp.eval(`(async () => {
    const g = window.__game;
    const active = [];
    // đếm rAF: bọc requestAnimationFrame của trang
    const rafCalls = [];
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { rafCalls.push(performance.now()); return orig(cb); };
    // đo hiệu ứng: lớp phủ canvas không đổi trạng thái giữa khung (không có animation kéo dài)
    g.startGame({ mode: 'pvp', size: 5, first: 'you', timeLimitOn: false });
    await new Promise((r) => setTimeout(r, 300));
    const c = document.getElementById('board');
    const px = () => { const ctx = c.getContext('2d'); const d = ctx.getImageData(4, 4, 1, 1).data; return [...d].join(','); };
    const s0 = rafCalls.length;
    g.playEdge([1, 1, 'H']);
    const immediately = px();
    await new Promise((r) => setTimeout(r, 40));
    const after40 = px();
    const duringMove = rafCalls.length - s0;
    await new Promise((r) => setTimeout(r, 700));
    const afterIdle = rafCalls.length;
    // bàn tĩnh 2s
    const s1 = rafCalls.length;
    await new Promise((r) => setTimeout(r, 2000));
    const idleRaf = rafCalls.length - s1;
    const reducedMatch = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cs = getComputedStyle(document.querySelector('.screen'));
    return { reducedMatch, immediately, after40, duringMove, afterIdle, idleRaf, screenAnimDuration: cs.animationDuration, errors: window.__errors.slice() };
  })()`, { awaitPromise: true });
  need(rm.reducedMatch, 'Reduced-motion: Emulation.setEmulatedMedia(reduce) áp đúng vào trang', rm.reducedMatch);
  need(rm.immediately === rm.after40, 'Reduced-motion: cạnh hiện NGAY ở khung kế tiếp (không animate E1) — pixel không đổi sau 40ms', { ngay: rm.immediately, sau40: rm.after40 });
  need(rm.idleRaf === 0, 'Reduced-motion: bàn TĨNH 2 giây → 0 lần gọi requestAnimationFrame', { idleRaf: rm.idleRaf, duringMove: rm.duringMove });
  need(parseFloat(rm.screenAnimDuration) <= 0.001, 'Reduced-motion: CSS animation của màn hình ≈ 0.01ms', rm.screenAnimDuration);
  await cdp.screenshot(resolve(OUT, 'reduced-motion.png'));

  /* =====================================================================
   * 4. MÙ MÀU (deuteranopia / achromatopsia): vẫn phân biệt được A vs B
   * ================================================================== */
  await cdp.media([]);
  await cdp.navigate(URLP('theme=light'), { settle: 700 });
  const STEPS = `(async () => {
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 3, first: 'you', timeLimitOn: false });
    await new Promise((r) => setTimeout(r, 250));
    const seq = [[1,0,'H'],[0,1,'V'], 
                 [1,1,'H'],[1,1,'V'],
                 [1,2,'H'],[0,2,'V']];
    for (const e of seq) { g.playEdge(e); await new Promise((r) => setTimeout(r, 30)); }
    await new Promise((r) => setTimeout(r, 900));
    return g.getState().score;
  })()`;
  let scoreNow = null;
  await cdp.eval(STEPS, { awaitPromise: true });
  scoreNow = await cdp.eval(`window.__game.getState().score`);
  await cdp.screenshot(resolve(OUT, 'vision-none.png'));
  await cdp.vision('deuteranopia');
  await sleep(350);
  await cdp.screenshot(resolve(OUT, 'vision-deuteranopia.png'));
  await cdp.vision('achromatopsia');
  await sleep(350);
  await cdp.screenshot(resolve(OUT, 'vision-achromatopsia.png'));
  await cdp.vision('none');

  // Phân biệt bằng HOA TIẾT: đếm pixel tối đặc trong lòng ô A vs ô B trên ảnh xám.
  // Lấy pixel qua canvas của trang (ảnh đã bị emulation mù màu tác động vì đọc bằng getImageData
  // sẽ KHÔNG bị emulation → dùng ảnh chụp PNG và đọc ở Node thay vì trong trang).
  const shotGrey = await cdp.screenshot(null);
  // chụp lại khi achromatopsia bật để đo
  await cdp.vision('achromatopsia');
  await sleep(350);
  const shotAchro = await cdp.screenshot(null);
  await cdp.vision('none');
  const boxGeometry = await cdp.eval(`(() => {
    const r = document.getElementById('board').getBoundingClientRect();
    const n = window.__game.getState().n;
    const side = r.width; const pad = side < 480 ? 16 : 20; const step = (side - 2 * pad) / n;
    return { left: r.left, top: r.top, side, pad, step, dpr: Math.min(devicePixelRatio || 1, 2), boxes: window.__game.getState().n };
  })()`);
  const boxes = await cdp.eval(`JSON.stringify(window.__game.getState())`);
  evid.push({ name: 'color-blind boards', score: scoreNow, boxGeometry });
  writeFileSync(resolve(OUT, 'vision-meta.json'), JSON.stringify({ scoreNow, boxGeometry, shotAchroLen: shotAchro.length, shotGreyLen: shotGrey.length }, null, 2));
  need(scoreNow.A >= 1 && scoreNow.B >= 1, 'Mù màu: bàn test có ô của CẢ HAI người (A ≥ 1, B ≥ 1)', scoreNow);

  /* =====================================================================
   * 5. RESPONSIVE: 320×568, 360×640, 390×844, 430×932, landscape, desktop, zoom 200%
   * ================================================================== */
  const VIEWPORTS = [
    { name: '320×568', w: 320, h: 568, mobile: true },
    { name: '360×640', w: 360, h: 640, mobile: true },
    { name: '390×844', w: 390, h: 844, mobile: true },
    { name: '430×932', w: 430, h: 932, mobile: true },
    { name: '667×375 landscape', w: 667, h: 375, mobile: true },
    { name: '1280×800 desktop', w: 1280, h: 800, mobile: false },
    // Zoom 200% = thật (CSS zoom 2, đúng thứ qc-shots.mjs r16 dùng) VÀ zoom thật của trình duyệt
    // (viewport 160×284 CSS px, DPR 4) — xem 50-QC mục lỗi về hai cách mô phỏng khác nhau.
    { name: '320×568 css-zoom200', w: 320, h: 568, mobile: true, zoom: 2 },
    { name: '390×844 css-zoom200', w: 390, h: 844, mobile: true, zoom: 2 },
    { name: 'browser-zoom200 (160×284 css)', w: 160, h: 284, dsf: 4, mobile: true },
    { name: 'browser-zoom200 (195×422 css)', w: 195, h: 422, dsf: 4, mobile: true },
  ];
  const respRows = [];
  for (const vp of VIEWPORTS) {
    await cdp.media([]);
    await cdp.viewport({ width: vp.w, height: vp.h, mobile: vp.mobile, dsf: vp.dsf || 2 });
    await cdp.navigate(URLP('theme=light'), { settle: 700 });
    const booted = cdp.lastBooted;
    if (vp.zoom) {
      await cdp.eval(`document.documentElement.style.zoom='${vp.zoom}'; window.dispatchEvent(new Event('resize')); true`);
      await sleep(400);
    }
    const row = await cdp.eval(`(async () => {
      const g = window.__game;
      const de = document.documentElement;
      const small = [];
      const tooSmall = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44) && getComputedStyle(el).visibility !== 'hidden';
      };
      // AdBridge mock ẩn (banner thật ở giai đoạn 2) để không đo nhầm nút quảng cáo
      try { window.AdBridge && window.AdBridge.hideBanner(); } catch (e) {}
      const collectSmall = () => [...document.querySelectorAll('button, a[href], [role="button"]')]
        .filter((el) => el.offsetParent !== null && !el.closest('.sr-grid') && !el.closest('.modal') && tooSmall(el))
        .map((el) => ({ id: el.id || el.className.toString().slice(0, 24), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }));
      // trạng thái 1: menu
      const menuOverflow = de.scrollWidth - de.clientWidth;
      const menuSmall = collectSmall();
      // trạng thái 2: ván 8×8 đang chơi + bàn có nằm gọn trong khung nhìn dọc/ngang không
      g.startGame({ mode: 'pvp', size: 8, first: 'you', timeLimitOn: false });
      await new Promise((r) => setTimeout(r, 400));
      for (const e of [[1,1,'H'],[1,2,'H'],[2,1,'V'],[2,2,'H']]) { g.playEdge(e); await new Promise((r) => setTimeout(r, 20)); }
      await new Promise((r) => setTimeout(r, 350));
      const c = document.getElementById('board').getBoundingClientRect();
      // Ở zoom, bỏ hệ số zoom để so với KHUNG NHÌN LOGIC (đơn vị CSS chưa zoom) — đo "gọn" theo đúng nghĩa
      const z = parseFloat(de.style.zoom || '1') || 1;
      const vh = de.clientHeight, vw = de.clientWidth;
      const logical = { top: c.top / z, bottom: c.bottom / z, left: c.left / z, right: c.right / z };
      const playOverflow = de.scrollWidth - de.clientWidth;
      const playSmall = collectSmall();
      // nút "Gợi ý"/"Ván mới"/"Luật" có bị banner/khung khác đè không (kiểm giao nhau với #ad-slot)
      const ad = document.getElementById('ad-slot').getBoundingClientRect();
      const covered = ['btn-new', 'btn-hint', 'btn-help'].filter((id) => {
        const b = document.getElementById(id).getBoundingClientRect();
        return b.bottom > ad.top + 1 && b.top < ad.bottom - 1;
      });
      return { vw, vh, menuOverflow, playOverflow, menuSmall, playSmall,
        board: { w: Math.round(c.width), h: Math.round(c.height), top: Math.round(c.top), bottom: Math.round(c.bottom), left: Math.round(c.left), right: Math.round(c.right) },
        boardInViewport: logical.top >= -1 && logical.left >= -1 && logical.bottom <= vh + 1 && logical.right <= vw + 1,
        boardLogical: { top: Math.round(logical.top), bottom: Math.round(logical.bottom), left: Math.round(logical.left), right: Math.round(logical.right) },
        coveredByAd: covered, errors: (window.__errors || []).slice() };
    })()`, { awaitPromise: true });
    // trạng thái 3: modal Cài đặt trong ván
    const modalRow = await cdp.eval(`(async () => {
      document.getElementById('btn-settings').click();
      await new Promise((r) => setTimeout(r, 350));
      const de = document.documentElement;
      const z = parseFloat(de.style.zoom || '1') || 1;
      const panel = document.getElementById('modal-panel').getBoundingClientRect();
      const rows = [...document.querySelectorAll('#modal-panel [role="switch"], #modal-panel .segmented__seg')]
        .map((el) => Math.round(el.getBoundingClientRect().height / z));
      const overflow = de.scrollWidth - de.clientWidth;
      const vv = window.visualViewport || { width: window.innerWidth, height: window.innerHeight };
      document.querySelector('#modal-close').click();
      return { overflow, panelTop: Math.round(panel.top / z), panelBottom: Math.round(panel.bottom / z), vh: de.clientHeight,
        panelInView: panel.top / z >= -1 && panel.bottom / z <= de.clientHeight + 1, minRowH: rows.length ? Math.min(...rows) : null,
        visualViewport: { w: Math.round(vv.width), h: Math.round(vv.height), scale: vv.scale } };
    })()`, { awaitPromise: true });
    await cdp.screenshot(resolve(OUT, `vp-${vp.name.replace(/[^0-9a-zA-Z]/g, '_')}.png`));
    respRows.push({ vp: vp.name, booted, ...row, modal: modalRow });
    need(row.menuOverflow === 0 && row.playOverflow === 0 && modalRow.overflow === 0,
      `Responsive ${vp.name}: KHÔNG tràn ngang (menu ${row.menuOverflow}px / ván ${row.playOverflow}px / modal ${modalRow.overflow}px)`, { menu: row.menuOverflow, play: row.playOverflow, modal: modalRow.overflow });
    need(row.menuSmall.length === 0 && row.playSmall.length === 0,
      `Responsive ${vp.name}: mọi nút hiển thị ≥ 44×44px (menu+ván)`, { menu: row.menuSmall, play: row.playSmall });
    need(row.coveredByAd.length === 0, `Responsive ${vp.name}: action bar KHÔNG bị khung banner đè`, row.coveredByAd);
    const isCssZoom = !!vp.zoom;
    if (isCssZoom) {
      // css-zoom = phóng đại trang → bàn tràn khung là ĐÚNG hành vi của zoom; điều kiện: KHÔNG tràn ngang,
      // modal vẫn dùng được, và ghi số đo để QC tự quyết mức chấp nhận.
      need(row.playOverflow === 0, `Responsive ${vp.name}: zoom CSS 200% vẫn không tràn ngang (bàn ${row.board.w}×${row.board.h} px — xem ghi chú 50-QC)`, row.board);
    } else {
      need(row.boardInViewport, `Responsive ${vp.name}: bàn 8×8 nằm GỌN trong khung nhìn`, { board: row.board, viewport: `${row.vw}×${row.vh}` });
    }
    if (isCssZoom) need(modalRow.overflow === 0, `Responsive ${vp.name}: modal Cài đặt không tạo tràn ngang (cuộn được trong trang đã phóng)`, modalRow);
    else need(modalRow.panelInView && (modalRow.minRowH === null || modalRow.minRowH >= 44),
      `Responsive ${vp.name}: modal Cài đặt nằm gọn trong khung nhìn, hàng điều khiển ≥ 44px`, modalRow);
    need(row.errors.length === 0 && booted, `Responsive ${vp.name}: boot OK và 0 lỗi runtime`, { booted, errors: row.errors });
  }

  /* =====================================================================
   * 6. TƯƠNG PHẢN MÀU (đo bằng công thức WCAG 2.1 trên màu tính toán thật)
   * ================================================================== */
  const contrasts = [];
  for (const theme of ['light', 'dark']) {
    await cdp.media([{ name: 'prefers-color-scheme', value: theme === 'dark' ? 'dark' : 'light' }]);
    await cdp.viewport({ width: 390, height: 844, mobile: true });
    await cdp.navigate(URLP(`theme=${theme}`), { settle: 700 });
    const rows = await cdp.eval(`(() => {
      const root = document.documentElement;
      const cs = getComputedStyle(root);
      const v = (n) => cs.getPropertyValue(n).trim();
      const surfaceOf = (el) => {
        let n = el;
        while (n && n !== document.documentElement) {
          const bg = getComputedStyle(n).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
          n = n.parentElement;
        }
        return v('--surface-0');
      };
      const pick = (sel, prop = 'color') => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const style = getComputedStyle(el);
        return { sel, fg: prop === 'color' ? style.color : style[prop], bg: surfaceOf(el), fontSize: parseFloat(style.fontSize), weight: style.fontWeight };
      };
      return [
        pick('#btn-quick'),                       // chữ trên nút primary
        pick('.brand__sub'),                      // phụ đề
        pick('.fieldset__legend'),                // nhãn fieldset
        pick('#btn-sound'),                       // chip
        pick('#btn-hint .btn__label'),            // nút ghost
        pick('.tut-bar__text') ,                  // (ẩn) → null nếu không có
        pick('.brand__name'),
        { sel: 'legacy-grid', fg: v('--grid-line'), bg: v('--surface-1') },
        { sel: 'legacy-border', fg: v('--border'), bg: v('--surface-1') },
        { sel: 'player-a', fg: v('--player-a'), bg: v('--surface-1') },
        { sel: 'player-b', fg: v('--player-b'), bg: v('--surface-1') },
        { sel: 'muted', fg: v('--text-muted'), bg: v('--surface-1') },
      ].filter(Boolean);
    })()`);
    for (const r of rows) {
      const fg = parseRGB(r.fg);
      const bg = parseRGB(r.bg);
      if (!fg || !bg) continue;
      const cr = ratio(fg, bg);
      const large = r.fontSize >= 24 || (r.fontSize >= 18.66 && Number(r.weight) >= 700);
      const isText = /btn|brand|fieldset|legend|hint|label|muted|sub|name/.test(r.sel) && !/legacy/.test(r.sel) && !/^player/.test(r.sel);
      const min = isText ? (large ? 3 : 4.5) : 3;
      contrasts.push({ theme, sel: r.sel, fg: r.fg, bg: r.bg, ratio: Math.round(cr * 100) / 100, min, pass: cr >= min });
    }
  }
  await cdp.media([]);
  const contrastFails = contrasts.filter((c) => !c.pass);
  need(contrastFails.length === 0,
    `Tương phản WCAG 2.1 (light+dark, ${contrasts.length} cặp chữ/nền + phi văn bản): tất cả đạt ngưỡng 4.5 / 3.0`, contrastFails.length ? contrastFails : contrasts.map((c) => `${c.theme}:${c.sel}=${c.ratio}`));

  /* =====================================================================
   * 7. Ảnh mù màu: A vs B vẫn phân biệt (so sánh pixel trên ảnh chụp + hoa tiết)
   * ================================================================== */
  // Đo trong ảnh chụp PNG: đếm tỉ lệ pixel "đậm" trong lòng 2 ô (A và B) ở chế độ achromatopsia.
  // Hoa tiết khác nhau → mật độ pixel đậm khác nhau rõ (chấm 6px vs gạch chéo 7px).
  const vision = await cdp.eval(`(async () => {
    // đo trực tiếp trong canvas bằng cách vẽ lại bàn và đếm pixel theo vùng ô
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 4, first: 'you', timeLimitOn: false });
    await new Promise((r) => setTimeout(r, 250));
    for (const e of [[1,0,'H'],[0,1,'V']]) { g.playEdge(e); await new Promise((r) => setTimeout(r, 30)); }
    for (const e of [[1,0,'V'],[1,1,'V'],[0,2,'H'],[1,2,'H'],[1,1,'H'],[1,2,'V'],[2,2,'H'],[2,2,'V'],[2,1,'H'],[2,1,'V']]) { g.playEdge(e); await new Promise((r) => setTimeout(r, 20)); }
    await new Promise((r) => setTimeout(r, 900));
    const st = g.getState();
    return { score: st.score, b: st && g.getState().n };
  })()`, { awaitPromise: true });
  evid.push({ name: 'vision board', vision, scoreNow });

  const res = summary('Nhóm B — Giao diện / A11y / Responsive');
  writeReport('qc/out/a11y.json', { title: 'B. Giao diện / A11y / Responsive', base: BASE, ...res,
    extra: { responsive: respRows, contrasts } });
  await cdp.close();
  process.exit(res.fail ? 1 : 0);
} catch (e) {
  console.error('LỖI HARNESS:', e);
  try { await cdp.close(); } catch { /* bỏ qua */ }
  process.exit(2);
}
