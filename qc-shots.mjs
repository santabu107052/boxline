#!/usr/bin/env bun
/**
 * qc-shots.mjs — Bộ chụp ảnh kiểm thử tự động cho Boxline (dùng CDP, Bun fetch + WebSocket).
 * Chạy:  bun qc-shots.mjs <BASE_URL> <OUT_DIR> [SCENARIO...]
 * Ví dụ: bun qc-shots.mjs http://127.0.0.1:8799/ screenshots-qc
 *        bun qc-shots.mjs file:///abs/path/bundle.html screenshots-qc
 *
 * Mỗi kịch bản: viewport + theme + (tuỳ chọn) preset game + các nước đi + tuỳ chọn mở modal.
 * Không sửa code sản phẩm: chỉ dùng `window.__game` (debug hook đã có) và query param `?theme=`.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];

const BASE = process.argv[2] || "http://127.0.0.1:8799/index.html";
const OUT = resolve(process.argv[3] || "screenshots-qc");
const ONLY = process.argv.slice(4);

const SCENARIOS = [
  { name: "r01-menu-light-390", url: "?theme=light", w: 390, h: 844, mobile: true, settle: 900 },
  { name: "r02-menu-dark-390", url: "?theme=dark", w: 390, h: 844, mobile: true, settle: 900 },
  { name: "r03-menu-light-320", url: "?theme=light", w: 320, h: 568, mobile: true, settle: 900, scrollBottom: true },
  { name: "r04-menu-light-landscape", url: "?theme=light", w: 667, h: 375, mobile: true, settle: 900, scrollBottom: true },
  { name: "r05-menu-dark-desktop", url: "?theme=dark", w: 1280, h: 800, mobile: false, settle: 900 },
  {
    name: "r06-play-light-5x5",
    url: "?theme=light&debug=1",
    w: 390,
    h: 844,
    mobile: true,
    settle: 700,
    preset: { mode: "ai", size: 5, difficulty: "medium", first: "you" },
    moves: [[1, 2, "H"], [1, 2, "H"], [2, 1, "V"], [3, 3, "H"], [1, 0, "H"], [4, 2, "V"]],
  },
  {
    name: "r07-play-dark-8x8",
    url: "?theme=dark&debug=1",
    w: 390,
    h: 844,
    mobile: true,
    settle: 700,
    preset: { mode: "ai", size: 8, difficulty: "hard", first: "you" },
    moves: [[4, 4, "H"], [1, 1, "H"], [6, 6, "V"], [2, 5, "H"], [7, 7, "H"], [3, 3, "V"]],
  },
  {
    name: "r08-play-light-3x3-finish",
    url: "?theme=light&debug=1",
    w: 390,
    h: 844,
    mobile: true,
    settle: 700,
    preset: { mode: "pvp", size: 3, first: "you" },
    playAll: true,
  },
  {
    name: "r09-result-light",
    url: "?theme=light&debug=1",
    w: 390,
    h: 844,
    mobile: true,
    settle: 1200,
    preset: { mode: "pvp", size: 3, first: "you" },
    playAll: true,
    after: "result",
  },
  {
    name: "r10-result-dark",
    url: "?theme=dark&debug=1",
    w: 390,
    h: 844,
    mobile: true,
    settle: 1200,
    preset: { mode: "ai", size: 4, difficulty: "easy", first: "you" },
    playAll: true,
    after: "result",
  },
  { name: "r11-guide-light", url: "?theme=light&debug=1", w: 390, h: 844, mobile: true, settle: 900, after: "guide", scrollBottom: true },
  { name: "r12-tutorial-step2-dark", url: "?theme=dark&debug=1", w: 390, h: 844, mobile: true, settle: 900, after: "tutorialStep2" },
  { name: "r13-tutorial-decoy-light", url: "?theme=light&debug=1", w: 390, h: 844, mobile: true, settle: 900, after: "tutorialDecoy" },
  { name: "r14-settings-dark-desktop", url: "?theme=dark&debug=1", w: 1280, h: 800, mobile: false, settle: 900, after: "settings" },
  { name: "r15-rules-light", url: "?theme=light&debug=1", w: 390, h: 844, mobile: true, settle: 900, preset: { mode: "ai", size: 5, difficulty: "medium", first: "you" }, moves: [[2, 2, "H"]], after: "rules" },
  { name: "r16-zoom200-menu-dark", url: "?theme=dark", w: 390, h: 844, mobile: true, settle: 900, zoom: 2, scrollBottom: true },
  { name: "r17-menu-sizes-320", url: "?theme=light", w: 320, h: 568, mobile: true, settle: 1500 },
  { name: "r17b-menu-sizes-390", url: "?theme=light", w: 390, h: 844, mobile: true, settle: 1500 },
  { name: "r17c-menu-sizes-320-scrolled", url: "?theme=light", w: 320, h: 568, mobile: true, settle: 1500, before: "seedGuideDone", after: "scrollMenuBottom" },
  {
    name: "r18-play-12x12-dark",
    url: "?theme=dark&debug=1",
    w: 390,
    h: 844,
    mobile: true,
    settle: 700,
    preset: { mode: "ai", size: 12, difficulty: "hard", first: "you" },
    moves: [[2, 2, "H"], [3, 3, "V"], [10, 10, "H"], [11, 11, "V"]],
  },
  {
    name: "r19-play-12x12-320",
    url: "?theme=light&debug=1",
    w: 320,
    h: 568,
    mobile: true,
    settle: 700,
    preset: { mode: "ai", size: 12, difficulty: "easy", first: "you" },
    moves: [[5, 5, "H"]],
  },
  {
    name: "r20-keepsturn-toast",
    url: "?theme=light&debug=1",
    w: 390,
    h: 844,
    mobile: true,
    settle: 600,
    preset: { mode: "pvp", size: 3, first: "you" },
    keepTurn: true,
    after: "keepTurnToast",
  },
];

function pickChrome() {
  for (const p of CHROME_PATHS) if (existsSync(p)) return p;
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitJson(port, tries = 100) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page;
    } catch { /* chưa lên */ }
    await sleep(150);
  }
  throw new Error("CDP không lên sau 15s");
}

function connect(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    let id = 0;
    ws.onopen = () => res({
      ws,
      call(method, params = {}) {
        const mid = ++id;
        return new Promise((resolve, reject) => {
          pending.set(mid, { resolve, reject });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      },
    });
    ws.onerror = (e) => rej(new Error("ws lỗi: " + (e?.message || "unknown")));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
  });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const chrome = pickChrome();
  if (!chrome) throw new Error("Không tìm thấy Chrome/Chromium/Edge");
  const port = 9500 + Math.floor(Math.random() * 400);
  const userDir = `/tmp/boxline-qc-${port}`;
  const proc = spawn(chrome, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
    "--no-first-run", "--no-default-browser-check", "--disable-extensions",
    `--user-data-dir=${userDir}`, `--remote-debugging-port=${port}`,
    "--window-size=390,844", "about:blank",
  ], { stdio: "ignore", detached: false });

  const report = { chrome, port, results: [], errors: [] };
  try {
    const page = await waitJson(port);
    const cdp = await connect(page.webSocketDebuggerUrl);
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Log.enable");
    cdp.ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === "Runtime.exceptionThrown") report.errors.push({ type: "exception", text: m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text });
      if (m.method === "Log.entryAdded" && ["error", "warning"].includes(m.params.entry.level)) {
        report.errors.push({ type: "console." + m.params.entry.level, text: m.params.entry.text, url: m.params.entry.url });
      }
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
        report.errors.push({ type: "console.error", text: (m.params.args || []).map((a) => a.value ?? a.description).join(" ") });
      }
    });

    const scenarios = ONLY.length ? SCENARIOS.filter((s) => ONLY.some((o) => s.name.includes(o))) : SCENARIOS;
    for (const s of scenarios) {
      report.results.push(await runScenario(cdp, s));
    }
    await cdp.call("Browser.close").catch(() => {});
  } finally {
    try { proc.kill("SIGKILL"); } catch { /* đã chết */ }
  }
  writeFileSync(resolve(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\nĐã chụp ${report.results.length} ảnh vào ${OUT}`);
  for (const r of report.results) console.log(` - ${r.name}: ${r.ok ? "OK" : "FAIL"} ${r.note || ""}`);
  const errs = report.errors.filter((e) => !/favicon|sw\.js|Failed to load resource/i.test(e.text || ""));
  console.log(`\nLỗi JS/console (sau khi lọc favicon/SW): ${errs.length}`);
  for (const e of errs.slice(0, 20)) console.log(" *", e.type, "→", e.text);
}

async function runScenario(cdp, s) {
  const out = { name: s.name, url: s.url, viewport: `${s.w}x${s.h}`, ok: false, note: "" };
  try {
    await cdp.call("Emulation.setDeviceMetricsOverride", {
      width: s.w, height: s.h, deviceScaleFactor: 2, mobile: !!s.mobile,
      screenWidth: s.w, screenHeight: s.h,
    });
    await cdp.call("Page.navigate", { url: BASE + s.url });
    await sleep(s.settle || 800);

    if (s.before && s.before === "seedGuideDone") {
      // Đánh dấu đã học tutorial rồi tải lại: trạng thái "người dùng đã xem hướng dẫn" (thực tế hay gặp).
      await cdp.call("Runtime.evaluate", { expression: `localStorage.setItem('db_tutorial_done','true')` });
      await cdp.call("Page.navigate", { url: BASE + s.url });
      await sleep(1800);
    }

    if (s.before && s.before === "closeGuide") {
      // Lần đầu mở game, màn "Hướng dẫn nhanh" tự bật — đóng nó để chụp menu phía dưới.
      const r0 = await cdp.call("Runtime.evaluate", {
        expression: `(function(){
          const b=[...document.querySelectorAll('button')].find(x=>/^\s*Bỏ qua\s*$/.test(x.textContent||''));
          const c=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='Đóng');
          if (b) { b.click(); }
          else if (c) { c.click(); }
          // Ghi chú: KHÔNG bấm nút "Về menu" (có hộp xác nhận) — chỉ đóng hướng dẫn là tới menu.
          // Nếu app đang ở màn chơi (trạng thái đã lưu) thì gọi hook về menu cho nhanh, không qua modal.
          const g = document.querySelector('#screen-play');
          if (g && !g.hidden && window.__game && typeof window.__game.showMenu === 'function') {
            window.__game.showMenu();
            return 'showMenu';
          }
          return b ? 'skip' : (c ? 'close' : 'none');
        })()`, returnByValue: true,
      });
      out.note += ` [guide=${r0.result.value}]`;
      await sleep(700);
    }

    if (s.zoom) {
      await cdp.call("Runtime.evaluate", { expression: `document.documentElement.style.zoom='${s.zoom}'` });
      await sleep(300);
    }

    if (s.preset) {
      const r = await cdp.call("Runtime.evaluate", {
        expression: `(function(){ if(!window.__game) return 'NO_HOOK'; window.__game.startGame(${JSON.stringify(s.preset)}); return 'OK'; })()`,
        returnByValue: true,
      });
      out.note += r.result.value === "OK" ? "" : ` [hook=${r.result.value}]`;
      await sleep(900);
    }

    if (s.moves) {
      for (const e of s.moves) {
        await cdp.call("Runtime.evaluate", {
          expression: `window.__game.playEdge(${JSON.stringify(e)})`,
          returnByValue: true,
        });
        await sleep(320);
      }
    }

    if (s.playAll) {
      let last = "";
      for (let i = 0; i < 400; i++) {
        const r = await cdp.call("Runtime.evaluate", {
          expression: `(function(){
            const g = window.__game;
            let st = g.getState();
            if (!st) return 'NO_STATE';
            if (st.over) return 'DONE';
            const before = st.moveCount;
            const res = g.playLegalEdge();
            return res && res.ok ? 'MOVE' : (g.getState().over ? 'DONE' : 'STUCK:' + before);
          })()`,
          returnByValue: true,
        });
        last = r.result.value;
        if (last !== "MOVE") break;
        await sleep(60);
      }
      out.note += ` [playAll=${last}]`;
      await sleep(1200);
    }

    if (s.keepTurn) {
      const moves = [[0, 0, "H"], [0, 0, "V"], [1, 0, "H"], [0, 1, "V"]];
      for (const e of moves) {
        await cdp.call("Runtime.evaluate", { expression: `window.__game.playEdge(${JSON.stringify(e)})`, returnByValue: true });
        await sleep(450);
      }
      await sleep(250);
    }

    if (s.after && window_actions[s.after]) {
      const ok = await window_actions[s.after](cdp, s);
      out.note += ok ? "" : " [after thất bại]";
    }

    if (s.scrollBottom) {
      await cdp.call("Runtime.evaluate", { expression: "window.scrollTo(0, document.body.scrollHeight)" });
      await sleep(250);
    }

    // Đo lỗi runtime tích luỹ + tràn ngang
    const probe = await cdp.call("Runtime.evaluate", {
      expression: `JSON.stringify({
        errors: (window.__errors||[]).map(e=>String(e && (e.message||e))),
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        title: document.title,
        canvas: (()=>{const c=document.querySelector('canvas'); return c? [c.style.width, c.style.height]:null})(),
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        themeBg: getComputedStyle(document.documentElement).getPropertyValue('--surface-0').trim()
      })`,
      returnByValue: true,
    });
    out.probe = JSON.parse(probe.result.value || "{}");

    const shot = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(resolve(OUT, s.name + ".png"), Buffer.from(shot.data, "base64"));
    out.ok = true;
  } catch (e) {
    out.note += " [lỗi: " + e.message + "]";
  }
  return out;
}

const window_actions = {
  async result(cdp) {
    const r = await cdp.call("Runtime.evaluate", {
      expression: `(function(){
        const sel = ['[data-testid="result"]','.result','#result','.modal--result','dialog[open] .result','.screen-result'];
        for (const q of sel) { const el = document.querySelector(q); if (el) return 'found:' + q; }
        const anyOpen = document.querySelector('.modal[open], dialog[open], .modal.is-open, .modal--open, [data-screen="result"]');
        return anyOpen ? 'open:' + anyOpen.className : 'none';
      })()`,
      returnByValue: true,
    });
    await sleep(700);
    return String(r.result.value).startsWith("found") || String(r.result.value).startsWith("open");
  },
  async guide(cdp) {
    await cdp.call("Runtime.evaluate", {
      expression: `(function(){
        const btns=[...document.querySelectorAll('button,a')].filter(b=>/Hướng dẫn|hướng dẫn/.test(b.textContent||''));
        if(btns[0]) btns[0].click(); return btns.length;
      })()`,
    });
    await sleep(800);
    return true;
  },
  async tutorialStep2(cdp) {
    // Mở tutorial, đi qua bước 1 (bấm một cạnh ngang hàng giữa), rồi chụp bước 2.
    await cdp.call("Runtime.evaluate", {
      expression: `(function(){
        const b=[...document.querySelectorAll('button')];
        const g=b.find(x=>/Chơi thử Tutorial|Hướng dẫn nhanh/.test(x.textContent||''));
        if (g) g.click();
        return !!g;
      })()`,
    });
    await sleep(900);
    await cdp.call("Runtime.evaluate", {
      expression: `(function(){
        const b=[...document.querySelectorAll('button')];
        const t=b.find(x=>/Chơi thử Tutorial/.test(x.textContent||''));
        if (t) t.click(); return !!t;
      })()`,
    });
    await sleep(900);
    await cdp.call("Runtime.evaluate", { expression: `window.__game && window.__game.playEdge && window.__game.playEdge([1,1,'H'])` });
    await sleep(1400);
    return true;
  },
  async tutorialDecoy(cdp) {
    const r = await cdp.call("Runtime.evaluate", {
      expression: `(function(){
        const g = window.__game || {};
        if (typeof g.gotoTutorialStep === 'function') { g.gotoTutorialStep(4); return 'goto4'; }
        return 'nosupport';
      })()`, returnByValue: true,
    });
    await sleep(900);
    return r.result.value !== "nosupport";
  },
  async scrollMenuBottom(cdp) {
    const r = await cdp.call("Runtime.evaluate", {
      expression: `JSON.stringify((()=>{
        const m = document.querySelector('#screen-menu .menu');
        if (!m) return { ok:false };
        m.scrollTop = 99999;
        const segs = ['#seg-difficulty','#seg-size','#seg-first'].map(sel => {
          const el = document.querySelector(sel); if (!el) return null;
          const r = el.getBoundingClientRect(), mm = m.getBoundingClientRect();
          return { sel, inMenuView: r.top >= mm.top - 1 && r.bottom <= mm.bottom + 1 };
        });
        return { ok:true, scrollTop: Math.round(m.scrollTop), scrollable: m.scrollHeight > m.clientHeight, segs };
      })())`,
      returnByValue: true,
    });
    const info = JSON.parse(r.result.value || "{}");
    console.log("   scrollMenu →", JSON.stringify(info));
    await sleep(300);
    return info.ok === true;
  },
  async keepTurnToast(cdp) {
    // Đo xem thông báo có nằm trong khung bàn cờ không (yêu cầu: KHÔNG).
    const r = await cdp.call("Runtime.evaluate", {
      expression: `JSON.stringify((()=>{
        const toast = [...document.querySelectorAll('.toast')].find(t => t.classList.contains('is-visible'));
        const combo = document.querySelector('.combo-badge.is-visible');
        const board = (() => { const ws = [...document.querySelectorAll('.board-wrap')]; return ws.find(w => w.getBoundingClientRect().height > 10) || null; })();
        const b = board ? board.getBoundingClientRect() : null;
        const t = toast ? toast.getBoundingClientRect() : null;
        // Chỉ tính là "che bàn" khi tâm thông báo nằm TRONG khung vẽ bàn cờ (canvas), không phải
        // khi nó nằm ở dải đệm dưới bàn mà khung canvas kéo dài hết màn hình.
        const cv = document.querySelector('canvas#board');
        const c = cv ? cv.getBoundingClientRect() : b;
        const tcx = t ? (t.left + t.right) / 2 : 0;
        const tcy = t ? (t.top + t.bottom) / 2 : 0;
        const insideCanvas = !!(c && t) && tcx > c.left && tcx < c.right && tcy > c.top && tcy < c.bottom;
        const overlap = insideCanvas;
        return { toastText: toast ? toast.textContent.trim() : null, toastInsideBoard: overlap, toastY: t ? Math.round(tcy) : null, canvasBottom: c ? Math.round(c.bottom) : null,
                 comboText: combo ? combo.textContent.trim() : null };
      })())`,
      returnByValue: true,
    });
    const info = JSON.parse(r.result.value || "{}");
    console.log("   keepTurn →", JSON.stringify(info));
    return info.toastText !== null && info.toastInsideBoard === false;
  },
  async settings(cdp) {
    await cdp.call("Runtime.evaluate", {
      expression: `(function(){
        const b=[...document.querySelectorAll('button')];
        const s=b.find(x=>/Cài đặt|Tùy chọn|settings/i.test((x.getAttribute('aria-label')||'')+x.textContent));
        if (s) s.click(); return !!s;
      })()`,
    });
    await sleep(700);
    return true;
  },
  async rules(cdp) {
    await cdp.call("Runtime.evaluate", {
      expression: `(function(){
        const b=[...document.querySelectorAll('button')].find(x=>/^\\s*Luật|\\?\s*Luật|Xem luật/.test(x.textContent||''));
        if (b) b.click(); return !!b;
      })()`,
    });
    await sleep(700);
    return true;
  },
};

main().catch((e) => { console.error("LỖI:", e.message); process.exit(1); });
