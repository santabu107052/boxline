/**
 * config.js — hằng số toàn cục + đọc/ghi cài đặt localStorage (bọc try/catch).
 *
 * Không import gì (dùng được cả trong Node lẫn browser).
 * Nguồn: docs/20-DESIGN.md §2 (token), §6.3 (thông số canvas), docs/30-TUTORIAL.md, docs/00-BRIEF.md.
 */

export const APP_NAME = 'Boxline';
export const APP_SUBTITLE = 'Cờ Ô Vuông';
export const APP_BUNDLE_ID = 'com.santabu.boxline';
export const APP_VERSION = '1.0.0';

/** Kích thước bàn cho phép (đơn vị ô vuông). */
/* 3×3 … 12×12. Giới hạn 12 để cạnh vẫn bấm được trên điện thoại hẹp nhất (320px):
   12 ô trong khung ~288px → bước lưới 24px, vùng bắt cạnh tối thiểu 28px phủ trọn một cạnh. */
export const BOARD_SIZES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Độ khó AI. */
export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const DIFFICULTY_LABELS = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' };

/** Các mốc giới hạn thời gian mỗi lượt (giây). */
export const TIME_LIMITS = [10, 15, 20, 30];
export const DEFAULT_TIME_LIMIT = 20;

/** Chế độ chơi. */
export const MODES = ['ai', 'pvp'];

/** Ai đi trước. */
export const FIRST_OPTIONS = ['you', 'com', 'toss'];
export const FIRST_LABELS_AI = { you: 'Bạn', com: 'Máy', toss: 'Oẳn tù tì' };
export const FIRST_LABELS_PVP = { you: 'Người 1', com: 'Người 2', toss: 'Oẳn tù tì' };

/** Theme. */
export const THEMES = ['system', 'light', 'dark'];

/** Sự kiện oẳn tù tì. */
export const RPS_CHOICES = ['rock', 'paper', 'scissors'];
export const RPS_LABELS = { rock: 'Búa', paper: 'Bao', scissors: 'Kéo' };

/** Số lượt gợi ý miễn phí mỗi ván. */
export const HINT_LIMIT = 3;
/** Số ván người mới được xem gợi ý thêm qua quảng cáo thưởng (0 = đúng 3 lượt miễn phí, không ad). */
export const REWARDED_GRACE_GAMES = 0;

/** Khung chừa quảng cáo cố định (chống nhảy layout). */
export const AD_RESERVE_PX = 50;
/** Interstitial: tối đa 1 lần / 2 ván, chỉ sau màn kết quả ≥ 1.2s. */
export const INTERSTITIAL_MIN_RESULT_MS = 1200;
export const INTERSTITIAL_EVERY_N_GAMES = 2;

/** Khóa localStorage. */
export const STORAGE_KEYS = {
  settings: 'db_settings',
  tutorialDone: 'db_tutorial_done',
  tooltipSeen: 'db_tooltip_seen',
  adState: 'db_ad_state',
};

/** Cài đặt mặc định. */
export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'system',          // 'system' | 'light' | 'dark'
  sound: true,              // bật/tắt toàn bộ âm thanh (SFX + nhạc)
  sfx: true,                // bật/tắt riêng hiệu ứng
  bgm: true,                // bật/tắt riêng nhạc nền
  volume: 0.6,
  timeLimitOn: true,
  timeLimitSec: DEFAULT_TIME_LIMIT,
  boardSize: 5,
  difficulty: 'medium',
  first: 'you',
  mode: 'ai',
  haptic: true,
  colorblindSafe: true,
});

/* ---------------------------------------------------------------------------
 * Thông số canvas — docs/20-DESIGN.md §6.1–§6.3
 * ------------------------------------------------------------------------- */
export const CANVAS = Object.freeze({
  DPR_CAP: 2,
  PAD_MOBILE: 16,
  PAD_DESKTOP: 20,
  STEP_MIN: 32,
  HIT_MIN: 28,             // vùng bắt cạnh tối thiểu (mỗi bên)
  HIT_RATIO: 0.6,          // min(28, step * 0.6)
  DOT_R_SMALL: 2.5,        // bàn ≤ 5×5
  DOT_R_BIG: 2,            // bàn ≥ 6×6
  DOT_R_ACTIVE: 4,
  EDGE_W_SMALL: 3,
  EDGE_W_BIG: 2.5,
  BORDER_W: 4,
  BOX_INSET_RATIO: 0.09,
  BOX_BORDER_W: 1.5,
  BOX_RADIUS: 8,
  BOX_RADIUS_NARROW: 6,
  PATTERN_DOT_R: 1.2,
  PATTERN_DOT_GAP: 6,
  PATTERN_LINE_W: 1,
  PATTERN_LINE_GAP: 7,
  BOX_LABEL_FS: 11,
  PREVIEW_W: 3,
  PREVIEW_ALPHA: 0.45,
  PREVIEW_BOX_ALPHA: 0.35,
  HIGHLIGHT_W_EXTRA: 3,
  HIGHLIGHT_MS: 320,
  FOCUS_RING_W: 2,
  FOCUS_RING_OFFSET: 2,
});

/** Thời lượng hiệu ứng (ms) — docs/20-DESIGN.md §7.1. */
export const MOTION = Object.freeze({
  E1_EDGE_MS: 160,
  E2_BOX_MS: 260,
  E3_POP_MS: 180,
  E4_SCORE_MS: 320,
  E5_STAGGER_MS: 90,
  E5_STAGGER_CAP_MS: 480,
  E6_TURN_MS: 240,
  HIGHLIGHT_MS: 320,
  RESIZE_DEBOUNCE_MS: 80,
  AI_MIN_DELAY_MS: 260,
  BADGE_HOLD_MS: 1200,
});

/** Âm lượng — docs/20-DESIGN.md §8.3. */
export const AUDIO = Object.freeze({
  MASTER: 0.25,
  BGM: 0.08,
  TICK: 0.12,
  TOCK: 0.14,
  TURN: 0.06,
  TIMEOUT: 0.1,
  WIN: 0.14,
  DRAW: 0.1,
  BLIP: 0.05,
});

/* ---------------------------------------------------------------------------
 * LocalStorage an toàn
 * ------------------------------------------------------------------------- */

function safeStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__db_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function readJSON(key, fallback) {
  const s = safeStorage();
  if (!s) return fallback;
  try {
    const raw = s.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  const s = safeStorage();
  if (!s) return false;
  try {
    s.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function clampNum(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Chuẩn hoá cài đặt đọc từ nơi khác (không tin dữ liệu bẩn). */
export function sanitizeSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const pick = (key) => (src[key] === undefined ? DEFAULT_SETTINGS[key] : src[key]);
  const bool = (v, f) => (typeof v === 'boolean' ? v : f);
  const size = Number(pick('boardSize'));
  const timeSec = Number(pick('timeLimitSec'));
  return {
    theme: THEMES.includes(pick('theme')) ? pick('theme') : DEFAULT_SETTINGS.theme,
    sound: bool(pick('sound'), DEFAULT_SETTINGS.sound),
    sfx: bool(pick('sfx'), DEFAULT_SETTINGS.sfx),
    bgm: bool(pick('bgm'), DEFAULT_SETTINGS.bgm),
    volume: clampNum(pick('volume'), 0, 1, DEFAULT_SETTINGS.volume),
    timeLimitOn: bool(pick('timeLimitOn'), DEFAULT_SETTINGS.timeLimitOn),
    timeLimitSec: TIME_LIMITS.includes(timeSec) ? timeSec : DEFAULT_SETTINGS.timeLimitSec,
    boardSize: BOARD_SIZES.includes(size) ? size : DEFAULT_SETTINGS.boardSize,
    difficulty: DIFFICULTIES.includes(pick('difficulty')) ? pick('difficulty') : DEFAULT_SETTINGS.difficulty,
    first: FIRST_OPTIONS.includes(pick('first')) ? pick('first') : DEFAULT_SETTINGS.first,
    mode: MODES.includes(pick('mode')) ? pick('mode') : DEFAULT_SETTINGS.mode,
    haptic: bool(pick('haptic'), DEFAULT_SETTINGS.haptic),
    colorblindSafe: bool(pick('colorblindSafe'), DEFAULT_SETTINGS.colorblindSafe),
  };
}

export function loadSettings() {
  return sanitizeSettings(readJSON(STORAGE_KEYS.settings, {}));
}

export function saveSettings(settings) {
  const clean = sanitizeSettings(settings);
  writeJSON(STORAGE_KEYS.settings, clean);
  return clean;
}

/* ---------------------------------------------------------------------------
 * Oẳn tù tì — công bằng, dùng crypto nếu có (không đoán mò: engine nhận nguồn ngẫu nhiên từ ngoài)
 * ------------------------------------------------------------------------- */

/** Số nguyên ngẫu nhiên không thiên lệch trong [0, n) — crypto nếu có, fallback Math.random. */
export function randomInt(n) {
  if (!(n > 0)) return 0;
  try {
    const c = globalThis.crypto;
    if (c && typeof c.getRandomValues === 'function') {
      // Rejection sampling để không lệch modulo.
      const max = Math.floor(0xffffffff / n) * n;
      const buf = new Uint32Array(1);
      for (let i = 0; i < 32; i++) {
        c.getRandomValues(buf);
        if (buf[0] < max) return buf[0] % n;
      }
    }
  } catch {
    /* rơi xuống fallback */
  }
  return Math.floor(Math.random() * n);
}

const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

/**
 * So một cặp kéo–búa–bao.
 * @returns {'a'|'b'|'tie'}
 */
export function rpsCompare(a, b) {
  if (!RPS_CHOICES.includes(a) || !RPS_CHOICES.includes(b)) {
    throw new Error('Lựa chọn oẳn tù tì không hợp lệ');
  }
  if (a === b) return 'tie';
  return BEATS[a] === b ? 'a' : 'b';
}

/**
 * Chơi đủ số ván oẳn tù tì cho tới khi phân thắng bại (hoà thì chơi lại).
 * @param {string} playerPick
 * @param {() => number} rand — trả số nguyên [0,3)
 * @returns {{playerPick:string, comPick:string, winner:'player'|'com', rounds:Array}}
 */
export function playRps(playerPick, rand = () => randomInt(3)) {
  if (!RPS_CHOICES.includes(playerPick)) throw new Error('Lựa chọn oẳn tù tì không hợp lệ');
  const rounds = [];
  for (let i = 0; i < 50; i++) {
    const comPick = RPS_CHOICES[rand() % 3];
    const res = rpsCompare(playerPick, comPick);
    rounds.push({ playerPick, comPick, result: res });
    if (res === 'a') return { playerPick, comPick, winner: 'player', rounds };
    if (res === 'b') return { playerPick, comPick, winner: 'com', rounds };
  }
  // Không thể xảy ra trong thực tế; giữ hàm luôn trả kết quả.
  return { playerPick, comPick: playerPick, winner: 'player', rounds };
}
