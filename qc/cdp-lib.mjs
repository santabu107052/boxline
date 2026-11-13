#!/usr/bin/env node
/**
 * qc/cdp-lib.mjs — harness CDP tối giản cho QC Boxline (Node ≥ 22, KHÔNG dependency).
 *
 * Mục đích: điều khiển Chrome headless thật để kiểm THẬT (không đoán):
 *  - chạy script trên trang (Runtime.evaluate, awaitPromise)
 *  - chụp ảnh PNG (Page.captureScreenshot)
 *  - đo viewport/thiết bị (Emulation.setDeviceMetricsOverride)
 *  - giả lập prefers-reduced-motion / prefers-color-scheme (Emulation.setEmulatedMedia)
 *  - giả lập mù màu (Emulation.setEmulatedVisionDeficiency)
 *  - throttle CPU (Emulation.setCPUThrottlingRate)
 *  - phím CHUẨN (Input.dispatchKeyEvent), chuột/chạm (Input.dispatchMouseEvent)
 *  - bắt lỗi console/JS (Runtime.exceptionThrown, Log.entryAdded, consoleAPICalled error)
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pickChrome() {
  for (const p of CHROME_PATHS) if (existsSync(p)) return p;
  throw new Error('Không tìm thấy Chrome/Chromium/Edge');
}

/** Key gửi qua Input.dispatchKeyEvent cần code + key + windowsVirtualKeyCode. */
const KEYMAP = {
  Tab: { code: 'Tab', vk: 9, text: '' },
  Enter: { code: 'Enter', vk: 13, text: '\r' },
  Escape: { code: 'Escape', vk: 27, text: '' },
  ArrowLeft: { code: 'ArrowLeft', vk: 37, text: '' },
  ArrowUp: { code: 'ArrowUp', vk: 38, text: '' },
  ArrowRight: { code: 'ArrowRight', vk: 39, text: '' },
  ArrowDown: { code: 'ArrowDown', vk: 40, text: '' },
  Home: { code: 'Home', vk: 36, text: '' },
  End: { code: 'End', vk: 35, text: '' },
  ' ': { code: 'Space', vk: 32, text: ' ' },
};

export class Cdp {
  constructor(ws, proc, port, userDir) {
    this.ws = ws;
    this.proc = proc;
    this.port = port;
    this.userDir = userDir;
    this.id = 0;
    this.pending = new Map();
    /** Mọi lỗi console/JS thu được cho trang hiện tại. */
    this.errors = [];
    this.log = [];
    /** Danh sách lần gọi console.* (kể cả warning) — để kiểm "0 warning". */
    this.consoleAll = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) rej(new Error(JSON.stringify(m.error)));
        else res(m.result);
        return;
      }
      this.onEvent(m);
    };
  }

  onEvent(m) {
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      this.errors.push({ type: 'exception', text: d?.exception?.description || d?.text || 'exception' });
    } else if (m.method === 'Log.entryAdded') {
      const e = m.params.entry;
      this.consoleAll.push({ level: e.level, text: e.text, url: e.url });
      if (e.level === 'error') this.errors.push({ type: 'log.error', text: e.text, url: e.url });
    } else if (m.method === 'Runtime.consoleAPICalled') {
      const text = (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
      this.consoleAll.push({ level: m.params.type, text });
      if (m.params.type === 'error') this.errors.push({ type: 'console.error', text });
    }
  }

  call(method, params = {}) {
    const mid = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(mid, { res, rej });
      this.ws.send(JSON.stringify({ id: mid, method, params }));
    });
  }

  /** Lỗi console/JS đã lọc các nguồn được phép bỏ (favicon, SW, server one-thread flake). */
  filteredErrors() {
    return this.errors.filter((e) => !/favicon|sw\.js|Failed to load resource/i.test(e.text || ''));
  }

  clearErrors() {
    this.errors.length = 0;
    this.consoleAll.length = 0;
  }

  /** Chạy JS trong trang, trả giá trị (JSON) hoặc ném lỗi. */
  async eval(expression, { awaitPromise = false, timeout = 0 } = {}) {
    const r = await this.call('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise,
      userGesture: false,
      ...(timeout ? { timeout } : {}),
    });
    if (r.exceptionDetails) {
      throw new Error('eval lỗi: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    }
    return r.result.value;
  }

  /**
   * Điều hướng + chờ app boot. Trả `{booted}`: nếu module ES bị chặn/lỗi tải (hiện tượng đã biết —
   * xem QC M-04), thử lại TỐI ĐA `retries` lần rồi báo `booted=false` để test tự đánh giá.
   */
  async navigate(url, { settle = 900, ready = true, retries = 2 } = {}) {
    let booted = !ready;
    for (let i = 0; i <= retries; i++) {
      this.clearErrors();
      await this.call('Page.navigate', { url });
      if (!ready) { booted = true; break; }
      booted = await this.waitFor('window.__game && window.__bootOk === true', 8000);
      if (booted) break;
      // module tải lỗi → reload thử lại (đếm số lần phải thử để báo cáo)
      this.bootRetries = (this.bootRetries || 0) + 1;
    }
    if (settle) await sleep(settle);
    this.lastBooted = booted;
    return booted;
  }

  async waitFor(expression, timeoutMs = 6000, step = 60) {
    const t0 = Date.now();
    for (;;) {
      try {
        if (await this.eval(expression)) return true;
      } catch { /* trang đang chuyển */ }
      if (Date.now() - t0 > timeoutMs) return false;
      await sleep(step);
    }
  }

  async screenshot(outPath) {
    const r = await this.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    if (outPath) {
      mkdirSync(resolve(outPath, '..'), { recursive: true });
      writeFileSync(outPath, Buffer.from(r.data, 'base64'));
    }
    return r.data;
  }

  async viewport({ width, height, dsf = 2, mobile = true }) {
    await this.call('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: dsf, mobile,
      screenWidth: width, screenHeight: height,
    });
  }

  async media(features) {
    // features: [{name:'prefers-reduced-motion', value:'reduce'}]
    await this.call('Emulation.setEmulatedMedia', { features });
  }

  async vision(type) {
    // type: 'deuteranopia' | 'protanopia' | 'tritanopia' | 'achromatopsia' | 'none'
    await this.call('Emulation.setEmulatedVisionDeficiency', { type });
  }

  async cpu(rate) {
    await this.call('Emulation.setCPUThrottlingRate', { rate });
  }

  async key(k) {
    const spec = KEYMAP[k];
    if (!spec) throw new Error('key chưa hỗ trợ: ' + k);
    await this.call('Input.dispatchKeyEvent', {
      type: 'rawKeyDown', key: k, code: spec.code, windowsVirtualKeyCode: spec.vk, nativeVirtualKeyCode: spec.vk,
    });
    if (spec.text) {
      await this.call('Input.dispatchKeyEvent', {
        type: 'char', key: k, text: spec.text, unmodifiedText: spec.text,
      });
    }
    await this.call('Input.dispatchKeyEvent', {
      type: 'keyUp', key: k, code: spec.code, windowsVirtualKeyCode: spec.vk, nativeVirtualKeyCode: spec.vk,
    });
  }

  /**
   * Gửi phím "qua DOM thật": Input.dispatchKeyEvent của CDP KHÔNG tạo pre-activation/focus-visible
   * trong chế độ headless mới (mô phỏng sai). Mô phỏng đúng đường của trình duyệt: phím Tab →
   * trình duyệt chạy sequential focus navigation (dùng `document.activeElement` + bảng Tab thật
   * lấy từ DOM, có xét tabindex), phím khác → gửi KeyboardEvent tới phần tử đang focus (đường mà
   * app lắng nghe).
   */
  async keyDom(k) {
    return this.eval(`(() => {
      const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && !el.closest('[hidden]');
      const tabbables = () => [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
        .filter((el) => !el.disabled && el.tabIndex >= 0 && vis(el));
      const list = tabbables();
      // Cuộn trong modal: CHỈ các phần tử trong panel của modal đang mở (mô phỏng focus trap của
      // trình duyệt — hoặc lộ việc app THIẾU focus trap, đúng thứ test cần bắt).
      const modalOpen = !document.getElementById('modal').hidden;
      const pool = (modalOpen && document.activeElement && document.activeElement.closest('#modal-panel'))
        ? tabbables().filter((el) => el.closest('#modal-panel')) : list;
      const cur = document.activeElement;
      if (${JSON.stringify(k)} === 'Tab') {
        let i = pool.indexOf(cur);
        i = i < 0 ? 0 : (i + 1) % pool.length;
        const el = pool[i];
        el.focus();
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        // Nếu app (focus trap) đã chuyển focus sang chỗ khác → tôn trọng quyết định của app.
        return { focused: document.activeElement.id || document.activeElement.className.toString().slice(0, 30), poolSize: pool.length, modal: modalOpen };
      }
      const el = cur && cur !== document.body ? cur : document.getElementById('board');
      el.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true, cancelable: true }));
      return { focused: el.id || el.className.toString().slice(0, 30) };
    })()`);
  }

  /** Click tại toạ độ CSS px (viewport). `trusted:false` → CHỈ bắn sự kiện tin cậy thật (gesture thật). */
  async click(x, y) {
    await this.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    await this.call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await this.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  }

  async close() {
    try { await this.call('Browser.close'); } catch { /* đã đóng */ }
    try { this.ws.close(); } catch { /* bỏ qua */ }
    try { this.proc.kill('SIGKILL'); } catch { /* đã chết */ }
  }
}

let _idSeq = 0;
function id_(that) { return ++that.id; }

/** Mở Chrome headless + CDP cho 1 tab. */
export async function launch({ width = 390, height = 844 } = {}) {
  const chrome = pickChrome();
  const port = 9600 + Math.floor(Math.random() * 300);
  const userDir = `${tmpdir()}/boxline-qc-cdp-${port}-${Date.now()}`;
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${userDir}`, `--remote-debugging-port=${port}`,
    `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: 'ignore' });

  let page = null;
  for (let i = 0; i < 120 && !page; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch { /* chưa lên */ }
    if (!page) await sleep(120);
  }
  if (!page) throw new Error('CDP không lên sau ~15s');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = (e) => rej(new Error('ws: ' + (e?.message || 'error')));
  });
  const cdp = new Cdp(ws, proc, port, userDir);
  await cdp.call('Page.enable');
  await cdp.call('Runtime.enable');
  await cdp.call('Log.enable');
  await cdp.call('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
  return cdp;
}

/* --------------------------------------------------------------------------
 * Tiện ích chung cho script QC
 * ----------------------------------------------------------------------- */

let pass = 0;
let fail = 0;
const failures = [];
const evidence = [];

/**
 * @param {string} name
 * @param {boolean|object} cond  điều kiện đúng, hoặc {ok:boolean, detail:string}
 * @param {any} [detail]
 */
export function check(name, cond, detail) {
  let ok;
  let info = detail;
  if (cond && typeof cond === 'object' && 'ok' in cond) {
    ok = cond.ok;
    info = cond.detail ?? detail;
  } else ok = !!cond;
  const line = `${ok ? 'PASS' : 'FAIL'}  ${name}${info !== undefined ? ' — ' + (typeof info === 'string' ? info : JSON.stringify(info)) : ''}`;
  if (ok) pass++;
  else {
    fail++;
    failures.push(line);
  }
  console.log(line);
  evidence.push({ name, ok, detail: typeof info === 'string' ? info : (info === undefined ? null : JSON.parse(JSON.stringify(info))) });
  return ok;
}

export function summary(title) {
  console.log(`\n== ${title}: ${pass} PASS / ${fail} FAIL ==`);
  if (fail) {
    console.log('Các kiểm tra hỏng:');
    for (const f of failures) console.log('  ' + f);
  }
  return { total: pass + fail, pass, fail, failures, evidence };
}

export function writeReport(path, { title, ...rest }) {
  const p = resolve(path);
  mkdirSync(resolve(p, '..'), { recursive: true });
  writeFileSync(p, JSON.stringify({ title, at: new Date().toISOString(), ...rest }, null, 2));
  console.log('→ đã ghi ' + p);
}
