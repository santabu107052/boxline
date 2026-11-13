#!/usr/bin/env node
/**
 * qc/t-functional.mjs — QC Boxline nhóm A: CHỨC NĂNG & LUẬT (chạy trên Chrome thật qua CDP).
 *
 * Chạy: node qc/t-functional.mjs [BASE_URL]
 * Mặc định BASE_URL = http://127.0.0.1:8812/index.html (phải tự chạy máy chủ trước).
 *
 * Nguyên tắc: chỉ dùng hook công khai `window.__game` + input CHUẨN qua CDP
 * (Input.dispatchKeyEvent / dispatchMouseEvent), KHÔNG sửa mã sản phẩm.
 */
import { launch, check, summary, writeReport, sleep } from './cdp-lib.mjs';

const BASE = process.argv[2] || 'http://127.0.0.1:8812/index.html';
const URLP = (q = '') => BASE + (BASE.includes('?') ? '&' : '?') + q;

const need = (cond, name, detail) => check(name, cond, detail);

const cdp = await launch();

try {
  /* =====================================================================
   * 1. LUẬT CHƠI trên ENGINE THẬT CỦA APP (module src/engine.js qua http)
   * ================================================================== */
  await cdp.viewport({ width: 390, height: 844 });
  // LƯU Ý (phát hiện của QC, xem 50-QC mục lỗi): trên URL có `?debug=1`, module src/main.js KHÔNG khởi
  // động trong Chrome headless ngay sau `Page.navigate` (repro 100% qua CDP) — dùng URL không có `?debug=1`
  // cho luồng chức năng và BÁO CÁO riêng lỗi này bên dưới (kiểm riêng bằng "debug=1 có chạy không").
  const DEBUG_BOOT = [];
  for (let i = 0; i < 3; i++) {
    await cdp.navigate(URLP('debug=1&theme=light'), { settle: 1200 });
    const ok = await cdp.eval(`!!(window.__game && window.__bootOk === true)`);
    DEBUG_BOOT.push({ lan: i + 1, boot: ok, errs: (cdp.filteredErrors() || []).map((e) => e.text).slice(0, 2) });
  }
  need(DEBUG_BOOT[0].boot === true, 'Chức năng: URL ?debug=1 (bộ chụp ảnh QC dùng) KHỞI ĐỘNG được app ngay sau Page.navigate', DEBUG_BOOT);
  await cdp.navigate(URLP('theme=light'), { settle: 900 });
  const MODULE_PATH = await cdp.eval(`(() => { const s = document.querySelector('script[type=module]'); return './src/engine.js'; })()`);
  await cdp.eval(`(async () => { window.__M = Object.assign({}, await import('./src/engine.js'),
                        await import('./src/ai.js'), await import('./src/config.js')); return true; })()`, { awaitPromise: true });

  // 1a. Viền ngoài không bao giờ chơi được
  const border = await cdp.eval(`(() => {
    const E = window.__M; let bad = 0, tested = 0;
    for (let n = 3; n <= 8; n++) {
      const g = E.createGame({ n });
      const borderEdges = [];
      for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) borderEdges.push([r, c, 'H']);
      for (let c = 0; c <= n; c++) for (let r = 0; r < n; r++) borderEdges.push([r, c, 'V']);
      const legal = E.legalEdges(g).map(E.edgeKey);
      if (borderEdges.filter((e) => E.isBorderEdge(e, n)).length !== 4 * n) bad++;
      for (const e of borderEdges) {
        if (!E.isBorderEdge(e, n)) continue;
        tested++;
        if (legal.includes(E.edgeKey(e))) bad++;
        if (E.isLegal(g, e)) bad++;
        const res = E.applyMove(g, e);
        if (res.ok || res.reason !== 'border') bad++;
      }
      // Tổng cạnh đúng công thức, viền = 4n, cạnh trong = 2n(n+1)-4n
      const inCount = E.allInteriorEdges(n).length;
      if (inCount !== 2 * n * (n - 1)) bad++;
      if (2 * n * (n + 1) - 4 * n !== inCount) bad++;
    }
    let expected = 0;
    for (let n = 3; n <= 8; n++) expected += 4 * n;
    return { bad, tested, expected };
  })()`);
  need(border.bad === 0 && border.tested === border.expected && border.expected === 132,
    'Luật: mọi cạnh viền (đúng 4n cạnh/bàn, n=3..8) không chơi được & không làm đổi state', border);

  // 1b. 50 ván ngẫu nhiên: tổng điểm = n² khi kết thúc, bất biến điểm/ô, idempotent
  const law = await cdp.eval(`(() => {
    const E = window.__M; const out = { games: 0, bad: 0, dupOk: 0, dupBad: 0, keepTurnBad: 0, overBad: 0, sizes: {} };
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let n = 3; n <= 8; n++) {
      for (let k = 0; k < 9; k++) {
        const g = E.createGame({ n, first: rnd() < 0.5 ? 'A' : 'B' });
        let guard = 0;
        let lastKey = null;
        while (!E.isOver(g) && guard++ < 500) {
          const legal = E.legalEdges(g);
          const e = legal[Math.floor(rnd() * legal.length)];
          const beforeTurn = g.turn;
          const res = E.applyMove(g, e);
          if (!res.ok) { out.bad++; break; }
          // Kín ô ⟺ giữ lượt
          if (res.closed.length > 0 && res.turn !== beforeTurn) out.keepTurnBad++;
          if (res.closed.length === 0 && res.turn === beforeTurn) out.keepTurnBad++;
          // Idempotent: gửi lại đúng cạnh vừa đi
          const dup = E.applyMove(g, e);
          if (!dup.ok && dup.reason === 'taken') out.dupOk++; else out.dupBad++;
          // Tổng điểm không vượt n², số ô có chủ = tổng điểm
          const s = E.score(g);
          if (s.total > n * n) out.bad++;
          const owned = g.boxes.filter(Boolean).length;
          if (owned !== s.total) out.bad++;
          lastKey = e;
        }
        if (!E.isOver(g)) out.bad++;
        const s = E.score(g);
        if (s.total !== n * n) out.overBad++;
        const w = E.getWinner(g);
        const expect = s.A > s.B ? 'A' : s.B > s.A ? 'B' : 'draw';
        if (w !== expect) out.overBad++;
        out.games++;
        out.sizes[n] = (out.sizes[n] || 0) + 1;
      }
    }
    return out;
  })()`);
  need(law.bad === 0 && law.overBad === 0 && law.keepTurnBad === 0, 'Luật: 54 ván ngẫu nhiên n=3..8 — tổng điểm = n², kín ô thì giữ lượt, người thắng đúng', law);
  need(law.dupBad === 0 && law.dupOk > 100, 'Luật: gửi trùng cạnh (idempotent) bị từ chối "taken", không nhân điểm', { dupOk: law.dupOk, dupBad: law.dupBad });

  // 1c. Meridian thông qua UI thật: chơi hết 1 ván PvP bằng __game.playLegalEdge, kiểm HUD + màn kết quả
  const pvpFull = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 4, first: 'you', timeLimitOn: false });
    await new Promise(r => setTimeout(r, 200));
    let guard = 0;
    while (!g.getState().over && guard++ < 200) { g.playLegalEdge(); await new Promise(r => setTimeout(r, 2)); }
    await new Promise(r => setTimeout(r, 800));   // E4: số điểm đếm 0 → điểm thật trong 480ms
    const st = g.getState();
    const hudA = document.getElementById('hud-a-score').textContent;
    const hudB = document.getElementById('hud-b-score').textContent;
    const resultShown = !document.getElementById('screen-result').hidden;
    const title = document.getElementById('result-title').textContent;
    const sum = document.getElementById('result-summary').textContent;
    const rA = document.getElementById('result-a').textContent;
    const rB = document.getElementById('result-b').textContent;
    const focus = document.activeElement && document.activeElement.id;
    return { st, hudA, hudB, resultShown, title, sum, rA, rB, focus, errors: window.__errors.slice() };
  })()`, { awaitPromise: true });
  need(pvpFull.st.over && pvpFull.st.score.total === 16, 'Chức năng: chơi trọn ván 2 người 4×4 qua UI → hết cạnh, tổng điểm = 16 = n²', pvpFull.st.score);
  need(pvpFull.resultShown && /thắng|Hoà/.test(pvpFull.title), 'Chức năng: màn kết quả hiện đúng tiêu đề tiếng Việt', { title: pvpFull.title, summary: pvpFull.sum });
  need(Number(pvpFull.hudA) === pvpFull.st.score.A && Number(pvpFull.hudB) === pvpFull.st.score.B, 'Chức năng: HUD khớp điểm engine', { hudA: pvpFull.hudA, hudB: pvpFull.hudB, engine: pvpFull.st.score });
  need(Number(pvpFull.rA) === pvpFull.st.score.A && Number(pvpFull.rB) === pvpFull.st.score.B, 'Chức năng: màn kết quả hiện đúng số điểm 2 bên', { rA: pvpFull.rA, rB: pvpFull.rB });
  need(pvpFull.focus === 'btn-result-new', 'A11y: nút "Ván mới" trên màn kết quả được focus sẵn (Enter chơi lại)', pvpFull.focus);
  need(pvpFull.errors.length === 0, 'Chức năng: 0 lỗi runtime trong lúc chơi trọn ván', pvpFull.errors);

  /* =====================================================================
   * 2. AI — 3 độ khó KHÁC BIỆT HÀNH VI THẬT
   * ================================================================== */
  const ai = await cdp.eval(`(() => {
    const E = window.__M;
    // (a) Trong thế có 2 ô 3 cạnh (tức là có nước "ăn ô"): Dễ bỏ lỡ đôi khi, Trung bình/Khó luôn ăn.
    //     Dựng bàn 5×5: đặt 3 cạnh của ô (0,0) & (2,2) để mỗi ô còn đúng 1 cạnh.
    const mkState = () => {
      const g = E.createGame({ n: 5 });
      // ô (0,0): thiếu [0,1,'V']
      E.applyMove(g, [1, 0, 'H']); E.applyMove(g, [1, 1, 'H']);
      // ô (2,2): thiếu [2,3,'V']
      E.applyMove(g, [2, 2, 'H']); E.applyMove(g, [3, 2, 'H']); E.applyMove(g, [2, 2, 'V']);
      g.turn = 'B';
      return g;
    };
    const counts = { easy: 0, medium: 0, hard: 0 };
    const N = 60;
    for (const lvl of ['easy', 'medium', 'hard']) {
      for (let s = 1; s <= N; s++) {
        const g = mkState();
        const mv = E.chooseMove(g, { level: lvl, seed: s });
        const cap = E.boxesClosedBy(g, mv).length;
        if (cap > 0) counts[lvl]++;
      }
    }
    // (b) Không bao giờ trả nước không hợp lệ ở bất kỳ độ khó / kích thước nào
    let illegal = 0, nulls = 0;
    for (const lvl of ['easy', 'medium', 'hard']) {
      for (let n = 3; n <= 8; n++) {
        for (let s = 1; s <= 6; s++) {
          const g = E.createGame({ n });
          let guard = 0;
          while (!E.isOver(g) && guard++ < 400) {
            const mv = E.chooseMove(g, { level: lvl, seed: s * 7 + guard });
            if (!mv) { nulls++; break; }
            if (!E.isLegal(g, mv)) { illegal++; break; }
            E.applyMove(g, mv);
          }
        }
      }
    }
    // (c) Đối kháng: Khó vs Dễ, Khó vs Trung bình (N=40/cặp, đổi bên mỗi ván) — đo thắng thực tế
    const duel = (la, lb, n, N2) => {
      let win = 0, loss = 0, draw = 0;
      for (let i = 0; i < N2; i++) {
        const g = E.createGame({ n, first: i % 2 ? 'A' : 'B' });
        const hardIsA = i % 2 === 0;
        let guard = 0;
        while (!E.isOver(g) && guard++ < 400) {
          const isA = g.turn === 'A';
          const lvl = isA ? (hardIsA ? la : lb) : (hardIsA ? lb : la);
          const mv = E.chooseMove(g, { level: lvl, seed: i * 31 + guard });
          if (!mv) break;
          E.applyMove(g, mv);
        }
        const s = E.score(g);
        const mine = hardIsA ? s.A : s.B;
        const theirs = hardIsA ? s.B : s.A;
        if (mine > theirs) win++; else if (mine < theirs) loss++; else draw++;
      }
      return { win, loss, draw, winRate: win / N2 };
    };
    const hVsE = duel('hard', 'easy', 5, 40);
    const hVsM = duel('hard', 'medium', 5, 40);
    return { counts, N, illegal, nulls, hVsE, hVsM };
  })()`);
  need(ai.counts.medium === ai.N && ai.counts.hard === ai.N, 'AI: Trung bình & Khó LUÔN ăn ô khi có cơ hội (60/60 thế)', ai.counts);
  need(ai.counts.easy < ai.counts.medium, 'AI: Dễ THẬT SỰ yếu hơn (bỏ lỡ nước ăn ô) → 3 mức khác biệt hành vi', { easy: ai.counts.easy, medium: ai.counts.medium, hard: ai.counts.hard, of: ai.N });
  need(ai.illegal === 0 && ai.nulls === 0, 'AI: 0 nước không hợp lệ / 0 null trên 3 độ khó × n=3..8 (108 ván)', { illegal: ai.illegal, nulls: ai.nulls });
  need(ai.hVsE.winRate >= 0.85, 'AI: Khó thắng Dễ ≥ 85% (N=40, đổi bên)', ai.hVsE);
  need(ai.hVsM.winRate >= 0.6, 'AI: Khó thắng Trung bình > 60% (N=40, đổi bên)', ai.hVsM);

  /* =====================================================================
   * 3. GIỚI HẠN THỜI GIAN (thật, qua UI thật)
   * ================================================================== */
  // 3a. Hết giờ → mất lượt (10s, tua nhanh bằng cách chờ thật 10.5s)
  await cdp.navigate(URLP('theme=light'));
  const timeoutTest = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 5, first: 'you', timeLimitOn: true, timeSec: 10 });
    await new Promise(r => setTimeout(r, 300));
    const before = g.getState();
    const clockBefore = document.getElementById('hud-clock-text').textContent;
    const t0 = performance.now();
    // chờ tới khi CÓ mất lượt (tối đa 15s) để tránh phụ thuộc độ trễ máy
    const waitUntil = t0 + 15000;
    // "mất lượt" quan sát được = lượt đã đổi (passedTurns của engine không tăng khi hết giờ — ghi nhận ở mục lỗi M-quan sát)
    const seq0 = g.getState().turnSeq;
    while (g.getState().turnSeq === seq0 && performance.now() < waitUntil) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 400));
    const after = g.getState();
    return { before: { turn: before.turn, mc: before.moveCount, seq: before.turnSeq },
      after: { turn: after.turn, mc: after.moveCount, passed: after.passedTurns, over: after.over, seq: after.turnSeq },
      clockBefore, elapsed: Math.round(performance.now() - t0),
      toast: (document.getElementById('toast') || {}).textContent, errors: window.__errors.slice() };
  })()`, { awaitPromise: true });
  need(timeoutTest.after.turn !== timeoutTest.before.turn && timeoutTest.after.seq === timeoutTest.before.seq + 1 && timeoutTest.after.mc === timeoutTest.before.mc,
    'Timer 10s: hết giờ → mất lượt đúng 1 lần, KHÔNG phát sinh nước đi (moveCount không đổi)', timeoutTest);
  need(/Hết giờ/.test(timeoutTest.toast || ''), 'Timer: toast "Hết giờ — mất lượt" hiện đúng', timeoutTest.toast);

  // 3b. Đồng hồ dừng khi mở Luật / Cài đặt (đo trên đồng hồ hiển thị)
  const pauseTest = await cdp.eval(`(async () => {
    const g = window.__game;
    const readClock = () => document.getElementById('hud-clock-text').textContent;
    g.startGame({ mode: 'pvp', size: 5, first: 'you', timeLimitOn: true, timeSec: 20 });
    await new Promise(r => setTimeout(r, 400));
    const t1 = readClock();
    // Mở modal Luật
    document.getElementById('btn-help').click();
    await new Promise(r => setTimeout(r, 2500));
    const t2 = readClock();
    const modalOpen = !document.getElementById('modal').hidden;
    document.querySelector('#modal-close').click();
    await new Promise(r => setTimeout(r, 600));
    const t3 = readClock();
    // Mở Cài đặt
    document.getElementById('btn-settings').click();
    await new Promise(r => setTimeout(r, 2200));
    const t4 = readClock();
    document.querySelector('#modal-close').click();
    await new Promise(r => setTimeout(r, 900));
    const t5 = readClock();
    return { t1, t2, t3, t4, t5, modalOpen, errors: window.__errors.slice() };
  })()`, { awaitPromise: true });
  need(pauseTest.t1 === pauseTest.t2, 'Timer: đồng hồ ĐỨNG khi mở modal Luật (2,5s)', { truoc: pauseTest.t1, trongModal: pauseTest.t2 });
  need(pauseTest.t3 !== pauseTest.t2, 'Timer: đồng hồ chạy tiếp sau khi đóng modal Luật', { trongModal: pauseTest.t2, sauDong: pauseTest.t3 });
  need(pauseTest.t4 === pauseTest.t3, 'Timer: đồng hồ ĐỨNG khi mở Cài đặt', { truoc: pauseTest.t3, trongModal: pauseTest.t4 });
  need(pauseTest.t5 !== pauseTest.t4, 'Timer: đồng hồ chạy tiếp sau khi đóng Cài đặt', pauseTest.t5);

  // 3c. Dừng khi tab ẩn (Emulation.setPageScaleFactor không đổi được hidden → dùng Runtime override document.hidden qua CDP)
  const hiddenTest = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 5, first: 'you', timeLimitOn: true, timeSec: 20 });
    await new Promise(r => setTimeout(r, 600));
    const clockOf = () => document.getElementById('hud-clock-text').textContent;
    const a = clockOf();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(r => setTimeout(r, 2600));
    const b = clockOf();
    const st = g.getState();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(r => setTimeout(r, 1500));
    return { a, b, c: clockOf(), turn: st.turn, seq: st.turnSeq, errors: window.__errors.slice() };
  })()`, { awaitPromise: true });
  need(hiddenTest.a === hiddenTest.b && hiddenTest.seq === 0 && hiddenTest.turn === 'A',
    'Timer: tab ẩn 2,6s → đồng hồ ĐỨNG, không mất lượt', { truoc: hiddenTest.a, khiAn: hiddenTest.b, turn: hiddenTest.turn, seq: hiddenTest.seq });
  need(hiddenTest.b !== hiddenTest.c, 'Timer: tab hiện lại → đồng hồ chạy tiếp', { khiAn: hiddenTest.b, sauHien: hiddenTest.c });

  // 3d. Tắt giới hạn thời gian → không có đồng hồ, không bao giờ mất lượt
  const offTest = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 5, first: 'you', timeLimitOn: false });
    await new Promise(r => setTimeout(r, 300));
    const clockHidden = document.getElementById('hud-clock').hidden;
    const before = { turnSeq: g.getState().turnSeq, turn: g.getState().turn, mc: g.getState().moveCount };
    const clock0 = document.getElementById('hud-clock-text').textContent;
    await new Promise(r => setTimeout(r, 6000));
    const after = g.getState();
    return { clockHidden, before, clock0, clock1: document.getElementById('hud-clock-text').textContent, after: { turnSeq: after.turnSeq, passed: after.passedTurns, turn: after.turn, mc: after.moveCount }, errors: window.__errors.slice() };
  })()`, { awaitPromise: true });
  need(offTest.clockHidden && offTest.after.turnSeq === offTest.before.turnSeq && offTest.after.turn === offTest.before.turn && offTest.after.mc === offTest.before.mc,
    'Timer TẮT: đồng hồ ẩn, chờ 6s → lượt và số nước KHÔNG đổi (không mất lượt)', { clockHidden: offTest.clockHidden, truoc: offTest.before, sau: offTest.after });

  // 3e. 4 mức 10/15/20/30s áp được qua UI trong modal/menu + toast đúng
  const timeOpts = await cdp.eval(`(() => {
    const segs = [...document.querySelectorAll('#screen-menu .segmented__seg')].map(s => s.textContent);
    const clockOpts = [...document.querySelectorAll('.time-picker .segmented__seg')].map(s => s.textContent);
    return { segs, clockOpts };
  })()`);
  need(JSON.stringify(timeOpts.clockOpts) === JSON.stringify(['10 giây', '15 giây', '20 giây', '30 giây']),
    'Chức năng: đủ 4 mốc thời gian 10/15/20/30 giây trong UI', timeOpts.clockOpts);
  const timeApply = await cdp.eval(`(async () => {
    const out = [];
    const g = window.__game;
    const pick = (label) => {
      const b = [...document.querySelectorAll('.time-picker .segmented__seg')].find(x => x.textContent.trim() === label);
      if (b) b.click();
      return !!b;
    };
    for (const [label, sec] of [['30 giây', 30], ['15 giây', 15], ['20 giây', 20], ['10 giây', 10]]) {
      pick(label);
      await new Promise(r => setTimeout(r, 120));
      g.startGame({ mode: 'pvp', size: 5, first: 'you', timeLimitOn: true, timeSec: sec });
      await new Promise(r => setTimeout(r, 500));
      const clock = document.getElementById('hud-clock-text').textContent;
      out.push({ label, sec, clock });
    }
    return { out, errors: window.__errors.slice() };
  })()`, { awaitPromise: true });
  const timeOk = timeApply.out.every((o) => o.clock === `0:${String(o.sec).padStart(2, '0')}` || Math.abs(Number(o.clock.split(':')[1]) - o.sec) <= 1);
  need(timeOk, 'Timer: chọn 10/15/20/30s áp đúng ngay vào ván (đồng hồ hiển thị khớp)', timeApply.out);

  /* =====================================================================
   * 4. KÍCH THƯỚC BÀN 3×3…8×8 + AI ĐI TRƯỚC + OẲN TÙ TÌ
   * ================================================================== */
  const sizes = await cdp.eval(`(async () => {
    const g = window.__game; const out = [];
    for (let n = 3; n <= 8; n++) {
      g.startGame({ mode: 'pvp', size: n, first: 'you', timeLimitOn: false });
      await new Promise(r => setTimeout(r, 120));
      const st = g.getState();
      const c = document.getElementById('board');
      const r = c.getBoundingClientRect();
      out.push({ n, engineN: st.n, remaining: st.remaining, expect: 2 * n * (n - 1), cssW: Math.round(r.width), cssH: Math.round(r.height) });
    }
    return out;
  })()`, { awaitPromise: true });
  const sizeOk = sizes.every((s) => s.engineN === s.n && s.remaining === s.expect && s.cssW > 0 && s.cssW === s.cssH);
  need(sizeOk, 'Chức năng: 6 kích thước 3×3…8×8 — số cạnh trong = 2n(n−1), canvas vuông theo kích thước', sizes);

  const firstTest = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'ai', size: 5, first: 'com', timeLimitOn: false, difficulty: 'easy' });
    await new Promise(r => setTimeout(r, 1800));
    const comFirst = g.getState();
    g.startGame({ mode: 'ai', size: 5, first: 'you', timeLimitOn: false, difficulty: 'easy' });
    await new Promise(r => setTimeout(r, 300));
    const youFirst = g.getState();
    return { comFirst: { turn: comFirst.turn, mc: comFirst.moveCount }, youFirst: { turn: youFirst.turn, mc: youFirst.moveCount }, errors: window.__errors.slice() };
  })()`, { awaitPromise: true });
  need(firstTest.comFirst.mc >= 1 && firstTest.comFirst.turn === 'A', 'Ai đi trước = Máy: máy đi ngay (ít nhất 1 nước) rồi trả lượt cho người chơi', firstTest.comFirst);
  need(firstTest.youFirst.turn === 'A' && firstTest.youFirst.mc === 0, 'Ai đi trước = Bạn: chờ người chơi, máy chưa đi', firstTest.youFirst);
  need(firstTest.errors.length === 0, 'Ai đi trước: 0 lỗi runtime', firstTest.errors);

  // 4a. Oẳn tù tì qua UI THẬT: chọn tay → kết quả đúng luật → ai đi trước khớp
  await cdp.navigate(URLP('theme=light'));
  const rps = await cdp.eval(`(async () => {
    const out = [];
    // Chọn "Oẳn tù tì" ở hàng "Ai đi trước" (nhãn khác nhau giữa 2 chế độ)
    const pickFirst = (label) => {
      const b = [...document.querySelectorAll('#screen-menu .segmented__seg')].find(x => x.textContent.trim() === label);
      if (b) b.click();
      return !!b;
    };
    const LABEL = 'Oẳn tù tì';
    const ok = pickFirst(LABEL);
    const beat = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    const loseTo = { rock: 'paper', paper: 'scissors', scissors: 'rock' };
    for (let i = 0; i < 12; i++) {
      document.getElementById('btn-quick').click();
      await new Promise(r => setTimeout(r, 400));
      const dialogText = document.getElementById('rps-status').textContent;
      const want = ['rock', 'paper', 'scissors'][i % 3];
      const btn = [...document.querySelectorAll('.rps__choice')].find(b => b.dataset.choice === want);
      const mine = (document.getElementById('rps-me').textContent || '').trim();
      btn.click();
      await new Promise(r => setTimeout(r, 900));
      const status = document.getElementById('rps-status').textContent;
      const st = window.__game.getState();
      // Đọc lựa chọn 2 bên từ câu trạng thái
      const m = status.match(/Bạn ra (\\S+), máy ra (\\S+)/);
      const mePick = m && m[1], comPick = m && m[2];
      const VN = { 'Búa': 'rock', 'Bao': 'paper', 'Kéo': 'scissors' };
      const me = VN[mePick], com = VN[comPick];
      let expectWinner = null;
      if (me && com) expectWinner = me === com ? 'tie' : (beat[me] === com ? 'player' : 'com');
      const turnAfter = st.turn;
      const expectTurn = expectWinner === 'player' ? 'A' : 'B';
      out.push({ i, want, minePick: me, com, expectWinner, status, turnAfter, expectTurn, okLaunch: st.screen === 'play' });
      // Kết thúc ván để mở lại
      const g = window.__game;
      if (st.screen === 'play') { for (let k = 0; k < 400 && !g.getState().over; k++) g.playLegalEdge(); await new Promise(r => setTimeout(r, 200)); }
      // Về menu bằng nút "Về menu" ở màn kết quả
      const bm = document.getElementById('btn-result-menu');
      if (bm) bm.click();
      await new Promise(r => setTimeout(r, 300));
    }
    return { okLabel: ok, out, errors: window.__errors.slice() };
  })()`, { awaitPromise: true });
  need(rps.okLabel, 'Oẳn tù tì: có lựa chọn "Oẳn tù tì" ở hàng Ai đi trước', rps.okLabel);
  const rpsWrong = rps.out.filter((r) => !r.minePick || r.minePick !== r.want || r.expectWinner === 'tie' ? false : r.turnAfter !== r.expectTurn);
  const rpsMismatchPick = rps.out.filter((r) => r.minePick !== r.want);
  need(rpsMismatchPick.length === 0, 'Oẳn tù tì: lựa chọn tay (Búa/Bao/Kéo) khớp với câu kết quả', rpsMismatchPick);
  need(rpsWrong.length === 0, 'Oẳn tù tì: ai thắng đúng luật (búa>kéo, bao>búa, kéo>bao) và người thắng ĐI TRƯỚC', rpsWrong.length ? rpsWrong : { check: rps.out.length + ' ván' });
  need(rps.out.every((r) => r.okLaunch), 'Oẳn tù tì: sau khi chọn luôn vào bàn chơi', rps.out.every((r) => r.okLaunch));
  need(rps.errors.length === 0, 'Oẳn tù tì: 0 lỗi runtime', rps.errors);

  /* =====================================================================
   * 5. ÂM THANH — công tắc riêng, không phát trước gesture, không crash
   * ================================================================== */
  const audioCtl = await cdp.eval(`(() => {
    const s = JSON.parse(localStorage.getItem('db_settings') || '{}');
    // Mở Cài đặt để đọc công tắc riêng
    document.getElementById('btn-settings').click();
    return new Promise(r => setTimeout(() => {
      const ids = ['set-sound', 'set-sfx', 'set-bgm', 'set-haptic', 'set-colorblind'];
      const found = ids.map(id => {
        const el = document.getElementById(id);
        return el ? { id, on: el.getAttribute('aria-checked'), h: Math.round(el.getBoundingClientRect().height) } : { id, missing: true };
      });
      document.querySelector('#modal-close').click();
      r({ found, saved: { sound: s.sound, sfx: s.sfx, bgm: s.bgm }, errors: window.__errors.slice() });
    }, 400));
  })()`, { awaitPromise: true });
  need(audioCtl.found.every((f) => !f.missing), 'Âm thanh: Cài đặt có công tắc RIÊNG cho Âm thanh / SFX / Nhạc nền (+ Rung, mù màu)', audioCtl.found);
  need(audioCtl.found.every((f) => f.missing || Number(f.h) >= 44), 'Âm thanh: mọi hàng công tắc cao ≥ 44px (vùng chạm)', audioCtl.found.map((f) => f.h));

  // Audio không phát trước gesture: tạo AudioContext ngay khi load sẽ khiến Chrome log warning —
  // kiểm bằng cách đếm số AudioContext được khởi tạo TRƯỚC thao tác đầu (bọc constructor trước khi trang chạy).
  const cdp2 = await launch();
  await cdp2.call('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__acLog = [];
      (function(){ const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        window.AudioContext = class extends AC { constructor(...a){ window.__acLog.push({at: performance.now(), trusted: window.__hasGesture===true}); super(...a); } };
        window.__markGesture = () => { window.__hasGesture = true; };
        addEventListener('pointerdown', window.__markGesture, true);
        addEventListener('keydown', window.__markGesture, true);
      })();`,
  });
  await cdp2.viewport({ width: 390, height: 844 });
  await cdp2.navigate(URLP('theme=light'), { settle: 1500 });
  const boot2 = await cdp2.waitFor('window.__game && window.__bootOk === true', 8000);
  const preGesture = await cdp2.eval(`({ created: (window.__acLog || []).length, log: window.__acLog || [], boot: window.__bootOk === true, errors: (window.__errors || []).slice() })`);
  need(boot2 && preGesture.boot, 'Âm thanh: app boot bình thường ở lần tải thứ 2 (có script bọc AudioContext)', { boot2, pre: preGesture });
  need(preGesture.created === 0, 'Âm thanh: KHÔNG tạo AudioContext trước thao tác đầu (0 context lúc tải)', preGesture);
  // Thao tác thật (click) → được phép unlock
  await cdp2.click(195, 300);
  await sleep(500);
  const postGesture = await cdp2.eval(`({ created: (window.__acLog || []).length, errors: (window.__errors || []).slice() })`);
  need(postGesture.created >= 1, 'Âm thanh: sau gesture THẬT thì AudioContext được tạo/mở khoá', postGesture);
  need(postGesture.errors.length === 0, 'Âm thanh: không lỗi JS khi mở khoá audio', postGesture.errors);

  // AudioContext ném lỗi / luôn suspended → app không sập
  const cdp3 = await launch();
  await cdp3.call('Page.addScriptToEvaluateOnNewDocument', {
    source: `(function(){ window.AudioContext = class { constructor(){ throw new Error('AudioContext bị chặn (giả lập)'); }
      resume(){ return Promise.reject(new Error('blocked')); } }; window.webkitAudioContext = window.AudioContext; })();`,
  });
  await cdp3.viewport({ width: 390, height: 844 });
  await cdp3.navigate(URLP('theme=light'), { settle: 800 });
  const blockedAudio = await cdp3.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 4, first: 'you', timeLimitOn: false });
    await new Promise(r => setTimeout(r, 200));
    for (let i = 0; i < 6; i++) { g.playLegalEdge(); await new Promise(r => setTimeout(r, 60)); }
    try { document.getElementById('btn-sound').click(); } catch (e) {}
    await new Promise(r => setTimeout(r, 300));
    return { mc: g.getState().moveCount, screen: g.getState().screen, errors: window.__errors.slice() };
  })()`, { awaitPromise: true });
  need(blockedAudio.mc === 6 && blockedAudio.errors.length === 0, 'Âm thanh: AudioContext bị CHẶN/NÉM LỖI → game vẫn chạy, 0 lỗi JS', blockedAudio);
  await cdp3.close();

  /* =====================================================================
   * 6. TUTORIAL — 5 bước đúng kịch bản, Bỏ qua mọi lúc, lưu db_tutorial_done
   * ================================================================== */
  await cdp.navigate(URLP('theme=light'));
  await cdp.eval(`localStorage.removeItem('db_tutorial_done'); localStorage.removeItem('db_tooltip_seen'); true`);
  await cdp.navigate(URLP('theme=light'));
  const guideFirst = await cdp.eval(`({ guideVisible: !document.getElementById('screen-guide').hidden, cards: document.querySelectorAll('.guide-card').length,
    buttons: [...document.querySelectorAll('#screen-guide button')].map(b => b.textContent.trim()) })`);
  need(guideFirst.guideVisible && guideFirst.cards === 3, 'Tutorial: lần đầu mở game tự hiện "Hướng dẫn nhanh" 3 thẻ', guideFirst);
  need(guideFirst.buttons.some((t) => /Chơi thử Tutorial/.test(t)) && guideFirst.buttons.some((t) => /Bỏ qua/.test(t)),
    'Tutorial: màn nhanh có nút "Chơi thử Tutorial" + "Bỏ qua"', guideFirst.buttons);

  // 6a. Chạy tutorial thật từ đầu, TÔ CẠNH BẰNG CHUỘT THẬT (pointer events trên canvas)
  const tutRun = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ tutorial: true });
    await new Promise(r => setTimeout(r, 500));
    const steps = [];
    const snap = () => { const s = g.getState(); return { step: s.tutorial, score: s.score, turn: s.turn, mc: s.moveCount }; };
    steps.push({ ...snap(), text: document.getElementById('tut-text').textContent, hint: document.getElementById('tut-hint').textContent, label: document.getElementById('tut-step').textContent, rslabel: 'Bỏ qua' });
    return { steps, errors: window.__errors.slice() };
  })()`, { awaitPromise: true });
  need(tutRun.steps[0].step === 1 && /Bấm vào một đoạn thẳng để tô nó/.test(tutRun.steps[0].text),
    'Tutorial bước 1: câu hướng dẫn nguyên văn', tutRun.steps[0]);

  // Vẽ cạnh bằng CHUỘT THẬT lên canvas: cạnh ngang [1,1,'H'] của bàn 3×3
  async function clickEdge(edge) {
    const pt = await cdp.eval(`(() => {
      const c = document.getElementById('board');
      const r = c.getBoundingClientRect();
      const n = window.__game.getState().n;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      // Lấy geometry thật từ renderer qua kích thước CSS: pad = width<480 ? 16 : 20
      const side = r.width; const pad = side < 480 ? 16 : 20; const step = (side - 2 * pad) / n;
      const [er, ec, eo] = ${JSON.stringify(edge)};
      const x = r.left + pad + (eo === 'H' ? ec * step + step / 2 : ec * step);
      const y = r.top + pad + (eo === 'H' ? er * step : er * step + step / 2);
      return { x, y };
    })()`);
    await cdp.click(pt.x, pt.y);
    await sleep(180);
    return pt;
  }
  const pt1 = await clickEdge([1, 1, 'H']);
  await sleep(900);
  const after1 = await cdp.eval(`({ tutorial: window.__game.getState().tutorial, mc: window.__game.getState().moveCount, n: window.__game.getState().n })`);
  need(after1.tutorial === 2 && after1.mc === 2, 'Tutorial: bấm CHUỘT THẬT vào cạnh [1,1,H] (bước 1) → sang bước 2; bàn bước 2 = seed đúng (2 cạnh của kịch bản)', { pt: pt1, step: after1.tutorial, mc: after1.mc });

  await clickEdge([0, 1, 'V']);
  await sleep(300);
  const after2a = await cdp.eval(`({ score: window.__game.getState().score, turn: window.__game.getState().turn, hint: document.getElementById('tut-hint').textContent })`);
  await sleep(1300);
  const after2b = await cdp.eval(`({ tutorial: window.__game.getState().tutorial })`);
  need(after2a.score.A === 1 && after2a.turn === 'A', 'Tutorial bước 2: bấm [0,1,V] → ăn đúng 1 ô (+1 điểm) và GIỮ lượt (không chuyển sang máy)', { a: after2a.score, turn: after2a.turn, hint: after2a.hint });
  need(after2b.tutorial === 3, 'Tutorial: bước 2 → tự sang bước 3 sau ~1,2s', after2b.tutorial);

  // Bước 3: bấm cạnh an toàn [1,2,'V'] → máy đi [2,1,'H']
  await clickEdge([1, 2, 'V']);
  await sleep(1400);
  const after3 = await cdp.eval(`({ tutorial: window.__game.getState().tutorial, mc: window.__game.getState().moveCount })`);
  need(after3.tutorial === 4 && after3.mc === 2, 'Tutorial bước 3: người chơi đi 1 cạnh → MÁY đi 1 cạnh → sang bước 4 (bàn = seed bước 4, 2 cạnh)', after3);

  // Bước 4: cạnh mồi [2,1,'V'] phải bị hoàn tác
  await clickEdge([2, 1, 'V']);
  await sleep(250);
  const decoyMid = await cdp.eval(`({ hint: document.getElementById('tut-hint').textContent, cls: document.getElementById('tut-hint').className })`);
  await sleep(1100);
  const decoyAfter = await cdp.eval(`({ tutorial: window.__game.getState().tutorial, mc: window.__game.getState().moveCount })`);
  need(decoyMid.hint === 'Cạnh đó mở ô cho máy mất rồi. Thử lại nhé.' && /is-fail/.test(decoyMid.cls),
    'Tutorial bước 4: bấm cạnh mồi hiện câu lỗi nguyên văn (đỏ)', decoyMid);
  need(decoyAfter.tutorial === 4 && decoyAfter.mc === 2, 'Tutorial bước 4: cạnh mồi ĐƯỢC HOÀN TÁC (bàn về đúng seed bước 4 = 2 cạnh, vẫn ở bước 4)', decoyAfter);
  // Bấm cạnh an toàn → qua bước 5
  await clickEdge([2, 1, 'H']);
  await sleep(1200);
  const after4 = await cdp.eval(`({ tutorial: window.__game.getState().tutorial, finishHidden: document.getElementById('btn-tut-finish').hidden })`);
  need(after4.tutorial === 5 && after4.finishHidden === false, 'Tutorial bước 4 → bước 5 khi chọn cạnh an toàn; bước 5 có nút "Xong"', after4);

  // Bước 5: bấm 1 control THẬT trong khối #tut-options → toast câu chốt; bàn phải KHOÁ
  const step5 = await cdp.eval(`(async () => {
    const g = window.__game;
    const before = g.getState();
    const optBox = document.getElementById('tut-options');
    const optVisible = !!optBox && !optBox.hidden && optBox.getBoundingClientRect().height > 0;
    const optBtns = optBox ? [...optBox.querySelectorAll('.segmented__seg')].map((b) => b.textContent.trim()) : [];
    // Bàn phải KHOÁ: thử bấm cạnh qua API → không được đổi state
    const locked = g.playEdge([1, 1, 'H']);
    const afterLocked = g.getState();
    // Bấm control "4×4" THẬT trong khối tùy chọn
    const b = optBox ? [...optBox.querySelectorAll('.segmented__seg')].find((x) => x.textContent.trim() === '4×4') : null;
    // Tap that = pointerdown + pointerup (dung chuoi touch that; hon .click() lap trinh khong sinh pointerup)
    if (b) {
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
      b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
      b.click();
    }
    await new Promise((r) => setTimeout(r, 350));
    const toast = document.getElementById('toast').textContent;
    const finish = document.getElementById('btn-tut-finish');
    const finishLabel = finish.textContent.trim();
    finish.click();
    await new Promise((r) => setTimeout(r, 700));
    const st = g.getState();
    return { before: { t: before.tutorial, mc: before.moveCount }, optVisible, optBtns, locked: locked.ok, lockedMc: afterLocked.moveCount,
      toast, finishLabel, st: { screen: st.screen, t: st.tutorial, n: st.n, d: st.difficulty },
      done: localStorage.getItem('db_tutorial_done'), errors: window.__errors.slice() };
  })()`, { awaitPromise: true });
  need(step5.optVisible && step5.optBtns.includes('4×4') && step5.optBtns.includes('Khó'),
    'Tutorial bước 5: hàng tùy chọn THẬT (kích thước / độ khó) hiện được dưới bàn', { visible: step5.optVisible, controls: step5.optBtns });
  need(step5.locked === false && step5.lockedMc === step5.before.mc, 'Tutorial bước 5: bàn KHOÁ (bấm cạnh không tạo nước đi)', { ok: step5.locked, mc: step5.lockedMc });
  need(/Hết hướng dẫn/.test(step5.toast) && step5.finishLabel === 'Chơi ván đầu tiên',
    'Tutorial bước 5: bấm control thật → câu chốt + nút đổi thành "Chơi ván đầu tiên"', { toast: step5.toast, label: step5.finishLabel });
  need(step5.done === 'true', 'Tutorial: sau nút kết thúc lưu db_tutorial_done = true', step5.done);
  need(step5.st.screen === 'play' && step5.st.n === 3 && step5.st.d === 'easy', 'Tutorial: kết thúc mở ván thật 3×3 độ khó Dễ', step5.st);
  need(step5.errors.length === 0, 'Tutorial: 0 lỗi runtime trong toàn bộ 5 bước', step5.errors);

  // 6b. Chạy lại được từ menu
  const rerun = await cdp.eval(`(async () => {
    [...document.querySelectorAll('#screen-play button, #screen-menu button')].forEach(()=>{});
    // về menu
    const back = document.getElementById('btn-back'); back.click();
    await new Promise(r => setTimeout(r, 300));
    const ok = document.getElementById('confirm-ok'); if (ok) ok.click();
    await new Promise(r => setTimeout(r, 400));
    const inMenu = !document.getElementById('screen-menu').hidden;
    const guideBtn = document.getElementById('btn-guide');
    guideBtn.click();
    await new Promise(r => setTimeout(r, 400));
    const guideShown = !document.getElementById('screen-guide').hidden;
    document.getElementById('btn-guide-start').click();
    await new Promise(r => setTimeout(r, 500));
    const st = window.__game.getState();
    return { inMenu, guideShown, step: st.tutorial, screen: st.screen, errors: window.__errors.slice() };
  })()`, { awaitPromise: true });
  need(rerun.guideShown && rerun.step === 1, 'Tutorial: chạy LẠI được từ menu ("Hướng dẫn" → "Chơi thử Tutorial") dù đã db_tutorial_done', rerun);
  // "Bỏ qua" ở bước 1
  const skipMid = await cdp.eval(`(async () => {
    document.getElementById('btn-tut-skip').click();
    await new Promise(r => setTimeout(r, 500));
    const st = window.__game.getState();
    return { st, done: localStorage.getItem('db_tutorial_done'), errors: window.__errors.slice() };
  })()`, { awaitPromise: true });
  need(skipMid.st.tutorial === null && skipMid.st.screen === 'play' && skipMid.st.n === 3 && skipMid.st.difficulty === 'easy',
    'Tutorial: "Bỏ qua" ở bước 1 → vào thẳng ván 3×3 Dễ', { t: skipMid.st.tutorial, screen: skipMid.st.screen, n: skipMid.st.n });
  // "Bỏ qua" ở bước 3 / bước 1 ĐANG CHỜ TIMER chuyển bước → phải huỷ timer, không được nhảy lại tutorial
  const skip3 = await cdp.eval(`(async () => {
    const g = window.__game;
    // (a) Bước 1: bấm 1 cạnh hợp lệ (timer advance 700ms đang chạy) rồi BỎ QUA ngay
    g.startGame({ tutorial: true }); await new Promise(r => setTimeout(r, 300));
    g.playEdge([1, 1, 'H']);
    document.getElementById('btn-tut-skip').click();
    const stNow = g.getState();
    await new Promise(r => setTimeout(r, 1300));
    const st1 = g.getState();
    // (b) Bước 3: tô cạnh an toàn (máy hẹn 600ms, chuyển bước 900ms) rồi BỎ QUA ngay
    g.startGame({ tutorial: true }); await new Promise(r => setTimeout(r, 300));
    g.gotoTutorialStep(3); await new Promise(r => setTimeout(r, 300));
    const stepLabel = document.getElementById('tut-step').textContent;
    g.playEdge([1, 2, 'V']);
    document.getElementById('btn-tut-skip').click();
    await new Promise(r => setTimeout(r, 1700));
    const st2 = g.getState();
    return { stepLabel, stNow, st1, st2, errors: window.__errors.slice() };
  })()`, { awaitPromise: true });
  need(skip3.stNow.tutorial === null && skip3.st1.tutorial === null && skip3.st1.screen === 'play',
    'Tutorial: "Bỏ qua" ở bước 1 KHI TIMER chuyển bước đang chạy → vẫn ở ván thật, KHÔNG bị kéo lại tutorial sau 0,7s',
    { now: skip3.stNow.tutorial, sau1300ms: { t: skip3.st1.tutorial, screen: skip3.st1.screen } });
  need(/Bước 3/.test(skip3.stepLabel) && skip3.st2.tutorial === null && skip3.st2.screen === 'play',
    'Tutorial: "Bỏ qua" ở bước 3 khi MÁY ĐANG ĐI → không double-move, không nhảy lại tutorial', { label: skip3.stepLabel, after: skip3.st2 });
  need(skip3.errors.length === 0, 'Tutorial: 0 lỗi khi bỏ qua giữa chừng', skip3.errors);

  /* =====================================================================
   * 7. QUẢNG CÁO HOOK — đếm lời gọi MOCK trên 3 ván liên tiếp + CLS
   * ================================================================== */
  await cdp.navigate(URLP('theme=light'));
  const ads = await cdp.eval(`(async () => {
    const g = window.__game;
    const st = window.AdBridge._state;
    const perGame = [];
    for (let k = 0; k < 3; k++) {
      const s0 = st.interstitialShown;
      g.startGame({ mode: 'pvp', size: 3, first: 'you', timeLimitOn: false });
      await new Promise(r => setTimeout(r, 200));
      let guard = 0;
      while (!g.getState().over && guard++ < 100) { g.playLegalEdge(); await new Promise(r => setTimeout(r, 5)); }
      // Trong 1,15s đầu màn kết quả KHÔNG được hiện interstitial
      await new Promise(r => setTimeout(r, 1150));
      const duringEarly = st.interstitialShown - s0;
      const midToast = document.getElementById('toast').textContent;
      await new Promise(r => setTimeout(r, 900));
      const total = st.interstitialShown - s0;
      perGame.push({ game: k + 1, duringEarly, total, gamesCompleted: st.gamesCompleted, toastEarly: midToast, toastLate: document.getElementById('toast').textContent });
      document.getElementById('btn-result-menu').click();
      await new Promise(r => setTimeout(r, 500));
    }
    return { perGame, adState: JSON.parse(JSON.stringify(st)), errors: window.__errors.slice() };
  })()`, { awaitPromise: true });
  need(ads.perGame.every((p) => p.duringEarly === 0), 'Quảng cáo: KHÔNG interstitial trong 1,15s đầu màn kết quả (yêu cầu ≥1,2s)', ads.perGame.map((p) => ({ game: p.game, duringEarly: p.duringEarly })));
  const shownGames = ads.perGame.filter((p) => p.total > 0).map((p) => p.game);
  need(JSON.stringify(shownGames) === JSON.stringify([2]),
    'Quảng cáo: 3 ván liên tiếp → interstitial hiện ĐÚNG 1 lần (ván 2) = "tối đa 1 lần/2 ván"', { shownGames, perGame: ads.perGame });
  need(ads.adState.rewardedShown === 0, 'Quảng cáo: KHÔNG gọi rewarded trong ván thường / tutorial (chỉ ở "Gợi ý nước đi")', ads.adState.rewardedShown);
  need(ads.errors.length === 0, 'Quảng cáo: 0 lỗi runtime trong 3 ván', ads.errors);

  // 7b. CLS trong 3s đầu (PerformanceObserver['layout-shift'])
  const cls = await cdp.eval(`(async () => {
    // đo lại từ đầu: reload với observer gắn sớm nhất có thể
    return new Promise((resolve) => {
      let sum = 0; const entries = [];
      try {
        new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (!e.hadRecentInput) { sum += e.value; entries.push(e.value); } } })
          .observe({ type: 'layout-shift', buffered: true });
      } catch (e) { resolve({ unsupported: String(e) }); return; }
      const t0 = performance.now();
      setTimeout(() => resolve({ cls: sum, entries, ms: Math.round(performance.now() - t0), adSlotH: document.getElementById('ad-slot').getBoundingClientRect().height }), 3000);
    });
  })()`, { awaitPromise: true });
  const clsFresh = await (async () => {
    await cdp.call('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.__cls = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}`,
    });
    await cdp.navigate(URLP('theme=light'), { settle: 2400 });
    return cdp.eval(`({ cls: window.__cls, adSlotH: document.getElementById('ad-slot').getBoundingClientRect().height })`);
  })();
  need(clsFresh.cls <= 0.001, 'Quảng cáo: CLS (layout-shift) trong ~3s đầu = 0 (khung banner ' +  clsFresh.adSlotH + 'px chừa sẵn)', clsFresh);

  // 7c. Banner không làm nhảy layout: đo vị trí nút trước/sau khi banner hiện
  const bannerShift = await cdp.eval(`(async () => {
    const g = window.__game;
    const vis = () => [...document.querySelectorAll('button')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => Math.round(b.getBoundingClientRect().top));
    const out = {};
    const finishGame = async () => {
      g.startGame({ mode: 'pvp', size: 3, first: 'you', timeLimitOn: false });
      await new Promise((r) => setTimeout(r, 200));
      let k = 0;
      while (!g.getState().over && k++ < 60) { g.playLegalEdge(); await new Promise((r) => setTimeout(r, 8)); }
      await new Promise((r) => setTimeout(r, 700));
    };
    const measure = async (name) => {
      window.AdBridge.hideBanner(); await new Promise((r) => setTimeout(r, 150));
      const before = vis();
      window.AdBridge.showBanner(); await new Promise((r) => setTimeout(r, 300));
      const after = vis();
      out[name] = { n: before.length, moved: before.filter((t, i) => t !== after[i]).length,
        adH: Math.round(document.getElementById('ad-slot').getBoundingClientRect().height) };
    };
    await measure('menu');
    await finishGame();
    await measure('result');
    document.getElementById('btn-result-menu').click();
    await new Promise((r) => setTimeout(r, 400));
    return out;
  })()`, { awaitPromise: true });
  need(Object.values(bannerShift).every((v) => v.moved === 0 && v.adH === 50 && v.n > 0),
    'Quảng cáo: banner hiện/ẩn KHÔNG dịch chuyển nút nào (menu + màn kết quả), khung 50px chừa sẵn', bannerShift);

  // 7d. Interstitial không bao giờ xen giữa ván: gọi khi đang chơi → từ chối
  const inGame = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 5, first: 'you', timeLimitOn: false });
    await new Promise(r => setTimeout(r, 200));
    g.playLegalEdge();
    const res = await window.AdBridge.showInterstitial({ sinceResultMs: 5000, inGame: true });
    return { res, state: g.getState() };
  })()`, { awaitPromise: true });
  need(inGame.res.shown === false && inGame.res.reason === 'in-game', 'Quảng cáo: gọi interstitial khi ĐANG CHƠI bị từ chối (in-game)', inGame.res);

  /* =====================================================================
   * 8. LƯU CÀI ĐẶT — reload giữ nguyên; localStorage lỗi không sập
   * ================================================================== */
  const persist = await cdp.eval(`(async () => {
    const pick = (segId, label) => [...document.querySelectorAll('#' + segId + ' .segmented__seg')].find((x) => x.textContent.trim() === label);
    window.__game.setTheme('dark');                       // nút theme → lưu cài đặt
    await new Promise((r) => setTimeout(r, 120));
    pick('seg-size', '7×7')?.click();
    await new Promise((r) => setTimeout(r, 150));
    pick('seg-difficulty', 'Khó')?.click();
    await new Promise((r) => setTimeout(r, 150));
    document.getElementById('btn-sound').click();          // tắt âm thanh
    await new Promise((r) => setTimeout(r, 350));
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('db_settings') || 'null'); } catch (e) { saved = String(e); }
    // công tắc RIÊNG nhạc/SFX phải lưu được: mở Cài đặt, tắt "Nhạc nền"
    document.getElementById('btn-settings').click();
    await new Promise((r) => setTimeout(r, 300));
    const bgm = document.getElementById('set-bgm');
    const bgmBefore = bgm && bgm.getAttribute('aria-checked');
    if (bgm) bgm.click();
    await new Promise((r) => setTimeout(r, 250));
    let saved2 = null;
    try { saved2 = JSON.parse(localStorage.getItem('db_settings') || 'null'); } catch (e) { saved2 = String(e); }
    document.querySelector('#modal-close')?.click();
    return { saved, saved2, bgmBefore, bgmAfter: bgm && bgm.getAttribute('aria-checked') };
  })()`, { awaitPromise: true });
  await cdp.navigate(URLP(''), { settle: 1100 });   // KHÔNG có ?theme= để đọc từ localStorage
  await cdp.waitFor('window.__game && window.__bootOk === true', 6000);
  const afterReload = await cdp.eval(`(() => {
    const s = window.__game ? window.__game.getState() : null;
    const checked = (segId) => { const el = document.querySelector('#' + segId + ' .segmented__seg[aria-checked="true"]'); return el ? el.textContent.trim() : null; };
    return { theme: document.documentElement.getAttribute('data-theme'), st: s ? s.theme : null,
      size: checked('seg-size'), diff: checked('seg-difficulty'),
      sound: document.getElementById('btn-sound').getAttribute('aria-pressed'),
      bg: getComputedStyle(document.documentElement).getPropertyValue('--surface-0').trim() };
  })()`);
  need(persist.saved && persist.saved.theme === 'dark' && afterReload.theme === 'dark' && afterReload.bg === '#0B0E13',
    'Lưu cài đặt: theme "dark" giữ sau RELOAD (và nền thật là #0B0E13)', { saved: persist.saved, reload: afterReload });
  need(afterReload.size === '7×7' && afterReload.diff === 'Khó',
    'Lưu cài đặt: kích thước 7×7 + độ khó Khó giữ sau reload', { size: afterReload.size, diff: afterReload.diff });
  need(persist.saved && persist.saved.sound === false && afterReload.sound === 'false',
    'Lưu cài đặt: tắt âm thanh giữ sau reload', { saved: persist.saved, reload: afterReload.sound });
  need(persist.bgmBefore === 'true' && persist.bgmAfter === 'false' && persist.saved2 && persist.saved2.bgm === false,
    'Lưu cài đặt: công tắc RIÊNG "Nhạc nền" trong Cài đặt ghi được vào localStorage', { truoc: persist.bgmBefore, sau: persist.bgmAfter, bgm: persist.saved2 && persist.saved2.bgm });

  // localStorage ném lỗi khi đọc/ghi → app vẫn boot, chơi được
  const cdp4 = await launch();
  await cdp4.call('Page.addScriptToEvaluateOnNewDocument', {
    source: `Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('SecurityError', 'SecurityError'); } });`,
  });
  await cdp4.viewport({ width: 390, height: 844 });
  await cdp4.navigate(URLP('theme=light'), { settle: 800 });
  const lsBroken = await cdp4.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 4, first: 'you', timeLimitOn: false });
    await new Promise(r => setTimeout(r, 200));
    for (let i = 0; i < 5; i++) { g.playLegalEdge(); await new Promise(r => setTimeout(r, 30)); }
    return { mc: g.getState().moveCount, screen: g.getState().screen, errors: window.__errors.slice(), boot: window.__bootOk };
  })()`, { awaitPromise: true });
  need(lsBroken.boot === true && lsBroken.mc === 5 && lsBroken.errors.length === 0, 'Lưu cài đặt: localStorage ném SecurityError → vẫn boot + chơi được, 0 lỗi JS', lsBroken);
  await cdp4.close();

  /* =====================================================================
   * 9. LỖI CONSOLE TOÀN CỤC cho các luồng vừa chạy
   * ================================================================== */
  need(cdp.filteredErrors().length === 0, 'Chức năng: 0 lỗi console/JS tích luỹ sau toàn bộ luồng A', cdp.filteredErrors());

  const res = summary('Nhóm A — Chức năng & Luật');
  writeReport('qc/out/functional.json', { title: 'A. Chức năng & Luật', base: BASE, ...res });
  await cdp.close();
  await cdp2.close();
  process.exit(res.fail ? 1 : 0);
} catch (e) {
  console.error('LỖI HARNESS:', e);
  try { await cdp.close(); } catch { /* bỏ qua */ }
  process.exit(2);
}
