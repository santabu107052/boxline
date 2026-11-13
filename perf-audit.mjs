#!/usr/bin/env node
/**
 * perf-audit.mjs — Đo hiệu năng + tương thích của Boxline bằng Chrome DevTools Protocol.
 * Không dependency: Node ≥ 22 (fetch + WebSocket có sẵn) hoặc Bun.
 *
 * Chạy (cần máy chủ tĩnh trong thư mục dự án):
 *   python3 -m http.server 8801 --bind 127.0.0.1 &
 *   node perf-audit.mjs                      # đo đầy đủ trên http://127.0.0.1:8801/index.html
 *   node perf-audit.mjs --label after        # đặt nhãn cho bộ số đọc (ghi vào report json)
 *   node perf-audit.mjs --quick              # bỏ bài 60s heap
 *   node perf-audit.mjs --only perf,compat   # chỉ chạy một số bài
 *   node perf-audit.mjs --base http://127.0.0.1:8801/index.html --out perf-before.json
 *
 * Các bài đo (xem MAINTENANCE.md):
 *   perf    FPS khi animate 8×8 (30 nước × 120ms), rAF khi bàn tĩnh 3s, chooseMove,
 *           JSHeapUsedSize sau 60s chơi liên tục, DOM node theo thời gian,
 *           kích thước + Navigation Timing của index.html và bundle.html.
 *   compat  Ma trận viewport (kể cả zoom 200% và prefers-reduced-motion: reduce):
 *           tràn ngang, bàn cờ nằm gọn, kích thước nút ≥ 44px.
 *   leaks   30 lần chuyển màn menu → ván → kết quả → menu: JSEventListeners / JSHeapUsedSize.
 *   robust  Kiểm chế độ suy giảm (localStorage bị chặn, thiếu crypto.getRandomValues,
 *           thiếu navigator.vibrate, thiếu ctx.roundRect, không có ResizeObserver,
 *           AudioContext bị treo/khoá) — app KHÔNG được crash.
 *   edge    Kịch bản biên: hết giờ + AI cùng lúc, đổi theme/resize khi animate, tab ẩn/hiện,
 *           "Ván mới" ×5, modal khi timer chạy, phím khi ở menu/modal.
 *
 * Chỉ dùng `window.__game` (debug hook có sẵn trong app) + CDP — không sửa mã sản phẩm.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];

/* ----------------------------------------------------------------- args */
function parseArgs(argv) {
  const out = {
    base: 'http://127.0.0.1:8801/index.html',
    bundle: null,
    out: null,
    label: '',
    quick: false,
    only: null,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') out.base = argv[++i];
    else if (a === '--bundle') out.bundle = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--label') out.label = argv[++i];
    else if (a === '--quick') out.quick = true;
    else if (a === '--verbose') out.verbose = true;
    else if (a === '--only') out.only = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--help' || a === '-h') {
      console.log('node perf-audit.mjs [--base URL] [--bundle URL] [--label X] [--quick] [--only perf,compat,leaks,robust,edge] [--out file.json]');
      process.exit(0);
    }
  }
  if (!out.bundle) {
    try {
      const u = new URL(out.base);
      u.pathname = u.pathname.replace(/[^/]*$/, 'bundle.html');
      out.bundle = u.toString();
    } catch {
      out.bundle = null;
    }
  }
  if (!out.out) {
    const tag = out.label ? `-${out.label.replace(/[^\w-]+/g, '_')}` : '';
    out.out = resolve(HERE, `perf-report${tag}.json`);
  }
  return out;
}
const ARGS = parseArgs(process.argv.slice(2));
const WANT = (k) => !ARGS.only || ARGS.only.includes(k);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (v, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : v);

function pickChrome() {
  for (const p of CHROME_PATHS) if (existsSync(p)) return p;
  return null;
}

/* ------------------------------------------------------------------ CDP */
async function waitForPage(port, tries = 120) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page;
    } catch { /* chưa lên */ }
    await sleep(150);
  }
  throw new Error('CDP không lên sau 18s');
}

function connect(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    const listeners = [];
    let id = 0;
    ws.onopen = () => res({
      ws,
      on(fn) { listeners.push(fn); },
      call(method, params = {}) {
        const mid = ++id;
        return new Promise((resolve2, reject2) => {
          pending.set(mid, { resolve2, reject2 });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      },
      close() { try { ws.close(); } catch { /* bỏ qua */ } },
    });
    ws.onerror = (e) => rej(new Error('ws lỗi: ' + (e && e.message ? e.message : 'unknown')));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve2, reject2 } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject2(new Error(JSON.stringify(msg.error)));
        else resolve2(msg.result);
        return;
      }
      for (const fn of listeners) fn(msg);
    };
  });
}

/** Gọi code trong page, trả giá trị JSON (hoặc ném lỗi). */
async function evalJson(cdp, expression) {
  // awaitPromise: true KHÔNG dùng được với returnByValue khi kết quả là object lớn (deepSerialize lỗi
  // 'Object reference chain too long'), nên: chạy biểu thức → gán JSON.stringify(result) vào
  // globalThis.__AUDIT_RESULT → hỏi lại giá trị đó khi promise đã xong.
  await cdp.call('Runtime.evaluate', {
    expression: `globalThis.__AUDIT_RESULT = undefined; globalThis.__AUDIT_RUNNING = true;
      Promise.resolve((function(){ ${expression} })())
        .then(function(v){ globalThis.__AUDIT_RESULT = JSON.stringify(v); })
        .catch(function(e){ globalThis.__AUDIT_RESULT = JSON.stringify({ __auditErr: String((e && e.stack) || e) }); })
        .finally(function(){ globalThis.__AUDIT_RUNNING = false; });`,
    awaitPromise: false,
    userGesture: true,
  });
  const deadline = Date.now() + 120000;
  for (;;) {
    await sleep(50);
    const probe = await cdp.call('Runtime.evaluate', {
      expression: 'globalThis.__AUDIT_RUNNING ? 0 : (globalThis.__AUDIT_RESULT === undefined ? 1 : 2)',
      returnByValue: true,
    });
    const state = probe.result.value;
    if (state === 2) break;
    if (state === 1) {
      // Biểu thức không trả promise hoặc đã xong trước khi hỏi → lấy giá trị ngay.
      const again = await cdp.call('Runtime.evaluate', {
        expression: `(function(){ try { const v = (function(){ ${expression} })(); return JSON.stringify(v); } catch (e) { return JSON.stringify({ __auditErr: String((e && e.stack) || e) }); } })()`,
        returnByValue: true,
        userGesture: true,
      });
      globalThisSafeSet(again);
      return finish(again.result.value);
    }
    if (Date.now() > deadline) throw new Error('evalJson quá thời gian chờ: ' + expression.slice(0, 120));
  }
  const got = await cdp.call('Runtime.evaluate', { expression: 'globalThis.__AUDIT_RESULT', returnByValue: true });
  return finish(got.result.value);
  function globalThisSafeSet() { /* không dùng */ }
  function finish(raw) {
    if (typeof raw !== 'string') return { __raw: raw, __desc: 'không tuần tự hoá được' };
    const v = JSON.parse(raw);
    if (v && v.__auditErr) throw new Error(String(v.__auditErr));
    return v;
  }
}

async function evalRaw(cdp, expression, awaitPromise = false) {
  const r = await cdp.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text || 'eval lỗi');
  }
  return r.result.value;
}

async function setViewport(cdp, w, h, dpr = 2, mobile = true) {
  await cdp.call('Emulation.setDeviceMetricsOverride', {
    width: w, height: h, deviceScaleFactor: dpr, mobile,
    screenWidth: w, screenHeight: h,
  });
}

async function setMedia(cdp, reducedMotion) {
  await cdp.call('Emulation.setEmulatedMedia', {
    media: '',
    features: [
      { name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' },
      { name: 'prefers-color-scheme', value: 'light' },
    ],
  });
}

async function nav(cdp, url, settle = 900) {
  await cdp.call('Page.navigate', { url });
  await sleep(settle);
}

/**
 * Cài bộ đếm rAF vào page (chạy SAU khi app khởi động → app đã bind rAF gốc của nó).
 * Đếm mọi lần trang gọi requestAnimationFrame, và riêng số callback không phải của bộ đo FPS.
 */
const RAF_INSTALL = `(function(){
  if (window.__rafInstall) return 'reuse';
  var orig = window.requestAnimationFrame.bind(window);
  window.__rafCount = 0;
  window.__rafByApp = 0;
  window.requestAnimationFrame = function(cb){
    window.__rafCount++;
    return orig(function(t){
      if (!cb.__auditProbe) window.__rafByApp++;
      return cb(t);
    });
  };
  window.__rafReset = function(){ window.__rafCount = 0; window.__rafByApp = 0; };
  window.__rafInstall = function(){ window.__rafReset(); return 'reset'; };
  return 'installed';
})()`;
const installRafCounter = (cdp) => evalRaw(cdp, RAF_INSTALL);

/* --------------------------------------------------------------- MAIN */
async function main() {
  mkdirSync(dirname(ARGS.out), { recursive: true });
  const chrome = pickChrome();
  if (!chrome) throw new Error('Không tìm thấy Chrome/Chromium/Edge');
  const port = 9700 + Math.floor(Math.random() * 300);
  const userDir = `/tmp/boxline-perf-${port}`;
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    `--user-data-dir=${userDir}`, `--remote-debugging-port=${port}`,
    '--window-size=390,844', 'about:blank',
  ], { stdio: 'ignore' });

  const report = {
    label: ARGS.label,
    when: new Date().toISOString(),
    chrome,
    base: ARGS.base,
    bundle: ARGS.bundle,
    node: process.version,
    results: {},
    consoleErrors: [],
    meta: {},
  };

  let cdp = null;
  try {
    const page = await waitForPage(port);
    cdp = await connect(page.webSocketDebuggerUrl);
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Log.enable');
    await cdp.call('Performance.enable');
    cdp.on((m) => {
      if (m.method === 'Runtime.exceptionThrown') {
        report.consoleErrors.push({ type: 'exception', text: m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text });
      }
      if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) {
        report.consoleErrors.push({ type: 'log.' + m.params.entry.level, text: m.params.entry.text, url: m.params.entry.url });
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        report.consoleErrors.push({ type: 'console.error', text: (m.params.args || []).map((a) => a.value ?? a.description).join(' ') });
      }
    });

    report.meta.browser = await evalRaw(cdp, 'navigator.userAgent');

    if (WANT('perf')) report.results.perf = await runPerf(cdp);
    if (WANT('compat')) report.results.compat = await runCompat(cdp);
    if (WANT('leaks')) report.results.leaks = await runLeaks(cdp);
    if (WANT('robust')) report.results.robust = await runRobust(cdp);
    if (WANT('edge')) report.results.edge = await runEdge(cdp);

    try { await cdp.call('Browser.close'); } catch { /* bỏ qua */ }
  } finally {
    try { proc.kill('SIGKILL'); } catch { /* đã chết */ }
    if (cdp) cdp.close();
  }

  const errs = report.consoleErrors.filter((e) => !/favicon|sw\.js|Failed to load resource/i.test(e.text || ''));
  report.consoleErrorCount = errs.length;
  writeFileSync(ARGS.out, JSON.stringify(report, null, 2));
  printSummary(report, errs);
  // Dọn thư mục profile tạm của Chrome.
  try {
    const { rmSync } = await import('node:fs');
    rmSync(userDir, { recursive: true, force: true });
  } catch { /* bỏ qua */ }
}

/* ---------------------------------------------------------------- PERF */
async function runPerf(cdp) {
  const perf = {};
  await setMedia(cdp, false);
  await setViewport(cdp, 390, 844, 2, true);
  await nav(cdp, ARGS.base + '?theme=light&debug=1', 1200);
  await installRafCounter(cdp);

  // --- (1) FPS khi animate: bàn 8×8, 30 nước cách nhau 120ms; đếm khung hình 2s.
  await evalRaw(cdp, `window.__game.startGame({mode:'pvp', size:8, first:'you', timeLimitOn:false})`);
  await sleep(600);
  const fps = await evalJson(cdp, `
    return new Promise(function(done){
      var frames = [];
      var stop = false;
      var last = performance.now();
      function probe(t){ if (stop) return; frames.push(t - last); last = t; requestAnimationFrame(probe); }
      requestAnimationFrame(probe);
      var tStart = performance.now();
      var moves = 0;
      // 30 nước liên tiếp, mỗi nước cách nhau 120ms (bàn 8×8), trong lúc đó đếm khung hình.
      var iv = setInterval(function(){
        var r = window.__game.playLegalEdge();
        moves++;
        var st = r && r.state;
        if (!st || st.over) { try { window.__game.startGame({mode:'pvp', size:8, first:'you', timeLimitOn:false}); } catch(e){} }
      }, 120);
      setTimeout(function(){
        clearInterval(iv); stop = true;
        var dur = performance.now() - tStart;
        var d = frames.slice(1); // bỏ khung mốc khởi động
        var sum = d.reduce(function(a,b){return a+b;},0);
        var avg = d.length ? sum / d.length : 0;
        var sorted = d.slice().sort(function(a,b){return a-b;});
        var p95 = sorted.length ? sorted[Math.floor(sorted.length*0.95)] : 0;
        var long = d.filter(function(x){ return x > 33.4; }).length; // khung dài > ~2 khung @60Hz
        done({
          ms: Math.round(dur),
          frames: d.length,
          fps: avg > 0 ? Math.round(1000/avg*10)/10 : 0,
          avgFrameMs: Math.round(avg*100)/100,
          p95FrameMs: Math.round(p95*100)/100,
          worstFrameMs: sorted.length ? Math.round(sorted[sorted.length-1]*100)/100 : 0,
          framesOver33ms: long,
          moves: moves
        });
      }, 2000);
    })`);
  perf.fpsAnimating8x8 = fps;

  // Nhịp rAF trong lúc đang animate (để so sánh với bàn tĩnh).
  await sleep(1500);
  await evalRaw(cdp, `window.__rafReset();`);
  await evalRaw(cdp, `window.__game.startGame({mode:'pvp', size:8, first:'you', timeLimitOn:false}); window.__game.playLegalEdge();`);
  await sleep(1200);
  const animRate = await evalJson(cdp, `return { rafCount: window.__rafCount }`);
  perf.rafDuringAnim1200ms = { calls: animRate.rafCount, perSecond: Math.round(animRate.rafCount / 1.2) };

  // --- (2) rAF khi bàn TĨNH (không thao tác 3s) → phải = 0.
  await evalRaw(cdp, `window.__game.startGame({mode:'pvp', size:8, first:'you', timeLimitOn:false})`);
  await sleep(800);
  await evalRaw(cdp, `window.__rafReset();`);
  const t0 = Date.now();
  await sleep(3000);
  const still = await evalJson(cdp, `return { rafCount: window.__rafCount, rafByApp: window.__rafByApp, ms: ${Date.now() - t0} }`);
  perf.rafWhenIdle3s = still;

  // Bàn tĩnh ở MENU (không có canvas ván nào) — cũng phải 0.
  await nav(cdp, ARGS.base + '?theme=light&debug=1', 1200);
  await installRafCounter(cdp);
  await sleep(2000);
  perf.rafWhenIdleMenu2s = await evalJson(cdp, `return { rafCount: window.__rafCount, rafByApp: window.__rafByApp }`);

  // --- (3) chooseMove: thời gian nghĩ của máy trên bàn 8×8 ở nhiều giai đoạn ván.
  //     Chạy module AI y như app (index.html → /src/ai.js; bundle.html → window.__M).
  perf.chooseMove8x8 = await evalJson(cdp, `
    return (async function(){
      var M = {};
      if (window.__M && window.__M.chooseMove) {
        M = window.__M;
      } else {
        var ai = await import('/src/ai.js');
        var eng = await import('/src/engine.js');
        M = Object.assign({}, eng, ai);
      }
      return (function(){
        var mkState = function(){ return { n: 8, edges: new Map(), boxes: new Array(64).fill(null), turn: 'A', turnSeq: 0, moveCount: 0, passedTurns: 0, firstMove: null, lastMove: null }; };
        var times = [];
        var perLevel = {};
        ['easy','medium','hard'].forEach(function(level){
          var st = mkState();
          var guard = 0;
          while (guard++ < 120) {
            var t0 = performance.now();
            var mv = M.chooseMove(st, { level: level, seed: guard });
            var dt = performance.now() - t0;
            times.push(dt);
            (perLevel[level] = perLevel[level] || []).push(dt);
            if (!mv) break;
            M.applyMove(st, mv);
          }
        });
        var stat = function(arr){
          if (!arr.length) return null;
          var s = arr.slice().sort(function(a,b){return a-b;});
          var sum = s.reduce(function(a,b){return a+b;},0);
          return { n: s.length, avgMs: Math.round(sum/s.length*100)/100, p95Ms: Math.round(s[Math.floor(s.length*0.95)]*100)/100, maxMs: Math.round(s[s.length-1]*100)/100 };
        };
        var out = stat(times) || {};
        out.byLevel = {};
        Object.keys(perLevel).forEach(function(k){ out.byLevel[k] = stat(perLevel[k]); });
        out.note = 'mỗi mức chơi trọn 1 ván 8×8 bằng chính AI của app';
        return out;
      })();
    })();`, true);

  // --- (4) JSHeapUsedSize + DOM node sau ~60s chơi liên tục.
  if (!ARGS.quick) {
    const heap = await evalJson(cdp, `
      return new Promise(function(done){
        var samples = [];
        var nodes = [];
        var t0 = performance.now();
        function snap(){
          var m = performance.memory ? performance.memory.usedJSHeapSize : null;
          samples.push({ t: Math.round(performance.now()-t0), heap: m, nodes: document.getElementsByTagName('*').length });
        }
        window.__game.startGame({mode:'pvp', size:8, first:'you', timeLimitOn:false});
        snap();
        var iv = setInterval(function(){
          var r = window.__game.playLegalEdge();
          if (!r || !r.state || r.state.over) window.__game.startGame({mode:'pvp', size:8, first:'you', timeLimitOn:false});
          if (performance.now() - t0 > 5000 && samples.length && (performance.now()-t0) % 5000 < 200) snap();
        }, 80);
        var iv2 = setInterval(snap, 5000);
        setTimeout(function(){
          clearInterval(iv); clearInterval(iv2); snap();
          var hs = samples.map(function(s){return s.heap;}).filter(function(x){return x!=null;});
          var ns = samples.map(function(s){return s.nodes;});
          done({
            ms: Math.round(performance.now()-t0),
            samples: samples.length,
            heapStartMB: hs.length ? Math.round(hs[0]/1048576*10)/10 : null,
            heapEndMB: hs.length ? Math.round(hs[hs.length-1]/1048576*10)/10 : null,
            heapMinMB: hs.length ? Math.round(Math.min.apply(null,hs)/1048576*10)/10 : null,
            heapMaxMB: hs.length ? Math.round(Math.max.apply(null,hs)/1048576*10)/10 : null,
            nodeStart: ns[0], nodeEnd: ns[ns.length-1], nodeMin: Math.min.apply(null,ns), nodeMax: Math.max.apply(null,ns)
          });
        }, 60000);
      });
    `, true);
    perf.heap60s = heap;
  }

  // --- (5) Performance.getMetrics (chuẩn CDP, đơn vị byte cho heap).
  const metrics = await cdp.call('Performance.getMetrics');
  const map = {};
  for (const m of metrics.metrics || []) map[m.name] = m.value;
  perf.cdpMetrics = {
    JSHeapUsedSizeMB: round((map.JSHeapUsedSize || 0) / 1048576, 2),
    Nodes: map.Nodes,
    JSEventListeners: map.JSEventListeners,
    Documents: map.Documents,
    LayoutObjects: map.LayoutObjects,
  };

  // --- (6) Kích thước + Navigation Timing cho index.html và bundle.html.
  perf.load = {};
  for (const [key, url] of [['index', ARGS.base], ['bundle', ARGS.bundle]]) {
    if (!url) continue;
    // đo sau khi xoá cache để công bằng giữa 2 bản
    await cdp.call('Network.enable');
    await nav(cdp, url + (url.includes('?') ? '&' : '?') + 'theme=light', 1400);
    const timing = await evalJson(cdp, `
      var n = performance.getEntriesByType('navigation')[0] || {};
      var res = performance.getEntriesByType('resource') || [];
      var bytes = 0;
      for (var i=0;i<res.length;i++) bytes += (res[i].transferSize || 0);
      return {
        domContentLoadedMs: Math.round((n.domContentLoadedEventEnd||0)*10)/10,
        loadMs: Math.round((n.loadEventEnd||0)*10)/10,
        responseEndMs: Math.round((n.responseEnd||0)*10)/10,
        transferSize: n.transferSize || 0,
        resourceCount: res.length,
        resourceBytes: bytes,
        domNodes: document.getElementsByTagName('*').length,
        scripts: (document.scripts||[]).length
      }`);
    const path = new URL(url).pathname;
    let fileBytes = 0;
    try {
      const local = resolve(HERE, path.replace(/^\//, ''));
      if (existsSync(local)) fileBytes = statSync(local).size;
    } catch { /* bỏ qua */ }
    perf.load[key] = { url, fileBytes, ...timing };
  }
  return perf;
}

/* -------------------------------------------------------------- COMPAT */
const VIEWPORTS = [
  { name: '320x568', w: 320, h: 568, mobile: true },
  { name: '360x640', w: 360, h: 640, mobile: true },
  { name: '390x844', w: 390, h: 844, mobile: true },
  { name: '430x932', w: 430, h: 932, mobile: true },
  { name: '768x1024', w: 768, h: 1024, mobile: false },
  { name: '667x375-landscape', w: 667, h: 375, mobile: true },
  { name: '1280x800', w: 1280, h: 800, mobile: false },
  { name: '390x844-zoom200', w: 390, h: 844, mobile: true, zoom: 2 },
  { name: '390x844-reduced-motion', w: 390, h: 844, mobile: true, reduced: true },
];

/**
 * Đo layout ở màn đang hiển thị: tràn ngang, bàn cờ nằm gọn trong viewport,
 * nút bấm hiển thị có chiều cao ≥ 44px (§DESIGN "vùng chạm 44px").
 */
async function probeLayout(cdp) {
  return evalJson(cdp, `
    var doc = document.documentElement;
    var overflow = doc.scrollWidth - doc.clientWidth;
    var vw = doc.clientWidth, vh = window.innerHeight;
    function visible(el){
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      var r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }
    function area(el){ var r = el.getBoundingClientRect(); return r.width*r.height; }
    // Bàn cờ = canvas #board (canvas còn lại là minh hoạ hướng dẫn).
    var board = document.getElementById('board');
    var boardInfo = null;
    if (board && visible(board)) {
      var r = board.getBoundingClientRect();
      boardInfo = {
        x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
        insideViewport: r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1,
        withinWidth: r.width <= vw + 1
      };
    }
    // Nút đang hiện (bỏ qua nút ẩn, nút trong modal đóng trừ khi modal đang mở) → kiểm vùng chạm 44px.
    var modalOpen = (function(){ var m = document.getElementById('modal'); return !!m && !m.hidden; })();
    var btns = [].slice.call(document.querySelectorAll('button')).filter(function(b){
      if (!visible(b)) return false;
      if (b.closest('.sr-grid')) return false;              // lưới ẩn cho trình đọc màn hình
      var inModal = !!b.closest('#modal');
      if (inModal && !modalOpen) return false;
      if (!inModal && modalOpen) return false;              // bị modal che
      return true;
    });
    var small = [];
    for (var i=0;i<btns.length;i++){
      var b = btns[i];
      var r2 = b.getBoundingClientRect();
      if (r2.height < 43.5 || r2.width < 43.5) {
        small.push({
          id: b.id || '', cls: String(b.className || ''), h: Math.round(r2.height*10)/10, w: Math.round(r2.width*10)/10,
          label: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 26)
        });
      }
    }
    return {
      overflowX: overflow,
      viewport: { w: vw, h: vh },
      board: boardInfo,
      buttonsChecked: btns.length,
      smallButtons: small,
      smallButtonCount: small.length
    };
  `);
}

async function runCompat(cdp) {
  const rows = [];
  for (const v of VIEWPORTS) {
    await setViewport(cdp, v.w, v.h, 2, !!v.mobile);
    await setMedia(cdp, !!v.reduced);
    await nav(cdp, ARGS.base + '?theme=light&debug=1', 1100);
    if (v.zoom) {
      await evalRaw(cdp, `document.documentElement.style.zoom='${v.zoom}'`);
      await sleep(400);
    }
    const menus = await probeLayout(cdp);
    // Vào ván 5×5 (bàn đầy đủ) rồi đo lại
    await evalRaw(cdp, `window.__game.startGame({mode:'ai', size:5, difficulty:'medium', first:'you', timeLimitOn:false})`);
    await sleep(700);
    const play = await probeLayout(cdp);
    // Chơi vài nước cho bàn có cạnh + 1 ô đóng
    await evalRaw(cdp, `(function(){ for (var i=0;i<12;i++){ var r = window.__game.playLegalEdge(); if(!r||!r.ok) break; } })()`);
    await sleep(500);
    const play2 = await probeLayout(cdp);
    // (a) Tương thích API debug hook: chuỗi lệnh ĐỒNG BỘ kiểu "6 nước liên tiếp" phải có hiệu lực ngay
    //     (nhiều công cụ test/screenshot dựa vào `__game.playLegalEdge()` trả về state đã đổi).
    await evalRaw(cdp, `window.__game.startGame({mode:'pvp', size:5, first:'you', timeLimitOn:false})`);
    await sleep(500);
    const syncMoves = await evalJson(cdp, `
      var g = window.__game;
      var applied = 0;
      for (var i=0;i<6;i++){ var r = g.playLegalEdge(); if (!r || !r.ok) break; applied++; }
      var now = g.getState();
      return { requested: 6, applied: applied, moveCountAfterLoop: now.moveCount, remaining: now.remaining };
    `);
    await sleep(1200);
    const syncMovesLate = await evalJson(cdp, `var st = window.__game.getState(); return { moveCountAfterSettle: st.moveCount };`);
    // (b) Tương thích cuộn ngang: thêm div rộng 2000px rồi kiểm tràn ngang (trước đây cả trang bị `overflow-x: hidden/hidden visible`
    //     sẽ cắt CSS overflow dọc, không cho phép document giãn ra để cuộn ngang nội dung bên trong).
    const scrollTest = await evalJson(cdp, `
      var probe = document.createElement('div');
      probe.id = 'audit-wide-probe';
      probe.style.cssText = 'width:2000px;height:8px;background:red;position:relative;z-index:0';
      document.body.appendChild(probe);
      var inner = document.querySelector('.app') || document.body;
      var docOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      var bodyOverflow = document.body.scrollWidth - document.body.clientWidth;
      var appOverflow = inner.scrollWidth - inner.clientWidth;
      var canScrollX = inner.scrollWidth > inner.clientWidth;
      probe.remove();
      return { docOverflowX: docOverflow, bodyOverflowX: bodyOverflow, appOverflowX: appOverflow, appScrollableX: canScrollX };
    `);
    // Mở Cài đặt (modal) để kiểm nút trong modal
    await evalRaw(cdp, `(function(){ var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return /Cài đặt/.test((x.getAttribute('aria-label')||'')+x.textContent);}); if(b) b.click(); return !!b; })()`);
    await sleep(450);
    const modal = await probeLayout(cdp);
    await evalRaw(cdp, `(function(){ var m=document.getElementById('modal'); if(!m) return; var c=document.getElementById('modal-close'); if(c) c.click(); })()`);
    await sleep(150);
    const errors = await evalJson(cdp, `return (window.__errors||[]).map(String)`);
    rows.push({
      viewport: v.name,
      boardMenu: menus.board ? `${menus.board.w}x${menus.board.h}` : null,
      reducedMotion: !!v.reduced,
      zoom: v.zoom || 1,
      overflowX: Math.max(menus.overflowX, play.overflowX, play2.overflowX, modal.overflowX),
      boardInside: play2.board ? play2.board.insideViewport : null,
      boardSize: play2.board ? `${play2.board.w}x${play2.board.h}` : null,
      smallButtons: Math.max(play2.smallButtonCount, modal.smallButtonCount),
      syncMoves: syncMoves,
      syncMovesAfterSettle: syncMovesLate.moveCountAfterSettle,
      scrollCompat: scrollTest,
      smallButtonSample: [...(play2.smallButtons || []), ...(modal.smallButtons || [])].slice(0, 5),
      buttonsChecked: Math.max(play2.buttonsChecked, modal.buttonsChecked),
      errors,
    });
  }
  await setMedia(cdp, false);
  await cdp.call('Emulation.clearDeviceMetricsOverride');
  return rows;
}

/* --------------------------------------------------------------- LEAKS */
async function runLeaks(cdp) {
  await setViewport(cdp, 390, 844, 2, true);
  await setMedia(cdp, false);
  await nav(cdp, ARGS.base + '?theme=light&debug=1', 1200);
  await cdp.call('HeapProfiler.enable').catch(() => {});
  const snapMetrics = async () => {
    const m = await cdp.call('Performance.getMetrics');
    const map = {};
    for (const x of m.metrics || []) map[x.name] = x.value;
    return {
      JSHeapUsedSizeMB: round((map.JSHeapUsedSize || 0) / 1048576, 2),
      JSEventListeners: map.JSEventListeners || 0,
      Nodes: map.Nodes || 0,
      LayoutObjects: map.LayoutObjects || 0,
      Documents: map.Documents || 0,
    };
  };
  // 1 chu kỳ = (đang ở menu) → ván 3x3 có timer → chơi hết ván → kết quả → bấm "Về menu" → menu.
  const TO_MENU = `
    (function(){
      var btn = document.getElementById('btn-result-menu') || document.querySelector('button[aria-label="Quay lại"]');
      if (btn) btn.click();
      var ok = document.getElementById('confirm-ok');
      if (ok) ok.click();
      var modal = document.getElementById('modal');
      if (modal && !modal.hidden) { var c = document.getElementById('modal-close'); if (c) c.click(); }
    })()`;
  const CYCLE = `
    (function(){
      var g = window.__game;
      if (!g) return 'NO_HOOK';
      g.startGame({mode:'pvp', size:3, first:'you', timeLimitOn:false});
      for (var k=0;k<40;k++){ var st=g.getState(); if(!st||st.over) break; g.playLegalEdge(); }
      ${TO_MENU}
      var s2 = g.getState();
      return s2 ? s2.screen : 'menu';
    })()`;
  const CYCLE_CLOSE_MODAL = `(function(){ var m = document.getElementById('modal'); if (m && !m.hidden) { var c = document.getElementById('modal-close'); if (c) { c.click(); return 'closed'; } } return 'none'; })()`;
  await evalRaw(cdp, TO_MENU);
  await sleep(1200);
  await cdp.call('HeapProfiler.collectGarbage').catch(() => {});
  await sleep(200);
  const base = await snapMetrics();
  const states = [];
  for (let i = 0; i < 30; i++) {
    states.push(await evalRaw(cdp, CYCLE));
    // Mỗi ván có timer 10s; 30 ván liên tục sẽ hết giờ giữa chừng & bật modal → đóng modal cho sạch.
    await evalRaw(cdp, CYCLE_CLOSE_MODAL);
    await sleep(160);
  }
  await sleep(1500);
  await cdp.call('HeapProfiler.collectGarbage').catch(() => {});
  await sleep(300);
  const after = await snapMetrics();
  const screen = await evalRaw(cdp, `(function(){ var st = window.__game.getState(); return st ? st.screen : "menu(no game)"; })()`);
  return {
    cycles: 30,
    cycleScreens: [...new Set(states)],
    screenAfter: screen,
    baseline: base,
    after,
    deltaListeners: after.JSEventListeners - base.JSEventListeners,
    deltaNodes: after.Nodes - base.Nodes,
    deltaHeapMB: round(after.JSHeapUsedSizeMB - base.JSHeapUsedSizeMB, 2),
  };
}

/* -------------------------------------------------------------- ROBUST */
const STORAGE_THROW = `Object.defineProperty(window, 'localStorage', { configurable: true, get: function(){ throw new DOMException('Blocked by policy', 'SecurityError'); } });`;
const CRYPTO_MISSING = `Object.defineProperty(window, 'crypto', { configurable: true, value: { getRandomValues: undefined } });`;
const VIBRATE_MISSING = `Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: undefined });`;
const ROUNDRECT_MISSING = `try { delete CanvasRenderingContext2D.prototype.roundRect; } catch(e){} Object.defineProperty(CanvasRenderingContext2D.prototype, 'roundRect', { configurable: true, value: undefined });`;
const RESIZEOBSERVER_MISSING = `Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: undefined });`;
const AUDIO_HANG = `window.AudioContext = function(){ throw new Error('AudioContext blocked'); }; window.webkitAudioContext = window.AudioContext;`;
const AUDIO_SUSPEND = `(function(){ var Orig = window.AudioContext; window.AudioContext = function(){ var c = new Orig(); c.suspend(); return c; }; })();`;

async function bootWith(cdp, injectScript, opts = {}) {
  await cdp.call('Page.navigate', { url: 'about:blank' });
  await sleep(120);
  const { identifier } = await cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: injectScript });
  try {
    await nav(cdp, ARGS.base + '?theme=light&debug=1', 1300);
    // Chạm giả để mở khoá audio (bắt lỗi nếu AudioContext treo/ném).
    await evalRaw(cdp, `(function(){ try { window.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})); } catch(e){} })()`);
    await sleep(opts.settle || 500);
    const res = await evalJson(cdp, `
      var g = window.__game;
      var out = { bootOk: !!window.__bootOk, hook: !!g, errors: (window.__errors||[]).slice(0, 5) };
      if (!g) return out;
      try {
        g.startGame({mode:'ai', size:5, difficulty:'hard', first:'you', timeLimitOn:true, timeSec:10});
        for (var i=0;i<6;i++) { var r = g.playLegalEdge(); if (!r || !r.ok) break; }
        g.setTheme('dark');
        var st = g.getState();
        out.state = st ? { n: st.n, moveCount: st.moveCount, over: st.over, screen: st.screen } : null;
        out.errorsAfter = (window.__errors||[]).slice(0, 5);
      } catch (e) { out.threw = String(e && e.stack || e); }
      return out;
    `);
    return res;
  } finally {
    await cdp.call('Page.removeScriptToEvaluateOnNewDocument', { identifier }).catch(() => {});
  }
}

async function runRobust(cdp) {
  await setViewport(cdp, 390, 844, 2, true);
  await setMedia(cdp, false);
  const cases = [
    ['baseline', ''],
    ['localStorage-blocked', STORAGE_THROW],
    ['crypto-getRandomValues-missing', CRYPTO_MISSING],
    ['navigator-vibrate-missing', VIBRATE_MISSING],
    ['ctx.roundRect-missing', ROUNDRECT_MISSING],
    ['ResizeObserver-missing', RESIZEOBSERVER_MISSING],
    ['AudioContext-throws', AUDIO_HANG],
    ['AudioContext-suspended', AUDIO_SUSPEND],
  ];
  const out = [];
  for (const [name, src] of cases) {
    try {
      const r = await bootWith(cdp, src);
      const errs = (r.errors || []).concat(r.errorsAfter || []);
      out.push({
        case: name,
        bootOk: r.bootOk,
        hook: r.hook,
        played: !!(r.state && r.state.moveCount >= 5),
        threw: r.threw || null,
        errors: errs.length,
        errorSample: errs.slice(0, 2),
      });
    } catch (e) {
      out.push({ case: name, fatal: String(e.message || e) });
    }
  }
  return out;
}

/* ---------------------------------------------------------------- EDGE */
async function runEdge(cdp) {
  const out = {};
  await setViewport(cdp, 390, 844, 2, true);
  await setMedia(cdp, false);
  await nav(cdp, ARGS.base + '?theme=light&debug=1', 1200);

  // (a) Hết giờ + máy đi SÁT mốc hết giờ (timer 10s, máy bị hoãn tới 9.9s bằng modal) →
  //     mỗi lần chỉ được đúng 1 nước (không double-move) và moveCount phải tăng đúng 1/lượt.
  out.timeoutVsAi = await evalJson(cdp, `
    return new Promise(function(done){
      var g = window.__game;
      g.startGame({mode:'ai', size:6, difficulty:'easy', first:'com', timeLimitOn:true, timeSec:10});
      var samples = [];
      var t0 = performance.now();
      var iv = setInterval(function(){
        var st = g.getState();
        if (st) samples.push({ t: Math.round(performance.now() - t0), moves: st.moveCount, turn: st.turn, seq: st.turnSeq });
      }, 50);
      setTimeout(function(){
        clearInterval(iv);
        var st2 = g.getState();
        var steps = samples.filter(function(s, i){ return i > 0 && s.moves !== samples[i-1].moves; })
          .map(function(s){ return s.moves - (samples[samples.indexOf(s)-1] || {moves:s.moves}).moves; });
        done({
          seconds: 12.5,
          finalMoves: st2.moveCount,
          finalTurn: st2.turn,
          over: st2.over,
          moveJumps: steps,
          maxJump: steps.length ? Math.max.apply(null, steps) : 0,
          errors: (window.__errors || []).length
        });
      }, 12500);
    });`, true);

  // (b) Đổi theme GIỮA lúc đang animate.
  out.themeDuringAnim = await evalJson(cdp, `
    var g = window.__game;
    g.startGame({mode:'pvp', size:8, first:'you', timeLimitOn:false});
    for (var i=0;i<12;i++){
      g.playLegalEdge();
      g.setTheme(i%2===0 ? 'dark' : 'light');
    }
    var st = g.getState();
    return { moveCount: st.moveCount, theme: st.theme, boardW: Math.round(document.getElementById('board').getBoundingClientRect().width), errors: (window.__errors||[]).slice(0,3) };
  `);
  await sleep(900);
  out.themeDuringAnim.afterSettle = await evalJson(cdp, `
    var c = document.getElementById('board');
    var px = c.getContext('2d').getImageData(Math.round(c.width/2), Math.round(c.height/2), 1, 1).data;
    return { canvasW: c.width, centerPixel: [px[0], px[1], px[2], px[3]], errors: (window.__errors||[]).length };
  `);
  await evalRaw(cdp, `window.__game.setTheme('light')`);

  // (c) Đổi kích thước cửa sổ GIỮA lúc đang animate.
  try {
    await evalRaw(cdp, `window.__game.startGame({mode:'pvp', size:8, first:'you'})`);
    const sizes = [[320, 568], [768, 1024], [667, 375], [390, 844]];
    for (const [w, h] of sizes) {
      await evalRaw(cdp, `window.__game.playLegalEdge(); window.__game.playLegalEdge();`);
      await setViewport(cdp, w, h, 2, true);
      await sleep(220);
    }
    await sleep(500);
    out.resizeDuringAnim = await evalJson(cdp, `
      var c = document.getElementById('board');
      var r = c.getBoundingClientRect();
      return { boardW: Math.round(r.width), boardH: Math.round(r.height), overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, errors: (window.__errors||[]).length };
    `);
  } catch (e) {
    out.resizeDuringAnim = { error: String(e.message) };
  }

  // (d) Tab ẩn rồi hiện lại giữa lượt: pause hẳn lifecycle của trang rồi khôi phục.
  await evalRaw(cdp, `window.__game.startGame({mode:'ai', size:5, difficulty:'medium', first:'you', timeLimitOn:true, timeSec:20})`);
  await sleep(300);
  await evalRaw(cdp, `window.__ggMark = { t: performance.now(), moves: window.__game.getState().moveCount }`);
  try {
    await cdp.call('Page.setWebLifecycleState', { state: 'frozen' });
    await sleep(2000);
    await cdp.call('Page.setWebLifecycleState', { state: 'active' });
    await sleep(1200);
    out.hiddenTab = await evalJson(cdp, `
      var st = window.__game.getState();
      return { frozenMs: 2000, movesAfter: st.moveCount, over: st.over, errors: (window.__errors||[]).length };
    `);
  } catch (e) {
    out.hiddenTab = { freezeError: String(e.message) };
  }

  // (e) Ván 3×3 hết sạch cạnh khi đang bật timer.
  out.fullBoardWithTimer = await evalJson(cdp, `
    var g = window.__game;
    g.startGame({mode:'pvp', size:3, first:'you', timeLimitOn:true, timeSec:10});
    var n = 0;
    while (n < 100) { var r = g.playLegalEdge(); if(!r || !r.ok) break; n++; }
    var st = g.getState();
    return { moves: n, over: st.over, score: st.score, remaining: st.remaining, clockVisible: !document.getElementById('hud-clock').hidden, errors: (window.__errors||[]).length };
  `);

  // (f) Bấm "Ván mới" 5 lần liên tiếp (nút thật → hộp xác nhận → xác nhận).
  out.newGameX5 = await evalJson(cdp, `
    var g = window.__game;
    g.startGame({mode:'pvp', size:5, first:'you', timeLimitOn:true, timeSec:10});
    g.playLegalEdge();
    var btn = document.getElementById('btn-new');
    var clicks = 0;
    var modalsSeen = 0;
    for (var i=0;i<5;i++){
      if (btn && !btn.disabled) { btn.click(); clicks++; }
      var modal = document.getElementById('modal');
      if (modal && !modal.hidden) modalsSeen++;
      var ok = document.getElementById('confirm-ok');
      if (ok) ok.click();
    }
    var st = g.getState();
    return { clicks: clicks, modalsSeen: modalsSeen, screen: st.screen, moveCount: st.moveCount, over: st.over, errors: (window.__errors||[]).length };
  `);

  // (g) Mở "Luật" / "Cài đặt" khi timer đang chạy → đồng hồ phải TẠM DỪNG.
  const clockPauseProbe = (btnId) => `
    return new Promise(function(done){
      var g = window.__game;
      g.startGame({mode:'pvp', size:5, first:'you', timeLimitOn:true, timeSec:10});
      setTimeout(function(){
        var clock = document.getElementById('hud-clock-text');
        var a = clock.textContent;
        var btn = document.getElementById('${btnId}');
        btn.click();
        var open = !document.getElementById('modal').hidden;
        var a2 = clock.textContent;
        setTimeout(function(){
          var b = clock.textContent;
          var c = document.getElementById('modal-close');
          if (c) c.click();
          setTimeout(function(){
            var after = clock.textContent;
            // sau khi đóng modal, đồng hồ phải chạy tiếp
            setTimeout(function(){
              var st = g.getState();
              done({ modalOpen: open, atOpen: a, twoSecLater: b, paused: a2 === b, resumedAfterClose: after !== b || after === '0:10', clockAfterClose: after, over: st.over, errors: (window.__errors||[]).length });
            }, 1500);
          }, 300);
        }, 2000);
      }, 500);
    });`;
  out.modalPausesClockRules = await evalJson(cdp, clockPauseProbe("btn-help"), true);
  out.modalPausesClockSettings = await evalJson(cdp, clockPauseProbe('btn-settings'), true);

  // (h) Bấm phím mũi tên / Enter khi ở MENU và khi modal mở.
  out.keysInMenu = await evalJson(cdp, `
    var g = window.__game;
    var back = document.getElementById('btn-back');
    var t0 = performance.now();
    var tries = 0;
    function press(){
      ['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Enter',' '].forEach(function(k){
        document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
        if (document.activeElement) document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      });
    }
    return new Promise(function(done){
      // Ván đang chơi → bấm Quay lại → hộp xác nhận → đồng ý → về menu.
      if (back) back.click();
      var ok = document.getElementById('confirm-ok');
      if (ok) ok.click();
      setTimeout(function(){
        var st0 = g.getState();
        press(); press();
        var st1 = g.getState();
        done({ screenBefore: st0 ? st0.screen : 'menu', moveCountBefore: st0 ? st0.moveCount : null, screenAfter: st1 ? st1.screen : 'menu', moveCountAfter: st1 ? st1.moveCount : null, activeElement: (document.activeElement && document.activeElement.id) || document.activeElement.tagName, errors: (window.__errors||[]).length });
      }, 700);
    });`, true);
  out.keysInModal = await evalJson(cdp, `
    return new Promise(function(done){
      var g = window.__game;
      g.startGame({mode:'pvp', size:5, first:'you', timeLimitOn:false});
      setTimeout(function(){
        document.getElementById('btn-help').click();
        var before = g.getState().moveCount;
        var panel = document.getElementById('modal-panel');
        for (var i=0;i<10;i++){
          ['ArrowRight','ArrowDown','Enter',' '].forEach(function(k){
            panel.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
            document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
          });
        }
        setTimeout(function(){
          var after = g.getState().moveCount;
          var c = document.getElementById('modal-close'); if (c) c.click();
          done({ movesBefore: before, movesAfter: after, keysDidNotMove: before === after, focusTrapped: !!document.getElementById('modal-panel').contains(document.activeElement) || document.activeElement === document.body, errors: (window.__errors||[]).length });
        }, 500);
      }, 500);
    });`, true);

  // (i) prefers-reduced-motion: reduce → E1..E5 tắt: đi 6 nước xong bàn phải-tĩnh (rAF = 0 ngay).
  await setMedia(cdp, true);
  await nav(cdp, ARGS.base + '?theme=light&debug=1', 1200);
  await installRafCounter(cdp);
  out.reducedMotion = await evalJson(cdp, `
    return new Promise(function(done){
      var g = window.__game;
      g.startGame({mode:'pvp', size:5, first:'you', timeLimitOn:false});
      window.__rafReset();
      for (var i=0;i<6;i++) g.playLegalEdge();
      setTimeout(function(){
        done({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, rafAfterMoves: window.__rafCount, errors: (window.__errors||[]).length });
      }, 700);
    });`, true);
  await setMedia(cdp, false);
  await cdp.call('Emulation.clearDeviceMetricsOverride');
  return out;
}

/* -------------------------------------------------------------- PRINT */
function printSummary(report, errs) {
  const L = [];
  L.push('');
  L.push(`=== perf-audit ${report.label ? '(' + report.label + ') ' : ''}== ${report.when}`);
  L.push(`Chrome: ${(report.meta.browser || '').slice(0, 90)}`);
  L.push(`Base  : ${report.base}`);
  L.push(`Bundle: ${report.bundle}`);
  const p = report.results.perf;
  if (p) {
    L.push('');
    L.push('-- HIỆU NĂNG --');
    if (p.fpsAnimating8x8) {
      const f = p.fpsAnimating8x8;
      L.push(`FPS khi animate 8×8 : ${f.fps} fps (${f.frames} khung / ${f.ms}ms, avg ${f.avgFrameMs}ms, p95 ${f.p95FrameMs}ms, khung >33ms: ${f.framesOver33ms})`);
    }
    if (p.rafWhenIdle3s) L.push(`rAF khi bàn TĨNH 3s : ${p.rafWhenIdle3s.rafCount} lần gọi requestAnimationFrame (callback app: ${p.rafWhenIdle3s.rafByApp}) → ${p.rafWhenIdle3s.rafCount === 0 ? 'ĐẠT' : 'CHƯA ĐẠT'}`);
    if (p.rafWhenIdleMenu2s) L.push(`rAF khi ở MENU 2s  : ${p.rafWhenIdleMenu2s.rafCount} lần → ${p.rafWhenIdleMenu2s.rafCount === 0 ? 'ĐẠT' : 'KHÔNG ĐẠT'}`);
    if (p.chooseMove8x8) L.push(`chooseMove 8×8     : ${p.chooseMove8x8.avgMs}ms TB, p95 ${p.chooseMove8x8.p95Ms}ms, max ${p.chooseMove8x8.maxMs}ms`);
    if (p.heap60s) L.push(`Heap 60s chơi      : ${p.heap60s.heapStartMB}MB → ${p.heap60s.heapEndMB}MB (min ${p.heap60s.heapMinMB}, max ${p.heap60s.heapMaxMB}); DOM node ${p.heap60s.nodeStart} → ${p.heap60s.nodeEnd} (max ${p.heap60s.nodeMax})`);
    if (p.cdpMetrics) L.push(`CDP metrics        : JSHeapUsedSize ${p.cdpMetrics.JSHeapUsedSizeMB}MB, Nodes ${p.cdpMetrics.Nodes}, JSEventListeners ${p.cdpMetrics.JSEventListeners}`);
    for (const [k, v] of Object.entries(p.load || {})) {
      L.push(`Tải ${k.padEnd(7)}      : DCL ${v.domContentLoadedMs}ms, load ${v.loadMs}ms, HTML ${(v.transferSize / 1024).toFixed(1)}KB, tệp ${(v.fileBytes / 1024).toFixed(1)}KB, ${v.resourceCount} tài nguyên`);
    }
  }
  const c = report.results.compat;
  if (c) {
    L.push('');
    L.push('-- TƯƠNG THÍCH (overflowX / bàn nằm gọn / nút <44px) --');
    for (const r of c) L.push(`${r.viewport.padEnd(24)} overflowX=${r.overflowX} board=${r.boardSize} inside=${r.boardInside} small=<${r.smallButtons} syncMoves=${r.syncMoves ? r.syncMoves.moveCountAfterLoop : '?'} appScrollX=${r.scrollCompat ? r.scrollCompat.appScrollableX : '?'}${r.errors.length ? ' ERR=' + r.errors.length : ''}`);
  }
  const l = report.results.leaks;
  if (l) {
    L.push('');
    L.push(`-- RÒ RỈ (${l.cycles} chu kỳ chuyển màn) -- listener Δ${l.deltaListeners}, node Δ${l.deltaNodes}, heap ${l.baseline.JSHeapUsedSizeMB}MB → ${l.after.JSHeapUsedSizeMB}MB (Δ${l.deltaHeapMB}MB) màn sau=${l.screenAfter}`);
  }
  const rb = report.results.robust;
  if (rb) {
    L.push('');
    L.push('-- CHẾ ĐỘ SUY GIẢM --');
    for (const r of rb) L.push(`${String(r.case).padEnd(32)} boot=${r.bootOk} played=${r.played} errors=${r.errors}${r.fatal ? ' FATAL ' + r.fatal : ''}${r.threw ? ' THREW ' + String(r.threw).slice(0, 60) : ''}`);
  }
  const e = report.results.edge;
  if (e) {
    L.push('');
    L.push('-- KỊCH BẢN BIÊN --');
    L.push(JSON.stringify(e, null, 1).split('\n').slice(0, 90).join('\n'));
  }
  L.push('');
  L.push(`Lỗi JS/console (đã lọc favicon/SW): ${errs.length}`);
  for (const x of errs.slice(0, 10)) L.push(' * ' + x.type + ' → ' + String(x.text).slice(0, 160));
  L.push(`Đã ghi: ${ARGS.out}`);
  console.log(L.join('\n'));
}

main().catch((e) => { console.error('LỖI:', e && e.stack ? e.stack : e); process.exit(1); });
