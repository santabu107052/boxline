/**
 * audio.js — âm thanh tổng hợp bằng Web Audio API (không file mp3, chạy offline).
 *
 * Nguồn đặc tả: docs/20-DESIGN.md §8.3.
 *  - AudioContext CHỈ tạo ở lần chạm đầu tiên (autoplay policy). Trước đó mọi lời gọi
 *    phát âm là no-op, không lỗi, không log.
 *  - BGM: pad + arpeggio nhẹ, gain ≤ 0.08, loop vô hạn cho tới khi tắt.
 *  - SFX: tick (vẽ cạnh), tock (đóng ô, cao độ ×2^(k/12), cap k=6), đổi lượt, hết giờ,
 *    thắng (arpeggio 523→659→784), hoà, blip (bấm nút), oẳn tù tì.
 *  - Tab ẩn → suspend(); quay lại → resume(). Mọi thứ bọc try/catch: AudioContext bị chặn
 *    thì game vẫn chạy bình thường.
 */
import { AUDIO } from './config.js';

/** Tần số nốt (Hz) dùng cho BGM arpeggio (Am7 → Fmaj7 → C → G, mỗi hợp âm 4 nhịp). */
const BGM_CHORDS = [
  [220.0, 261.63, 329.63, 392.0], // Am7 (A3 C4 E4 G4)
  [174.61, 220.0, 261.63, 329.63], // Fmaj7
  [196.0, 261.63, 329.63, 392.0], // C/G
  [196.0, 246.94, 293.66, 392.0], // G
];
const BGM_BEAT = 0.62; // giây/nốt arpeggio

function safeNow() {
  try {
    return globalThis.performance && typeof globalThis.performance.now === 'function'
      ? globalThis.performance.now()
      : Date.now();
  } catch {
    return Date.now();
  }
}

/**
 * Tạo bộ âm thanh. Không tự phát gì cho tới khi `unlock()` (gọi trong gesture đầu).
 * @returns {object} API âm thanh
 */
export function createAudio(options = {}) {
  const AudioCtor = globalThis.AudioContext || globalThis.webkitAudioContext || null;
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let bgmBus = null;
  let bgmTimer = null;
  let bgmStep = 0;
  let bgmChord = 0;
  let unlocked = false;
  let destroyed = false;
  let suspendedByHide = false;
  let failed = false;

  const state = {
    sound: options.sound !== false,
    sfx: options.sfx !== false,
    bgm: options.bgm !== false,
    volume: typeof options.volume === 'number' ? Math.min(1, Math.max(0, options.volume)) : 0.6,
  };

  function buildGraph() {
    if (ctx || failed) return false;
    if (!AudioCtor) {
      failed = true;
      return false;
    }
    try {
      // Tạo AudioContext trong CHÍNH gesture (buildGraph chỉ được gọi từ unlock()).
      // Trước đây graph được dựng sớm (khi áp cài đặt lúc boot) → Chrome log
      // "The AudioContext was not allowed to start" và ctx khởi đầu ở trạng thái 'suspended'
      // (iOS: mọi SFX im lặng tới lần chạm sau). Giờ context khởi tạo 'running' ngay trong gesture.
      ctx = new AudioCtor();
      if (typeof ctx.resume === 'function' && ctx.state === 'suspended') ctx.resume();
      master = ctx.createGain();
      // Âm lượng tổng = volume người dùng (0..1) × MASTER (hệ số an toàn chống chói).
      master.gain.value = state.sound ? Math.min(1, state.volume) * AUDIO.MASTER : 0;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 1;
      sfxBus.connect(master);
      bgmBus = ctx.createGain();
      bgmBus.gain.value = 0; // fade in khi bật
      bgmBus.connect(master);
      return true;
    } catch {
      failed = true;
      ctx = null;
      return false;
    }
  }

  function applyMasterGain() {
    if (!ctx || !master) return;
    try {
      // BUG ĐÃ SỬA (14/11): trước đây âm lượng tổng bị đặt về ≈0.0001 (gần như im lặng) ngay sau khi
      // mở khoá → nhạc nền và mọi SFX đều KHÔNG nghe thấy. Nay dùng đúng một công thức như buildGraph.
      const target = state.sound ? Math.min(1, state.volume) * AUDIO.MASTER : 0;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(target, ctx.currentTime, 0.03);
    } catch {
      /* bỏ qua */
    }
  }

  function canSfx() {
    return !destroyed && state.sound && state.sfx && ctx && ctx.state !== 'closed';
  }
  function canBgm() {
    return !destroyed && state.sound && state.bgm && ctx && ctx.state !== 'closed';
  }

  /** Một nốt ngắn với hình bao attack/decay. */
  function tone({
    type = 'sine',
    freq = 440,
    at = 0,
    duration = 0.1,
    gain = 0.1,
    attack = 0.002,
    bus = null,
    pitchMul = 1,
  }) {
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime + at;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq * pitchMul, t0);
      const peak = Math.max(0.0001, gain);
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(peak, t0 + Math.max(0.001, attack));
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.02, duration));
      osc.connect(env);
      env.connect(bus || sfxBus);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    } catch {
      /* thiết bị không hỗ trợ → im lặng */
    }
  }

  /** SFX không phụ thuộc AudioContext (cho phép gọi khi khoá âm thanh). */
  const sfx = {
    /** "tick" — vẽ cạnh: sine 660Hz, attack 2ms, decay 80ms, gain 0.12. */
    tick() {
      if (!canSfx()) return;
      tone({ type: 'sine', freq: 660, duration: 0.08, gain: AUDIO.TICK, attack: 0.002 });
    },
    /**
     * "tock" — đóng ô. `k` = ô thứ k trong chuỗi (1..6), cao độ ×2^(k/12) cap k=6.
     */
    tock(k = 1) {
      if (!canSfx()) return;
      const step = Math.min(6, Math.max(1, Math.round(k)));
      const mul = Math.pow(2, step / 12);
      // Triangle 380Hz + sine 760Hz (harmonic nhẹ), decay 140ms.
      tone({ type: 'triangle', freq: 380, duration: 0.14, gain: AUDIO.TOCK, pitchMul: mul });
      tone({ type: 'sine', freq: 760, duration: 0.12, gain: AUDIO.TOCK * 0.45, pitchMul: mul });
    },
    /** Đổi lượt: sine 440Hz, 60ms, gain 0.06. */
    turn() {
      if (!canSfx()) return;
      tone({ type: 'sine', freq: 440, duration: 0.06, gain: AUDIO.TURN, attack: 0.004 });
    },
    /** Hết giờ: square 220Hz 100ms + sine 165Hz 140ms, gain 0.10. */
    timeout() {
      if (!canSfx()) return;
      tone({ type: 'square', freq: 220, duration: 0.1, gain: AUDIO.TIMEOUT });
      tone({ type: 'sine', freq: 165, duration: 0.14, gain: AUDIO.TIMEOUT, at: 0.02 });
    },
    /** Thắng: arpeggio sine 523→659→784, mỗi nốt 110ms, gain 0.14. */
    win() {
      if (!canSfx()) return;
      [523.25, 659.25, 783.99].forEach((f, i) => {
        tone({ type: 'sine', freq: f, duration: 0.11, gain: AUDIO.WIN, at: i * 0.11 });
      });
    },
    /** Hoà: 2 nốt sine 440→440, gain 0.10. */
    draw() {
      if (!canSfx()) return;
      tone({ type: 'sine', freq: 440, duration: 0.11, gain: AUDIO.DRAW });
      tone({ type: 'sine', freq: 440, duration: 0.11, gain: AUDIO.DRAW, at: 0.13 });
    },
    /** Bấm nút: sine 520Hz, 40ms, gain 0.05. */
    blip() {
      if (!canSfx()) return;
      tone({ type: 'sine', freq: 520, duration: 0.04, gain: AUDIO.BLIP });
    },
    /** Oẳn tù tì: 3 pha lắc (kéo → búa → bao), mỗi pha một nốt ngắn tăng dần. */
    rps() {
      if (!canSfx()) return;
      [392, 494, 587].forEach((f, i) => {
        tone({ type: 'triangle', freq: f, duration: 0.07, gain: 0.08, at: i * 0.16 });
      });
    },
  };

  /* ---------------------------------------------------------------- BGM */

  function scheduleBgmStep() {
    if (!canBgm()) return;
    try {
      const chord = BGM_CHORDS[bgmChord % BGM_CHORDS.length];
      const note = chord[bgmStep % chord.length];
      // Pad nền rất nhẹ (gốc hợp âm, quãng 8 dưới).
      if (bgmStep % 4 === 0) {
        tone({
          type: 'sine',
          freq: chord[0] / 2,
          duration: BGM_BEAT * 3.6,
          gain: AUDIO.BGM * 0.55,
          attack: 0.25,
          bus: bgmBus,
        });
      }
      // Arpeggio chính.
      tone({
        type: 'triangle',
        freq: note,
        duration: BGM_BEAT * 0.9,
        gain: AUDIO.BGM * 0.42,
        attack: 0.01,
        bus: bgmBus,
      });
      bgmStep++;
      if (bgmStep % 8 === 0) bgmChord++;
    } catch {
      /* bỏ qua */
    }
  }

  function startBgmLoop() {
    if (bgmTimer || !canBgm()) return;
    try {
      bgmBus.gain.cancelScheduledValues(ctx.currentTime);
      bgmBus.gain.setTargetAtTime(1, ctx.currentTime, 0.6);
    } catch {
      /* bỏ qua */
    }
    scheduleBgmStep();
    bgmTimer = globalThis.setInterval(scheduleBgmStep, BGM_BEAT * 1000);
  }

  function stopBgmLoop() {
    if (bgmTimer) {
      globalThis.clearInterval(bgmTimer);
      bgmTimer = null;
    }
    if (ctx && bgmBus) {
      try {
        bgmBus.gain.cancelScheduledValues(ctx.currentTime);
        bgmBus.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      } catch {
        /* bỏ qua */
      }
    }
  }

  /* ------------------------------------------------------------- Public */

  /** Gọi trong gesture đầu tiên của người dùng. Idempotent. */
  function unlock() {
    if (destroyed) return false;
    if (!buildGraph()) return false;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      // iOS: cần phát im lặng trong gesture để mở khoá (oscillator gain 0.0001 nối thẳng destination).
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
    } catch {
      /* bỏ qua */
    }
    unlocked = true;
    applyMasterGain();
    if (canBgm()) startBgmLoop();
    return true;
  }

  function applySettings(next = {}) {
    if (typeof next.sound === 'boolean') state.sound = next.sound;
    if (typeof next.sfx === 'boolean') state.sfx = next.sfx;
    if (typeof next.bgm === 'boolean') state.bgm = next.bgm;
    if (typeof next.volume === 'number') state.volume = Math.min(1, Math.max(0, next.volume));
    applyMasterGain();
    if (!unlocked) return; // chưa có gesture → không có context, không chạy BGM
    if (canBgm()) startBgmLoop();
    else stopBgmLoop();
  }

  function suspend() {
    if (!ctx || ctx.state === 'closed') return;
    try {
      if (ctx.state === 'running') {
        ctx.suspend();
        suspendedByHide = true;
      }
    } catch {
      /* bỏ qua */
    }
    stopBgmLoop();
  }

  function resume() {
    if (!ctx || ctx.state === 'closed' || destroyed) return;
    try {
      if (suspendedByHide || ctx.state === 'suspended') ctx.resume();
    } catch {
      /* bỏ qua */
    }
    suspendedByHide = false;
    if (canBgm()) startBgmLoop();
  }

  function destroy() {
    destroyed = true;
    stopBgmLoop();
    try {
      if (ctx && ctx.state !== 'closed') ctx.close();
    } catch {
      /* bỏ qua */
    }
    ctx = null;
  }

  return {
    /** Tạo/giữ AudioContext — phải gọi trong gesture đầu. */
    unlock,
    /** Đồng bộ cài đặt (sound/sfx/bgm/volume). */
    applySettings,
    setSoundEnabled(v) { applySettings({ sound: !!v }); },
    setSfxEnabled(v) { applySettings({ sfx: !!v }); },
    setBgmEnabled(v) { applySettings({ bgm: !!v }); },
    setVolume(v) { applySettings({ volume: Number(v) }); },
    /** SFX theo tên sự kiện. */
    play(name, arg) {
      const fn = sfx[name];
      if (typeof fn !== 'function') return;
      try {
        fn(arg);
      } catch {
        /* không bao giờ ném ra ngoài */
      }
    },
    suspend,
    resume,
    destroy,
    get unlocked() { return unlocked; },
    get state() { return { ...state }; },
    get contextState() { return ctx ? ctx.state : 'none'; },
  };
}

/**
 * Gắn tự động suspend/resume theo tab ẩn hiện + cài đặt âm thanh ban đầu.
 * @param {object} audio instance từ createAudio()
 * @returns {() => void} hàm gỡ listener
 */
export function bindVisibility(audio) {
  if (!audio || typeof document === 'undefined') return () => {};
  const onHide = () => {
    try {
      if (document.hidden) audio.suspend();
      else audio.resume();
    } catch {
      /* bỏ qua */
    }
  };
  try {
    document.addEventListener('visibilitychange', onHide);
  } catch {
    return () => {};
  }
  return () => {
    try {
      document.removeEventListener('visibilitychange', onHide);
    } catch {
      /* bỏ qua */
    }
  };
}

export { safeNow as audioNow };
