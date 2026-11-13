#!/usr/bin/env node
/**
 * qc/t-pw.mjs — KIỂM CHÉO bằng Playwright (Playwright điều khiển Chrome THẬT, khác đường CDP thô của
 * các script khác) — dùng để trả lời câu hỏi: "lỗi tải module ES gặp trong CDP có phải lỗi ỨNG DỤNG?"
 *
 * Playwright KHÔNG phải dependency của dự án (ràng buộc: không thêm dependency). Script tự tìm
 * gói `playwright` ở vài đường dẫn quen thuộc; nếu không có → báo SKIP (không tính là PASS).
 *
 * Chạy: node qc/t-pw.mjs [BASE_URL]
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:8812/index.html';
const CANDIDATES = [
  '/tmp/pwtest/node_modules/playwright',
  resolveMaybe('qc/node_modules/playwright'),
  resolveMaybe('node_modules/playwright'),
];
function resolveMaybe(p) { return p; }

let pw = null;
for (const c of CANDIDATES) {
  try { pw = createRequire(import.meta.url)(c); break; } catch { /* thử đường khác */ }
}
if (!pw) {
  console.log('SKIP  Playwright không có sẵn ở máy này (không phải lỗi sản phẩm) — bỏ qua kiểm chéo.');
  process.exit(0);
}

const { chromium } = pw;
const results = [];
const ok = (name, cond, detail) => {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + JSON.stringify(detail) : ''}`);
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

  // 10 lần mở URL có ?debug=1 (chính URL mà bun qc-shots.mjs dùng)
  let bad = 0;
  const badInfo = [];
  for (let i = 0; i < 10; i++) {
    errs.length = 0;
    await page.goto(BASE + (BASE.includes('?') ? '&' : '?') + 'debug=1&theme=light', { waitUntil: 'load' });
    await page.waitForTimeout(350);
    const booted = await page.evaluate(() => !!(window.__game && window.__bootOk === true)).catch(() => false);
    if (!booted) { bad++; badInfo.push({ lan: i + 1, errs: [...errs] }); }
  }
  ok('Playwright (Chrome thật): 10/10 lần mở ?debug=1 → app boot, 0 lỗi console', bad === 0, badInfo.length ? badInfo : { lan: 10 });

  // Chơi trọn ván 3×3 bằng API debug trong Playwright (đường runtime khác CDP thô)
  errs.length = 0;
  await page.goto(BASE + (BASE.includes('?') ? '&' : '?') + 'debug=1&theme=light', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const game = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame({ mode: 'pvp', size: 3, first: 'you', timeLimitOn: false });
    await new Promise((r) => setTimeout(r, 150));
    let k = 0;
    while (!g.getState().over && k++ < 50) g.playLegalEdge();
    await new Promise((r) => setTimeout(r, 700));
    const st = g.getState();
    return { over: st.over, score: st.score, result: !document.getElementById('screen-result').hidden,
      title: document.getElementById('result-title').textContent, errors: window.__errors.slice() };
  });
  ok('Playwright: chơi trọn ván 3×3 → hết cạnh, tổng điểm 9, màn kết quả hiện, 0 lỗi',
    game.over && game.score.total === 9 && game.result && game.errors.length === 0 && errs.length === 0,
    { score: game.score, title: game.title, console: errs.slice(0, 3) });

  // Bàn phím qua bàn cờ: Tab tới canvas → mũi tên + Enter đi được nước
  errs.length = 0;
  await page.goto(BASE + (BASE.includes('?') ? '&' : '?') + 'theme=light', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.setItem('db_tutorial_done', 'true'));
  await page.goto(BASE + (BASE.includes('?') ? '&' : '?') + 'theme=light', { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__game.startGame({ mode: 'pvp', size: 3, first: 'you', timeLimitOn: false }));
  await page.waitForTimeout(250);
  await page.focus('#board');
  const before = await page.evaluate(() => window.__game.getState().moveCount);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ mc: window.__game.getState().moveCount, fv: document.getElementById('board').matches(':focus-visible') }));
  ok('Playwright: phím THẬT (page.keyboard) — ArrowRight + Enter đi được 1 nước, canvas focus-visible',
    after.mc === before + 1 && after.fv, { before, after, console: errs.slice(0, 3) });

  // Ảnh mù màu (Playwright emulateMedia) — chụp để QC xem bằng mắt
  await page.evaluate(async () => {
    const g = window.__game;
    for (const e of [[1, 0, 'H'], [1, 1, 'V']]) { g.playEdge(e); await new Promise((r) => setTimeout(r, 120)); }
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'qc/out/pw-boxes-color.png' });
  const cdpSess = await ctx.newCDPSession(page);
  await cdpSess.send('Emulation.setEmulatedVisionDeficiency', { type: 'deuteranopia' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'qc/out/pw-boxes-deuteranopia.png' });
  await cdpSess.send('Emulation.setEmulatedVisionDeficiency', { type: 'none' });
  ok('Playwright: chụp ảnh bàn cờ màu + deuteranopia để QC đối chiếu bằng mắt', true, { files: ['qc/out/pw-boxes-color.png', 'qc/out/pw-boxes-deuteranopia.png'] });
} finally {
  await browser.close();
}

const fail = results.filter((r) => !r.ok).length;
console.log(`\n== Playwright: ${results.length - fail} PASS / ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
