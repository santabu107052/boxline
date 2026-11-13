#!/usr/bin/env node
/**
 * qc/audio-render.mjs — GHI ÂM LẠI âm thanh THẬT của game (Web Audio) để QC nghe/đo thay vì tin mã.
 *
 * Kết quả dùng trong 50-QC mục "Âm thanh" (bằng chứng: có tiếng thật, mức đỉnh, không méo).
 *
 * Cách làm:
 *  1. Bọc `AudioContext` (trước khi trang chạy) để mọi nguồn phát đi qua một GainNode thu.
 *  2. Ghi bằng `MediaRecorder` thành WebM/Opus, lấy TỪNG CHUNK một (chunk 0 có thể chỉ 1 byte — header
 *     EBML nằm ở chunk 1) → ghép theo thứ tự ở Node.
 *  3. Đo bằng `ffprobe` + `ffmpeg`: thời lượng, codec, mean/max volume, silencedetect.
 *
 * Chạy: node qc/audio-render.mjs [BASE_URL]  →  qc/out/audio/*.webm + *.wav + report.json
 */
import { launch, sleep } from './cdp-lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:8812/index.html';
const OUT = resolve('qc/out/audio');
mkdirSync(OUT, { recursive: true });

const cdp = await launch();
await cdp.viewport({ width: 390, height: 844 });
await cdp.media([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

await cdp.call('Page.addScriptToEvaluateOnNewDocument', {
  source: `(function () {
    const OrigAC = window.AudioContext || window.webkitAudioContext;
    if (!OrigAC) return;
    // "Master" của bản ghi: SFX/BGM của game đi qua master BUS riêng → để đo đúng, thêm gain 1.0
    // (không đổi âm ra loa), tức là ta đo ĐÚNG đầu ra của game.
    window.__rec = { ready: false, chunks: [], errors: [] };
    const Rec = class extends OrigAC {
      constructor(...args) {
        super(...args);
        try {
          const dest = this.destination;
          const md = this.createMediaStreamDestination();
          this.__md = md;
          const g = this.createGain();
          g.connect(md);
          g.connect(dest);
          this.__bus = g;
          window.__rec.reinit = () => {
            window.__rec.chunks = [];
            const mr = new MediaRecorder(md.stream, { mimeType: 'audio/webm' });
            mr.ondataavailable = (e) => { if (e.data && e.data.size) window.__rec.chunks.push(e.data); };
            mr.start(500);
            window.__rec.ready = true;
            window.__rec.stop = () => new Promise((res) => { mr.onstop = () => res(); mr.stop(); });
          };
          window.__rec.reinit();
        } catch (e) { window.__rec.errors.push(String(e)); }
      }
    };
    window.AudioContext = Rec;
    window.webkitAudioContext = Rec;
    const origConnect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (target, ...rest) {
      const ctx = this.context;
      if (ctx && ctx.__bus && target === ctx.destination) return origConnect.call(this, ctx.__bus, ...rest);
      return origConnect.call(this, target, ...rest);
    };
  })();`,
});

const url = BASE + (BASE.includes('?') ? '&' : '?') + 'theme=light';
await cdp.navigate(url, { settle: 900 });
await cdp.click(195, 320);           // gesture để AudioContext chạy
await sleep(400);

function measure(webm, wav) {
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', webm, wav]);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels,duration', '-of', 'json', wav], { encoding: 'utf8' });
  const vol = spawnSync('ffmpeg', ['-hide_banner', '-i', wav, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const sil = spawnSync('ffmpeg', ['-hide_banner', '-i', wav, '-af', 'silencedetect=n=-60dB:d=0.05', '-f', 'null', '-'], { encoding: 'utf8' });
  const mean = /mean_volume: (-?[\d.]+) dB/.exec(vol.stderr || '');
  const maxv = /max_volume: (-?[\d.]+) dB/.exec(vol.stderr || '');
  const starts = [...(sil.stderr || '').matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...(sil.stderr || '').matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  return {
    info: probe.stdout ? JSON.parse(probe.stdout || '{}').streams || [] : null,
    meanDb: mean ? Number(mean[1]) : null,
    maxDb: maxv ? Number(maxv[1]) : null,
    silenceStarts: starts.slice(0, 6),
    silenceEnds: ends.slice(0, 6),
  };
}

async function grab(name, action) {
  const ok = await cdp.eval(`(() => { try { window.__rec.reinit(); return true; } catch (e) { return false; } })()`);
  if (!ok) return { name, ok: false, reason: 'no-recorder' };
  await sleep(200);
  await cdp.eval(action);
  await sleep(900);
  await cdp.eval(`(async () => { await window.__rec.stop(); return true; })()`, { awaitPromise: true });
  await sleep(350);
  const n = await cdp.eval(`window.__rec.chunks.length`);
  const bufs = [];
  for (let i = 0; i < n; i++) {
    const b64 = await cdp.eval(`(async () => { const buf = await window.__rec.chunks[${i}].arrayBuffer();
      const by = new Uint8Array(buf); let s = ''; for (let j = 0; j < by.length; j++) s += String.fromCharCode(by[j]); return btoa(s); })()`, { awaitPromise: true });
    bufs.push(Buffer.from(b64, 'base64'));
  }
  // Chunk 0 là mảnh ĐẦU cụt (1 byte hoặc vài byte ngoài header EBML) — cắt tới header EBML 1A45DFA3
  // rồi mới ghép: đây là lỗi «ghép chunk» chứ không phải lỗi âm thanh (xem 50-QC mục chưa kiểm được).
  let joinedAll = Buffer.concat(bufs);
  const ebml = joinedAll.indexOf(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  const joined = ebml > 0 ? joinedAll.subarray(ebml) : joinedAll;
  const webm = resolve(OUT, name + '.webm');
  writeFileSync(webm, joined);
  const wav = resolve(OUT, name + '.wav');
  // Đo trên WebM GỐC trước (wav chỉ là bản tiện nghe: mux WebM không chắc ffmpeg xuất đúng stream
  // khi chunk cuối thiếu «Duration» — một lần đo ra nhầm codec 'vvc' 0 GIÂY, xem report lịch sử).
  const direct = spawnSync('ffmpeg', ['-hide_banner', '-i', webm, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const dMean = /mean_volume: (-?[\d.]+) dB/.exec(direct.stderr || '');
  const dMax = /max_volume: (-?[\d.]+) dB/.exec(direct.stderr || '');
  const dDur = /Duration: ([\d:.]+)/.exec(direct.stderr || '');
  const m = measure(webm, wav);
  if (dMean) m.webmMeanDb = Number(dMean[1]);
  if (dMax) m.webmMaxDb = Number(dMax[1]);
  if (dDur) m.webmDuration = dDur[1];
  const out = { name, ok: true, chunks: n, bytes: joined.length, ...m };
  console.log(name, JSON.stringify(out));
  return out;
}

const results = [];
// 1) "tick" khi vẽ cạnh + "tock" khi đóng ô (3×3, người 1 đi trước)
results.push(await grab('sfx-edge-and-box', `(async () => {
  const g = window.__game;
  g.startGame({ mode: 'pvp', size: 3, first: 'you', timeLimitOn: false });
  await new Promise((r) => setTimeout(r, 250));
  g.playEdge([1, 0, 'H']);
  await new Promise((r) => setTimeout(r, 320));
  g.playEdge([0, 1, 'V']);
  return true;
})()`));
// 2) Nhạc nền (arpeggio) trong 2 giây
results.push(await grab('bgm-2s', `(async () => {
  const c = document.getElementById('sound-chip');
  if (c && !c.hidden) c.click();     // bật âm thanh (nếu đang tắt) → BGM bắt đầu
  await new Promise((r) => setTimeout(r, 2000));
  return true;
})()`));

writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(results, null, 2));
console.log('\n→', resolve(OUT, 'report.json'));
await cdp.close();
