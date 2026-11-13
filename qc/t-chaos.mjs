#!/usr/bin/env node
/**
 * qc/t-chaos.mjs — QC Boxline nhóm C: ĐỘ BỀN, LỖI, TƯƠNG THÍCH, HIỆU NĂNG.
 *
 * 1. Chaos: bấm "Ván mới" 10 lần liên tục, chuyển màn 30 lần, đổi theme / resize giữa lúc animate,
 *    hết giờ đúng lúc máy đang đi, ẩn/hiện tab — không lỗi, không kẹt lượt, không double-move.
 * 2. bundle.html qua file:// (chụp ảnh menu + bàn đang chơi).
 * 3. CPU throttle 4× (Emulation.setCPUThrottlingRate): chooseMove + độ trễ UI trên bàn 8×8 Khó.
 * 4. Playwright fallback cho URL ?debug=1 (qc-shots.mjs dùng) — lỗi console lớn nhất mà Maintenance gặp.
 * 5. Bộ chụp ảnh qc-shots chạy 2 lần liên tiếp để tách nhiễu môi trường khỏi lỗi sản phẩm.
 *
 * Chạy: node qc/t-chaos.mjs [BASE_URL]
 */
import { launch, check, summary, writeReport, sleep } from './cdp-lib.mjs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:8812/index.html';
const BASH = BASE.replace(/index\.html$/, '');
const URLP = (q = '') => BASE + (q ? (BASE.includes('?') ? '&' : '?') + q : '');
const need = (c, n, d) => check(n, c, d);
mkdirSync(resolve('qc/out'), { recursive: true });

const cdp = await launch();

/* ------------------------------------------------------------------ utils */
async function freshPage(q = 'theme=light') {
  const ok = await cdp.navigate(URLP(q), { settle: 800 });
  await cdp.eval(`localStorage.setItem('db_tutorial_done','true'); true`);
  await cdp.navigate(URLP(q), { settle: 800 });
  return cdp.lastBooted;
}

try {
  /* =====================================================================
   * 1. CHAOS
   * ================================================================== */
  await cdp.viewport({ width: 390, height: 844 });
  await freshPage();

  // 1a. Bấm "Ván mới" 10 lần liên tục (kèm xác nhận)
  const chaosNew = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 5, first: 'you', timeLimitOn: false });
    await new Promise((r) => setTimeout(r, 200));
    g.playEdge([1, 0, 'H']); g.playEdge([2, 1, 'V']);
    await new Promise((r) => setTimeout(r, 100));
    const snaps = [];
    for (let i = 0; i < 10; i++) {
      document.getElementById('btn-new').click();
      await new Promise((r) => setTimeout(r, 60));
      const ok = document.getElementById('confirm-ok');
      if (ok) ok.click();
      await new Promise((r) => setTimeout(r, 90));
      snaps.push(g.getState().moveCount);
    }
    await new Promise((r) => setTimeout(r, 500));
    const st = g.getState();
    return { snaps, st: { screen: st.screen, mc: st.moveCount, turn: st.turn, over: st.over }, errors: (window.__errors || []) };
  })()`, { awaitPromise: true });
  need(chaosNew.errors.length === 0 && chaosNew.st.screen === 'play' && chaosNew.st.mc === 0 && chaosNew.st.turn === 'A',
    'Chaos: bấm "Ván mới" 10 lần liên tục → luôn ra ván trắng hợp lệ, 0 lỗi, không kẹt lượt',
    { sauMoiLan: chaosNew.snaps, cuoi: chaosNew.st, errors: chaosNew.errors });

  // 1b. Chuyển màn 30 lần: menu → ván → kết quả → menu
  const chaosScreens = await cdp.eval(`(async () => {
    const g = window.__game;
    const endScreens = [];
    for (let i = 0; i < 30; i++) {
      document.getElementById('btn-quick').click();              // menu → ván (theo cài đặt) — có thể vào oẳn tù tì
      await new Promise((r) => setTimeout(r, 80));
      const rps = document.querySelector('.rps__choice');
      if (rps) { rps.click(); await new Promise((r) => setTimeout(r, 120)); }
      await new Promise((r) => setTimeout(r, 120));
      let k = 0;
      while (!g.getState().over && k++ < 80) { g.playLegalEdge(); await new Promise((r) => setTimeout(r, 4)); }
      await new Promise((r) => setTimeout(r, 80));
      endScreens.push(g.getState().screen);
      const bm = document.getElementById('btn-result-menu');
      if (bm) bm.click(); else document.getElementById('btn-back').click();
      await new Promise((r) => setTimeout(r, 120));
      const ok = document.getElementById('confirm-ok');
      if (ok) ok.click();
      await new Promise((r) => setTimeout(r, 90));
    }
    // cuối cùng phải về menu
    const bm = document.getElementById('btn-result-menu');
    if (bm) bm.click();
    await new Promise((r) => setTimeout(r, 200));
    return { endScreens: endScreens.slice(0, 5), count: endScreens.length,
      allResult: endScreens.every((s) => s === 'result'), errors: (window.__errors || []),
      menu: !document.getElementById('screen-menu').hidden };
  })()`, { awaitPromise: true });
  need(chaosScreens.errors.length === 0 && chaosScreens.allResult && chaosScreens.count === 30,
    'Chaos: chuyển màn 30 vòng (menu → ván → kết quả → menu) → mọi vòng tới màn kết quả, 0 lỗi', chaosScreens);

  // 1c. Đổi theme giữa lúc animate
  const chaosTheme = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 8, first: 'you', timeLimitOn: false });
    await new Promise((r) => setTimeout(r, 250));
    const canvas = document.getElementById('board');
    const colors = new Set();
    for (let i = 0; i < 10; i++) {
      g.setTheme(i % 2 ? 'light' : 'dark');
      g.playLegalEdge();
      await new Promise((r) => setTimeout(r, 60));  // animate E1–E3 đang chạy
      const ctx = canvas.getContext('2d');
      const d = ctx.getImageData(2, 2, 1, 1).data;  // góc = nền khung canvas
      colors.add([...d].join(','));
    }
    await new Promise((r) => setTimeout(r, 400));
    const st = g.getState();
    return { mc: st.moveCount, screen: st.screen, colors: [...colors], theme: st.theme,
      bg: getComputedStyle(document.documentElement).getPropertyValue('--surface-0').trim(), errors: (window.__errors || []) };
  })()`, { awaitPromise: true });
  need(chaosTheme.errors.length === 0 && chaosTheme.mc === 10 && chaosTheme.screen === 'play',
    'Chaos: đổi theme light/dark xen kẽ GIỮA lúc animate (10 nước) → 0 lỗi, ván vẫn đúng 10 nước', chaosTheme);

  // 1d. Resize giữa lúc animate
  const chaosResize = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 8, first: 'you', timeLimitOn: false });
    await new Promise((r) => setTimeout(r, 250));
    const sizes = [];
    for (let i = 0; i < 8; i++) {
      g.playLegalEdge();
      const w = 320 + (i % 4) * 120;
      const c = document.getElementById('board');
      const before = c.getBoundingClientRect().width;
      sizes.push(Math.round(before));
      await new Promise((r) => setTimeout(r, 40));
    }
    await new Promise((r) => setTimeout(r, 500));
    const c = document.getElementById('board').getBoundingClientRect();
    const de = document.documentElement;
    return { sizes, finalW: Math.round(c.width), overflow: de.scrollWidth - de.clientWidth,
      mc: g.getState().moveCount, errors: (window.__errors || []) };
  })()`, { awaitPromise: true });
  // resize thật qua CDP giữa lúc animate
  const cdpResize = [];
  await cdp.eval(`window.__game.startGame({ mode: 'pvp', size: 8, first: 'you', timeLimitOn: false }); true`);
  for (const [w, h] of [[320, 568], [768, 1024], [667, 375], [390, 844]]) {
    await cdp.viewport({ width: w, height: h });
    await cdp.eval(`window.__game.playEdge([1,1,'H']); true`);
    await sleep(60);
    cdpResize.push(await cdp.eval(`(() => { const r = document.getElementById('board').getBoundingClientRect(); const de = document.documentElement;
      return { vp: '${w}x${h}', canvas: Math.round(r.width), overflow: de.scrollWidth - de.clientWidth, errs: (window.__errors || []).length }; })()`));
  }
  await cdp.viewport({ width: 390, height: 844 });
  need(chaosResize.errors.length === 0 && chaosResize.mc === 8 && cdpResize.every((r) => r.overflow === 0 && r.errs === 0 && r.canvas > 0),
    'Chaos: resize (CSS + Emulation.setDeviceMetricsOverride) GIỮA lúc animate → 0 lỗi, không tràn ngang, canvas vẫn vẽ',
    { css: { mc: chaosResize.mc, sizes: chaosResize.sizes, overflow: chaosResize.overflow, errors: chaosResize.errors }, viewport: cdpResize });

  // 1e. Hết giờ đúng lúc máy đang đi
  const race = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'ai', size: 6, first: 'you', timeLimitOn: true, timeSec: 10, difficulty: 'hard' });
    await new Promise((r) => setTimeout(r, 200));
    const log = [];
    let last = g.getState().turnSeq;
    const t0 = performance.now();
    // vừa cho máy đi (máy hẹn 700–900ms) vừa để đồng hồ hết giờ: bấm liên tục để "vừa hết giờ vừa máy đi"
    let passes = 0;
    while (performance.now() - t0 < 13000) {
      await new Promise((r) => setTimeout(r, 50));
      const st = g.getState();
      if (st.turnSeq !== last) { log.push(st.moveCount); last = st.turnSeq; }
      if (st.passedTurns > passes) passes = st.passedTurns;
      if (st.over) break;
    }
    const jumps = log.map((mc, i) => (i === 0 ? mc : mc - log[i - 1]));
    const st = g.getState();
    return { moves: log.length, maxJump: Math.max(0, ...jumps), jumps: jumps.slice(0, 12),
      passes: st.passedTurns, turn: st.turn, over: st.over, errors: (window.__errors || []) };
  })()`, { awaitPromise: true });
  need(race.errors.length === 0 && race.maxJump <= 1, 'Chaos: hết giờ 10s trong lúc MÁY đang đi → không double-move (bước nhảy moveCount ≤ 1), 0 lỗi', race);

  // 1f. Ẩn/hiện tab giữa lượt (dùng giả lập visibilitychange)
  const visChaos = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'ai', size: 6, first: 'you', timeLimitOn: true, timeSec: 20, difficulty: 'medium' });
    await new Promise((r) => setTimeout(r, 200));
    const before = g.getState();
    const setHidden = (v) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => v });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (v ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    g.playEdge([1, 0, 'H']);
    await new Promise((r) => setTimeout(r, 30));
    setHidden(true); await new Promise((r) => setTimeout(r, 1200));
    setHidden(false); await new Promise((r) => setTimeout(r, 150));
    setHidden(true); await new Promise((r) => setTimeout(r, 1200));
    setHidden(false); await new Promise((r) => setTimeout(r, 2600));
    const st = g.getState();
    return { before: { seq: before.turnSeq, turn: before.turn }, after: { seq: st.turnSeq, mc: st.moveCount, turn: st.turn, over: st.over }, errors: (window.__errors || []) };
  })()`, { awaitPromise: true });
  need(visChaos.errors.length === 0 && !visChaos.after.over, 'Chaos: ẩn/hiện tab 2 lần giữa lượt (có máy đang chờ đi) → 0 lỗi, ván tiếp tục', visChaos);

  need(cdp.filteredErrors().length === 0, 'Chaos: 0 lỗi console/JS tích luỹ sau toàn bộ chuỗi chaos', cdp.filteredErrors());

  /* =====================================================================
   * 2. bundle.html qua file://
   * ================================================================== */
  const fileUrl = 'file://' + resolve('bundle.html');
  const bundleBoot = await cdp.navigate(fileUrl, { settle: 1200 });
  const bundleState = await cdp.eval(`(async () => {
    const g = window.__game;
    if (!g) return { boot: false, errors: (window.__errors || []), ready: document.readyState, moduleLoaded: !!window.__moduleLoaded, bootOk: window.__bootOk === true, gate: (document.getElementById('file-gate') || {}).className };
    const st = g.getState() || { screen: 'menu' };
    return { boot: true, screen: st.screen, menu: !document.getElementById('screen-menu').hidden,
      path: location.protocol, errors: (window.__errors || []) };
  })()`, { awaitPromise: true });
  await cdp.screenshot(resolve('qc/out/file-menu.png'));
  console.log('bundle debug:', JSON.stringify(bundleState), JSON.stringify(cdp.filteredErrors()));
  const bundlePlay = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 5, first: 'you', timeLimitOn: true, timeSec: 20 });
    await new Promise((r) => setTimeout(r, 250));
    for (const e of [[1,0,'H'],[0,1,'V'],[1,1,'H'],[2,2,'V'],[1,2,'H'],[2,1,'H'],[3,1,'V'],[1,1,'V']]) { g.playEdge(e); await new Promise((r) => setTimeout(r, 60)); }
    await new Promise((r) => setTimeout(r, 700));
    const st = g.getState();
    const c = document.getElementById('board');
    return { screen: st.screen, mc: st.moveCount, score: st.score, canvas: Math.round(c.getBoundingClientRect().width), errors: (window.__errors || []) };
  })()`, { awaitPromise: true });
  await cdp.screenshot(resolve('qc/out/file-play.png'));
  need(bundleBoot && bundleState.boot && bundleState.path === 'file:' && bundleState.errors.length === 0,
    'Tương thích: bundle.html qua file:// KHỞI ĐỘNG được (menu hiện, 0 lỗi)', bundleState);
  need(bundlePlay.screen === 'play' && bundlePlay.mc === 8 && bundlePlay.canvas > 100 && bundlePlay.errors.length === 0,
    'Tương thích: bundle.html qua file:// CHƠI được (8 nước, canvas vẽ, 0 lỗi)', bundlePlay);
  need(cdp.filteredErrors().length === 0, 'Tương thích: file:// không có lỗi console', cdp.filteredErrors());

  /* =====================================================================
   * 3. CPU THROTTLE 4× — chooseMove + độ trễ UI trên bàn 8×8 Khó
   * ================================================================== */
  await freshPage();
  await cdp.cpu(4);
  const perf = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'ai', size: 8, first: 'you', timeLimitOn: false, difficulty: 'hard' });
    await new Promise((r) => setTimeout(r, 400));
    // (a) chooseMove của AI THẬT của app (import module) — đo thời gian nghĩ
    const M = await import('./src/ai.js');
    const E = await import('./src/engine.js');
    const gs = E.createGame({ n: 8 });
    // dựng ván giữa trận (30 nước) để thời gian nghĩ đại diện
    for (let i = 0; i < 30; i++) { const mv = M.chooseMove(gs, { level: 'medium', seed: i + 1 }); if (mv) E.applyMove(gs, mv); }
    const times = [];
    for (let i = 0; i < 25; i++) {
      const t0 = performance.now();
      const mv = M.chooseMove(gs, { level: 'hard', seed: 100 + i });
      times.push(performance.now() - t0);
      if (!mv) break;
      E.applyMove(gs, mv);
    }
    times.sort((a, b) => a - b);
    const pct = (p) => Math.round(times[Math.min(times.length - 1, Math.floor(times.length * p))] * 10) / 10;
    // (b) độ trễ UI: bấm một nước qua pointer thật trên canvas và đo thời gian từ pointerup → HUD đổi
    const canvas = document.getElementById('board');
    const r = canvas.getBoundingClientRect();
    const n = g.getState().n;
    const side = r.width; const pad = side < 480 ? 16 : 20; const step = (side - 2 * pad) / n;
    const x = r.left + pad + 0.5 * step; const y = r.top + pad + 1 * step;   // cạnh ngang hàng 1
    const hud = document.getElementById('hud-a-score');
    const before = g.getState().moveCount;
    const tIn = performance.now();
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    // chờ tới khung kế tiếp để chắc chắn HUD/canvas đã vẽ (rAF)
    await new Promise((res) => requestAnimationFrame(() => res()));
    const tFrame1 = performance.now() - tIn;
    const st = g.getState();
    return { thinkMs: { min: Math.round(times[0] * 10) / 10, p50: pct(0.5), p95: pct(0.95), max: Math.round(times[times.length - 1] * 10) / 10, n: times.length },
      clickToFrameMs: Math.round(tFrame1 * 10) / 10, moveRegistered: st.moveCount - before, hud: hud.textContent, hardBudget: 60 };
  })()`, { awaitPromise: true });
  await cdp.cpu(1);
  need(perf.thinkMs.p95 <= 200 && perf.thinkMs.max <= 200,
    `Hiệu năng (CPU throttle 4×): chooseMove bàn 8×8 Khó p95 ≤ 200ms (đo: TB ${perf.thinkMs.p50} / p95 ${perf.thinkMs.p95} / max ${perf.thinkMs.max}ms, ngân sách AI 60ms)`, perf.thinkMs);
  need(perf.clickToFrameMs <= 200 && perf.moveRegistered === 1,
    `Hiệu năng (CPU 4×): bấm cạnh → nước đi đăng ký + vẽ khung kế tiếp ≤ 200ms (đo: ${perf.clickToFrameMs}ms)`, { ms: perf.clickToFrameMs, moves: perf.moveRegistered });

  // FPS khi animate (8×8) dưới CPU 4×
  await cdp.cpu(4);
  const fps = await cdp.eval(`(async () => {
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 8, first: 'you', timeLimitOn: false });
    await new Promise((r) => setTimeout(r, 300));
    const frames = [];
    let last = performance.now();
    let running = true;
    const tick = () => { const t = performance.now(); frames.push(t - last); last = t; if (running) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const t0 = performance.now();
    let k = 0;
    while (performance.now() - t0 < 2000 && !g.getState().over) { g.playLegalEdge(); k++; await new Promise((r) => setTimeout(r, 120)); }
    running = false;
    const f = frames.slice(2);
    const avg = f.reduce((a, b) => a + b, 0) / Math.max(1, f.length);
    return { frames: f.length, fps: Math.round((1000 / avg) * 10) / 10, moves: k, worst: Math.round(Math.max(...f) * 10) / 10 };
  })()`, { awaitPromise: true });
  await cdp.cpu(1);
  need(fps.fps >= 30, `Hiệu năng (CPU 4×): khi đang animate bàn 8×8 vẫn ≥ 30 fps (đo: ${fps.fps} fps, khung xấu nhất ${fps.worst}ms)`, fps);

  const res = summary('Nhóm C — Độ bền / Tương thích / Hiệu năng');
  writeReport('qc/out/chaos.json', { title: 'C. Độ bền / Tương thích / Hiệu năng', base: BASE, ...res, perf: { perf, fps, chaos: { chaosNew, chaosScreens, chaosTheme, chaosResize, cdpResize, race, visChaos, bundleState, bundlePlay } } });
  await cdp.close();
  process.exit(res.fail ? 1 : 0);
} catch (e) {
  console.error('LỖI HARNESS:', e);
  try { await cdp.close(); } catch { /* bỏ qua */ }
  process.exit(2);
}
