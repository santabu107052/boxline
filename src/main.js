/**
 * main.js — nối tất cả: state machine màn hình, timer lượt, máy đi, tutorial, AdBridge,
 * debug hook cho test tự động.
 *
 * Chống race (quan trọng): mỗi lượt có `turnSeq`. Mọi timer (AI, hết giờ, tutorial) đều
 * chụp lại `turnSeq` lúc đặt timer và chỉ hành động khi `state.turnSeq` còn khớp — timer
 * hết giờ và nước đi của máy không bao giờ cùng "thắng". Ngoài ra mỗi callback còn so
 * `gameId` (đổi mỗi ván) để timer của ván cũ không chạm ván mới.
 */
import {
  APP_NAME,
  APP_SUBTITLE,
  INTERSTITIAL_EVERY_N_GAMES,
  INTERSTITIAL_MIN_RESULT_MS,
  HINT_LIMIT,
  RPS_CHOICES,
  STORAGE_KEYS,
  loadSettings,
  saveSettings,
  playRps,
  readJSON,
  sanitizeSettings,
  writeJSON,
} from './config.js';
import {
  applyMove,
  boxMissing,
  boxState,
  boxesClosedBy,
  createGame,
  edgeKey,
  isLegal,
  isOver,
  legalEdges,
  passTurn,
  score,
  thirdEdgeBoxes,
} from './engine.js';
import { chooseMove } from './ai.js';
import { createAudio, bindVisibility } from './audio.js';
import { createRenderer } from './render.js';
import { createUI } from './ui.js';
import { installZoomGuard } from './zoom-guard.js';
import {
  FIRST_TOOLTIP,
  QUICK_GUIDE,
  TUTORIAL_LABELS,
  TUTORIAL_STEP3_AI_MAX_WAIT_MS,
  TUTORIAL_STEP5_DONE_HINT,
  TUTORIAL_STEP5_IDLE_HINT,
  TUTORIAL_STEPS,
  getStep,
  hintOf,
  instructionOf,
  listHasEdge,
  pickHintLine,
} from './tutorial.js';

/* ---------------------------------------------------------------------------
 * Thu thập lỗi runtime (render vào #selftest + window.__errors cho test tự động)
 * ------------------------------------------------------------------------- */
const errors = [];
function recordError(where, err) {
  const msg = err && err.stack ? err.stack : String(err);
  errors.push(`[${where}] ${msg}`);
  if (Array.isArray(globalThis.__errors)) globalThis.__errors.push(`[${where}] ${msg}`);
  renderSelftest();
}
globalThis.__errors = globalThis.__errors || [];

function renderSelftest() {
  const pre = document.getElementById('selftest');
  if (!pre) return;
  if (!errors.length) {
    pre.hidden = true;
    pre.textContent = '';
  } else {
    pre.hidden = false;
    pre.textContent = errors.join('\n');
  }
}

globalThis.addEventListener('error', (e) => recordError('window.error', e.error || e.message));
globalThis.addEventListener('unhandledrejection', (e) => recordError('promise', e.reason));

/* ---------------------------------------------------------------------------
 * Query param (?theme=&mode=&size=&debug=1)
 * ------------------------------------------------------------------------- */
function parseParams() {
  try {
    return new URLSearchParams(globalThis.location && globalThis.location.search ? globalThis.location.search : '');
  } catch {
    return new URLSearchParams('');
  }
}

/* ---------------------------------------------------------------------------
 * AdBridge — MOCK. Không có quảng cáo thật trên web demo.
 * Hợp đồng giữ nguyên cho mobile (Capacitor + AdMob thay phần thân, không đổi chỗ gọi).
 * ------------------------------------------------------------------------- */
function createAdBridge() {
  const state = {
    bannerVisible: false,
    interstitialShown: 0,
    gamesCompleted: 0,
    lastInterstitialAt: 0,
    rewardedShown: 0,
  };
  const slot = () => document.getElementById('ad-slot');
  function markBanner(visible) {
    const el = slot();
    if (!el) return;
    el.classList.toggle('has-banner', !!visible);
    if (visible) {
      if (!el.firstElementChild) {
        const box = document.createElement('div');
        box.className = 'ad-mock';
        box.setAttribute('aria-hidden', 'true');
        box.textContent = 'Khu vực quảng cáo (bản demo)';
        el.appendChild(box);
      }
    }
  }
  const bridge = {
    /** Banner ở menu + màn kết quả (mock: chỉ đánh dấu khung, không tải gì). */
    showBanner(_opts = {}) {
      state.bannerVisible = true;
      markBanner(true);
      return Promise.resolve({ shown: true, mock: true });
    },
    hideBanner() {
      state.bannerVisible = false;
      markBanner(false);
      return Promise.resolve({ hidden: true, mock: true });
    },
    /**
     * Interstitial chỉ sau màn kết quả ≥ INTERSTITIAL_MIN_RESULT_MS và tối đa 1 lần /
     * INTERSTITIAL_EVERY_N_GAMES ván. Mock: hiện toast "Đang mô phỏng quảng cáo…" 1.2s.
     */
    showInterstitial(opts = {}) {
      const sinceResult = typeof opts.sinceResultMs === 'number' ? opts.sinceResultMs : Infinity;
      if (sinceResult < INTERSTITIAL_MIN_RESULT_MS) return Promise.resolve({ shown: false, reason: 'too-early' });
      if (opts.inGame) return Promise.resolve({ shown: false, reason: 'in-game' });
      const games = state.gamesCompleted;
      if (games > 0 && games % INTERSTITIAL_EVERY_N_GAMES !== 0) {
        return Promise.resolve({ shown: false, reason: 'frequency-cap' });
      }
      state.interstitialShown++;
      state.lastInterstitialAt = Date.now();
      return new Promise((resolve) => {
        globalThis.setTimeout(() => resolve({ shown: true, mock: true }), 900);
      });
    },
    /** Rewarded cho "Gợi ý nước đi" khi đấu với máy. Mock: luôn thưởng. */
    showRewarded() {
      state.rewardedShown++;
      return Promise.resolve({ rewarded: true, mock: true });
    },
    /** Sổ sách để test kiểm tần suất. */
    _noteGameCompleted() {
      state.gamesCompleted++;
    },
    _state: state,
  };
  return bridge;
}

/* ---------------------------------------------------------------------------
 * Boot
 * ------------------------------------------------------------------------- */
function boot() {
  // Bố cục hẹp khi người dùng PHÓNG to trang (xem src/zoom-guard.js) — gọi trước khi dựng UI để
  // frame đầu tiên đã đúng bố cục.
  try { installZoomGuard(); } catch (e) { recordError('zoom-guard', e); }
  const params = parseParams();
  const debug = params.get('debug') === '1';
  let settings = loadSettings();

  // Query param ghi đè (dùng cho test/screenshot) — KHÔNG ghi vào localStorage.
  const themeParam = params.get('theme');
  const modeParam = params.get('mode');
  const sizeParam = Number(params.get('size'));
  const firstParam = params.get('first');
  const difficultyParam = params.get('difficulty');
  if (themeParam && ['light', 'dark', 'system'].includes(themeParam)) settings.theme = themeParam;
  if (modeParam && ['ai', 'pvp'].includes(modeParam)) settings.mode = modeParam;
  if (Number.isInteger(sizeParam) && sizeParam >= 3 && sizeParam <= 8) settings.boardSize = sizeParam;
  if (firstParam && ['you', 'com', 'toss'].includes(firstParam)) settings.first = firstParam;
  if (difficultyParam && ['easy', 'medium', 'hard'].includes(difficultyParam)) settings.difficulty = difficultyParam;
  settings = sanitizeSettings(settings);

  /* ------------------------------------------------------------- Theme */

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'system' || !theme) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    // meta theme-color 2 giá trị: cập nhật theo theme đang áp dụng thật.
    const isDark = theme === 'dark' || (theme === 'system'
      && typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#0B0E13' : '#F7F8FA');
    try {
      globalThis.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    } catch {
      /* bỏ qua */
    }
  }

  applyTheme(settings.theme);

  /* -------------------------------------------------------------- Audio */

  const audio = createAudio({
    sound: settings.sound,
    sfx: settings.sfx,
    bgm: settings.bgm,
    volume: settings.volume,
  });
  bindVisibility(audio);
  let audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = audio.unlock();
    ui.showSoundChip(!audioUnlocked && settings.sound);
  }
  // Nhãn trợ năng cho chip "Chạm để bật âm thanh" (ở khung hẹp chỉ còn icon → phải có aria-label).
  function syncSoundChipLabel() {
    const chip = document.getElementById('sound-chip');
    if (chip) chip.setAttribute('aria-label', audioUnlocked ? 'Âm thanh đã bật' : 'Bật âm thanh');
  }
  // Gesture THẬT (isTrusted) đẦU tiÊN Ở bẤt kỲ đÂU → mỞ khoÁ ÂM THANH:
  // Chrome coi AudioContext tẠO trong sỰ kiỆN giẢ LẬP (isTrusted = false) là "không có gesture"
  // → log "The AudioContext was not allowed to start". KiỂM isTrusted để app im lẶNG tuyệt đối.
  const firstGesture = (e) => {
    if (e && e.isTrusted === false) return;
    unlockAudio();
    globalThis.removeEventListener('pointerdown', firstGesture, true);
    globalThis.removeEventListener('keydown', firstGesture, true);
  };
  globalThis.addEventListener('pointerdown', firstGesture, true);
  globalThis.addEventListener('keydown', firstGesture, true);

  /* ---------------------------------------------------------------- Ads */

  const adsMeta = createAdBridge();
  // Ba hàm quảng cáo đi qua BẢNG TRA CỨU mutable: nhờ đó (a) thay adapter AdMob thật ở giai đoạn 2
  // chỉ cần gán lại 3 entry, (b) QC đếm được số lời gọi thật từ bên ngoài (`window.AdBridge.showInterstitial`
  // bọc lại) vì mọi chỗ gọi trong app đều đọc qua bảng này thay vì đóng cứng closure.
  const adApi = {
    showBanner: adsMeta.showBanner,
    hideBanner: adsMeta.hideBanner,
    showInterstitial: adsMeta.showInterstitial,
    showRewarded: adsMeta.showRewarded,
  };
  globalThis.AdBridge = {
    showBanner: (...a) => adApi.showBanner(...a),
    hideBanner: (...a) => adApi.hideBanner(...a),
    showInterstitial: (...a) => adApi.showInterstitial(...a),
    showRewarded: (...a) => adApi.showRewarded(...a),
    _state: adsMeta._state,
  };
  // `ads` — tên dùng ở MỌI chỗ gọi trong app. Đọc qua `adApi`/`adMeta` tại thời điểm gọi (Proxy)
  // để mã game không bao giờ đóng cứng adapter, và QC đếm được lời gọi thật.
  const ads = new Proxy({}, {
    get(_t, prop) {
      if (prop === '_noteGameCompleted') return () => adsMeta._noteGameCompleted();
      if (prop === '_state') return adsMeta._state;
      return adApi[prop];
    },
  });

  /* ----------------------------------------------------------------- UI */

  const ui = createUI({
    getSettings: () => settings,
    on: {
      startGame: () => startQuick(),
      quickGuide: () => openQuickGuide(),
      change: (patch) => applySettingChange(patch),
      cycleTheme: () => {
        const order = ['system', 'light', 'dark'];
        const next = order[(order.indexOf(settings.theme) + 1) % order.length];
        applySettingChange({ theme: next });
      },
      toggleSound: () => {
        applySettingChange({ sound: !settings.sound });
        if (settings.sound) unlockAudio();
      },
      newGame: () => requestNewGame(),
      hint: () => requestHint(),
      settings: () => {
        pauseClock();
        ui.showSettings();
      },
      rules: () => {
        pauseClock();
        ui.showRules();
      },
      back: () => requestBack(),
      resultNew: () => startMatch(),
      resultMenu: () => goMenu(),
      guideStart: () => startTutorial(),
      guideSkip: () => finishGuide(true),
      guideClose: () => finishGuide(false),
      // Nút "Bỏ qua" của tutorial tương tác phải THOÁT TUTORIAL rồi vào ván thật 3×3 Dễ.
      // (Trước đây trỏ nhầm vào finishGuide → nút chết: tutorial không thoát, không vào ván.)
      // Học xong (Xong) hoặc bỏ ngang (Bỏ qua) đều đưa người chơi về MENU để tự chọn chế độ/độ khó.
      // Người dùng báo 14/11: bấm "thoát" sau tutorial không về được menu.
      tutorialSkip: () => finishTutorial({ goMenu: true }),
      tutorialFinish: () => finishTutorial({ goMenu: true }),
      rpsPick: (choice) => onRpsPick(choice),
      rpsDone: (winner) => onRpsDone(winner),
      optionsTouched: () => onTutorialControlTouched(),
      unlockAudio: () => unlockAudio(),
    },
  });

  const app = document.getElementById('app');
  ui.mount(app);
  // #ad-slot phải nằm TRONG khung ứng dụng (cuối cột) để luôn hiện và không đẩy layout.
  const adSlotEl = document.getElementById('ad-slot');
  // Chip âm thanh + khung quảng cáo nằm ở DÒNG CUỐI của cột ứng dụng: không đè lên màn hình nào.
  if (adSlotEl && adSlotEl.parentElement !== app) app.appendChild(adSlotEl);
  const chipEl = document.getElementById('sound-chip');
  if (chipEl && chipEl.parentElement !== app) app.appendChild(chipEl);
  ui.syncSettings(settings);
  ui.syncThemeButton(settings.theme);
  syncSoundChipLabel();

  /* ------------------------------------------------------------ Renderer */

  // Hàng đợi input khi đang animate (DESIGN §6.6: "input được xếp hàng đợi và xử lý ngay sau
  // animation kết thúc — không khoá người chơi"). Animation dài nhất ≈ 160+260+180ms (combo tới
  const renderer = createRenderer(ui.elements.canvas);

  /* ------------------------------------------------------------- State */

  /** @type {'menu'|'guide'|'tutorial'|'rps'|'play'|'result'} */
  let screen = 'menu';
  let game = null;          // engine state của ván đang chơi
  let gameId = 0;           // đổi mỗi ván; timer của ván cũ tự vô hiệu
  let match = null;         // { mode, difficulty, size, first, timeLimitOn, timeSec, nameA, nameB }
  let tutorial = null;      // trạng thái tutorial
  let hintLeft = HINT_LIMIT;
  let playedGames = 0;
  let resultShownAt = 0;
  let interstitialPending = false;
  let paused = false;
  let clockTimer = 0;
  let aiTimer = 0;
  let turnStartAt = 0;
  let turnBudgetMs = 20000;
  let turnLeftMs = 0;
  let lastMoveInfo = null;
  let highlightAt = 0;
  let keyboardActive = false;
  let focusEdge = null;
  let hoverEdge = null;
  let pointerDownEdge = null;
  let pointerDownPos = null;
  let pointerDownId = null;
  let warnBox = null;
  let warnFlashUntil = 0;
  let tutorialAdvanceTimer = 0;
  let tutorialAiTimer = 0;
  let tooltipShown = false;
  let tooltipTimer = 0;
  /** true khi ván được bắt đầu bằng debug hook (test/screenshot) — không hiện tooltip. */
  let debugDriven = false;

  const now = () => performance.now();
  const reduced = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false);

  function setScreen(next) {
    const prev = screen;
    screen = next;
    if (prev === 'play' && next !== 'play') ui.clearToast();
    // Chip bật âm thanh chỉ nhắc ở màn rảnh (menu/hướng dẫn/kết quả), không che bàn chơi.
    ui.showSoundChip(settings.sound && !audioUnlocked && next !== 'play');
    if (next === 'menu') ui.showScreen('menu');
    else if (next === 'guide') ui.showScreen('guide');
    else if (next === 'result') ui.showScreen('result');
    else ui.showScreen('play');
  }

  /* --------------------------------------------------- Cài đặt & lưu trữ */

  function persist() {
    settings = saveSettings(settings);
    audio.applySettings({
      sound: settings.sound,
      sfx: settings.sfx,
      bgm: settings.bgm,
      volume: settings.volume,
    });
    ui.syncSoundButton(settings.sound);
    ui.showSoundChip(settings.sound && !audioUnlocked);
  }

  function applySettingChange(patch) {
    const before = settings;
    settings = sanitizeSettings({ ...settings, ...patch });
    if (patch.theme !== undefined) {
      applyTheme(settings.theme);
      ui.syncThemeButton(settings.theme);
    }
    if (patch.mode !== undefined) {
      ui.setFirstLabels(settings.mode);
      ui.setModeValue(settings.mode);
    }
    if (patch.first !== undefined) ui.setFirstLabels(settings.mode);
    ui.syncSettings(settings);
    persist();
    if (patch.timeLimitOn !== undefined) {
      ui.showToast(patch.timeLimitOn
        ? `Đã bật giới hạn ${settings.timeLimitSec} giây/lượt`
        : 'Đã tắt giới hạn thời gian');
    }
    if (patch.timeLimitSec !== undefined && settings.timeLimitOn) {
      ui.showToast(`Giới hạn ${settings.timeLimitSec} giây/lượt`);
    }
    if (patch.theme !== undefined && before.theme !== settings.theme) {
      ui.showToast('Đã đổi giao diện');
    }
    if (game && screen === 'play') {
      // Cài đặt thời gian áp dụng ngay cho lượt hiện tại (không phạt người chơi).
      if (patch.timeLimitOn !== undefined || patch.timeLimitSec !== undefined) restartTurnClock();
      if (patch.colorblindSafe !== undefined) render();
    }
  }

  /* ------------------------------------------------------------- Bàn cờ */

  function isTutorialBoard() {
    return !!tutorial && tutorial.active;
  }

  function currentUiState() {
    const s = game ? game : createGame({ n: settings.boardSize });
    const uiState = {
      colorblindSafe: settings.colorblindSafe !== false,
      keyboardActive,
      focusEdge: keyboardActive ? focusEdge : null,
      lastMovePlayer: lastMoveInfo ? lastMoveInfo.player : null,
      highlightAt,
      // VFX "nước vừa đi": giữ nguyên suốt lượt kế tiếp (không tự tắt sau 320ms) để đối thủ luôn
      // thấy nước đi vừa rồi. Chỉ đổi khi có nước mới hoặc chuyển màn (lastMoveInfo = null).
      lastMoveEdge: lastMoveInfo ? lastMoveInfo.edge : null,
      lastMoveEdgePlayer: lastMoveInfo ? lastMoveInfo.player : null,
      // Vòng cảnh báo ô nguy hiểm: hiện suốt bước 4 (nháy đỏ khi bấm cạnh mồi).
      warnBox: warnBox || null,
      warnFlash: !!warnBox && now() < warnFlashUntil,
    };
    if (hoverEdge && !isTutorialBoard()) {
      uiState.previewEdge = hoverEdge;
      uiState.previewPlayer = s.turn;
      uiState.previewBoxes = boxesClosedBy(s, hoverEdge);
    } else if (hoverEdge && isTutorialBoard() && allowedNow(hoverEdge)) {
      uiState.previewEdge = hoverEdge;
      uiState.previewPlayer = s.turn;
      uiState.previewBoxes = boxesClosedBy(s, hoverEdge);
    }
    return uiState;
  }

  /**
   * Một lần vẽ đầy đủ.
   * @param {boolean} structural true = bàn/luật chơi vừa đổi (đi nước, đổi bàn) → dựng lại lưới ẩn
   *        cho trình đọc màn hình. Hover/preview/resize/theme chỉ đổi pixel → KHÔNG dựng lại
   *        (trước đây mỗi lần hover đều ném đi và tạo lại ~160 nút DOM).
   */
  function render(structural = true) {
    if (!game) return;
    renderer.draw(game, currentUiState());
    syncHud();
    if (structural) scheduleSrRefresh();
  }

  /** Lưới ẩn được làm mới theo nhịp (không rebuild mỗi frame để khỏi phí). */
  let srTimer = 0;
  function scheduleSrRefresh() {
    globalThis.clearTimeout(srTimer);
    srTimer = globalThis.setTimeout(() => rebuildSrGrid(), 0);
  }

  function syncHud(bump) {
    if (!game || !match) return;
    // Tutorial KHÔNG tính điểm (tài liệu: "Tutorial không tính thắng thua") → HUD luôn 0–0.
    const s = isTutorialBoard() ? { A: 0, B: 0 } : score(game);
    ui.updateHud({
      scoreA: s.A,
      scoreB: s.B,
      nameA: match.nameA,
      nameB: match.nameB,
      turn: game.turn,
      timeLeft: turnLeftMs / 1000,
      timeTotal: turnBudgetMs / 1000,
      timeLimitOn: !!match.timeLimitOn && !isTutorialBoard(),
      bump: bump || (lastMoveInfo ? lastMoveInfo.player : null),
    });
  }

  /* ----------------------------------------------------- Lượt & đồng hồ */

  function currentIsHuman() {
    if (!match) return false;
    if (isTutorialBoard()) return true;
    return !(match.mode === 'ai' && game.turn === 'B');
  }

  /**
   * Bàn có bị KHOÁ không (docs/30-TUTORIAL.md §2 bước 5: "lớp phủ mờ để người chơi không bấm
   * vào cạnh trong khi đang xem chú thích"). Khoá pointerdown/keydown/lưới ẩn; API `__game`
   * vẫn đi qua `commitMove` (được xả rồi bị chặn đúng ở đó).
   */
  function boardLocked() {
    if (!isTutorialBoard()) return false;
    const step = getStep(tutorial.index + 1);
    return !!(step && step.id === 5);
  }

  function restartTurnClock() {
    globalThis.clearInterval(clockTimer);
    if (!game || !match) return;
    turnBudgetMs = (match.timeLimitOn && !isTutorialBoard()) ? match.timeSec * 1000 : 0;
    turnLeftMs = turnBudgetMs;
    turnStartAt = now();
    syncHud();
    if (!turnBudgetMs) return;
    const seq = game.turnSeq;
    const gid = gameId;
    clockTimer = globalThis.setInterval(() => {
      if (gid !== gameId || !game || game.turnSeq !== seq) {
        globalThis.clearInterval(clockTimer);
        return;
      }
      if (paused) {
        // Tạm dừng: dời mốc bắt đầu theo thời gian đã dừng.
        turnStartAt += 250;
        return;
      }
      turnLeftMs = Math.max(0, turnBudgetMs - (now() - turnStartAt));
      syncHud();
      if (turnLeftMs <= 0) {
        globalThis.clearInterval(clockTimer);
        onTurnTimeout(seq, gid);
      }
    }, 250);
  }

  function pauseClock() {
    if (!paused) {
      paused = true;
      pausedAt = now();
    }
  }
  let pausedAt = 0;
  function resumeClock() {
    if (paused) {
      paused = false;
      turnStartAt += now() - pausedAt;
    }
  }

  /** Hết giờ: chỉ hành động khi vẫn đúng lượt đã đặt hẹn (chống race với máy). */
  function onTurnTimeout(seq, gid) {
    if (gid !== gameId || !game || game.turnSeq !== seq || paused) return;
    if (isTutorialBoard()) return; // tutorial không có đồng hồ
    if (isOver(game)) return;
    const who = game.turn;
    const res = passTurn(game);
    if (!res.ok) return;
    audio.play('timeout');
    ui.showToast('Hết giờ — mất lượt', { alert: true });
    ui.announce(`${who === 'A' ? match.nameA : match.nameB} hết giờ, mất lượt`);
    lastMoveInfo = null;
    afterTurnChange();
  }

  /** Được gọi sau MỌI thay đổi lượt hoặc nước đi. */
  function afterTurnChange() {
    render();
    restartTurnClock();
    scheduleAiIfNeeded();
    checkGameOver();
  }

  function scheduleAiIfNeeded() {
    globalThis.clearTimeout(aiTimer);
    if (!game || !match) return;
    if (isTutorialBoard()) return;
    if (isOver(game)) return;
    if (match.mode !== 'ai' || game.turn !== 'B') return;
    if (ui.isModalOpen() || paused) return;
    const seq = game.turnSeq;
    const gid = gameId;
    const delay = 700 + Math.floor(Math.random() * 200); // 700–900ms
    globalThis.clearTimeout(aiTimer);
    aiTimer = globalThis.setTimeout(() => {
      aiTimer = 0;
      // Chống double-move: chỉ chạy nếu vẫn đúng lượt của ĐÚNG ván này (gameId + turnSeq).
      if (gid !== gameId || !game || game.turnSeq !== seq || game.turn !== 'B' || paused) return;
      let edge = null;
      try {
        edge = chooseMove(game, { level: match.difficulty, seed: (Date.now() & 0x7fffffff) });
      } catch (e) {
        recordError('ai', e);
      }
      if (!edge) edge = legalEdges(game)[0];
      if (!edge) return;
      commitMove(edge, { byAi: true });
    }, delay);
  }

  /* -------------------------------------------------------------- Nước đi */

  function commitMove(edge, opts = {}) {
    if (!game || isOver(game)) return false;
    if (isTutorialBoard()) {
      // Bước 5 là bước "chỉ xem": bàn bị khoá, mọi cạnh đều không phản hồi
      // (docs/30-TUTORIAL.md §2 bước 5: "lớp phủ mờ để người chơi không bấm vào cạnh").
      const st5 = getStep(tutorial.index + 1);
      if (st5 && st5.id === 5 && !opts.forceBoard) return false;
      return commitTutorialMove(edge);
    }
    if (!isLegal(game, edge)) return false;
    if (!currentIsHuman() && !opts.byAi) return false;
    const res = applyMove(game, edge);
    if (!res.ok) return false;
    interact(res);
    return true;
  }

  /** Phản hồi chung sau một nước: âm, hiệu ứng, combo, highlight, tooltip. */
  function interact(res) {
    lastMoveInfo = { edge: res.edge, player: res.player, closed: res.closed };
    highlightAt = now();
    renderer.animateMove({ edge: res.edge, player: res.player, closed: res.closed });
    audio.play('tick');
    const closedCount = res.closed.length;
    if (closedCount > 0) {
      for (let k = 1; k <= Math.min(closedCount, 6); k++) {
        globalThis.setTimeout(() => audio.play('tock', k), reduced() ? 0 : 60 * (k - 1));
      }
    }
    // Thông báo "giữ lượt" phải nằm NGOÀI bàn cờ: nếu đặt giữa bàn sẽ che ô/cạnh người chơi
    // vừa tô đúng lúc cần nhìn nhất. Vì vậy dùng toast nổi ở đáy màn hình (trên thanh hành động);
    // từ chuỗi 2 ô trở lên mới hiện badge ngắn gọn "×N" trong bàn.
    if (closedCount >= 2) ui.showComboBadge(`×${closedCount}`);
    else if (res.keepsTurn) ui.showToast('Kín ô — bạn được đi tiếp', { ms: 1500 });
    haptic(res);
    hoverEdge = null;
    const sc = score(game);
    ui.announce(`${res.player === 'A' ? match.nameA : match.nameB} vừa đi. Tỉ số ${sc.A} – ${sc.B}.`);
    maybeShowFirstTooltip();
    afterTurnChange();
  }

  let userInteracted = false;
  // Haptic chỈ khi CHẠM THẬT (isTrusted) — Chromium log "Blocked call to navigator.vibrate" cho
  // sự kiện giả lập. Rung là phụ, không ảnh hưởng luật chơi.
  const markInteracted = (e) => { if (e && e.isTrusted !== false) userInteracted = true; };
  globalThis.addEventListener('pointerdown', markInteracted, { once: true, capture: true });
  globalThis.addEventListener('keydown', markInteracted, { once: true, capture: true });

  /** Gọi navigator.vibrate an toàn: chỉ khi người dùng đã chạm thật (tránh Chromium log lỗi). */
  function vibrate(pattern) {
    if (!settings.haptic || reduced() || document.hidden || !userInteracted) return;
    try {
      const nav = globalThis.navigator;
      if (!nav || typeof nav.vibrate !== 'function') return;
      nav.vibrate(pattern);
    } catch {
      /* iOS Safari không hỗ trợ → bỏ qua */
    }
  }

  function haptic(res) {
    if (!settings.haptic || reduced() || document.hidden || !userInteracted) return;
    try {
      const nav = globalThis.navigator;
      if (!nav || typeof nav.vibrate !== 'function') return;
      if (res.closed.length >= 2) nav.vibrate([18, 40, 18, 40, 18]);
      else if (res.closed.length === 1) nav.vibrate(18);
      else nav.vibrate(10);
    } catch {
      /* iOS Safari không hỗ trợ → bỏ qua */
    }
  }

  function checkGameOver() {
    if (!game || !match) return;
    if (!isOver(game)) return;
    globalThis.clearInterval(clockTimer);
    globalThis.clearTimeout(aiTimer);
    const s = score(game);
    const w = s.A > s.B ? 'A' : s.B > s.A ? 'B' : 'draw';
    playedGames++;
    ads._noteGameCompleted();
    const winnerText = w === 'draw' ? 'Hoà' : w === 'A' ? `${match.nameA} thắng!` : `${match.nameB} thắng!`;
    // Câu tóm tắt đọc tự nhiên, không lặp số (số đã hiện to ở trên).
    const summary = w === 'draw'
      ? `Hoà ${s.A}–${s.B} sau ${game.moveCount} lượt tô cạnh`
      : `${w === 'A' ? match.nameA : match.nameB} thắng ${Math.max(s.A, s.B)}–${Math.min(s.A, s.B)} sau ${game.moveCount} lượt tô cạnh`;
    if (isTutorialBoard()) {
      finishTutorial();
      return;
    }
    if (w === 'draw') audio.play('draw');
    else if ((match.mode === 'ai' && w === 'A') || (match.mode === 'pvp')) audio.play('win');
    else audio.play('draw');
    if (w === 'A') vibrate([12, 30, 12, 30, 60]);
    ui.showResult({
      winnerText,
      scoreA: s.A,
      scoreB: s.B,
      nameA: match.nameA,
      nameB: match.nameB,
      summary,
      reducedMotion: reduced(),
    });
    setScreen('result');
    resultShownAt = now();
    pauseClock();
    ads.showBanner();
    scheduleInterstitial();
    if (settings.tooltipSeen === undefined) {
      writeJSON(STORAGE_KEYS.tooltipSeen, true);
    }
  }

  function scheduleInterstitial() {
    interstitialPending = true;
    globalThis.setTimeout(async () => {
      if (!interstitialPending) return;
      interstitialPending = false;
      try {
        const decision = await ads.showInterstitial({
          sinceResultMs: now() - resultShownAt,
          inGame: screen !== 'result',
        });
        if (decision && decision.shown) {
          ui.showToast('Đang mô phỏng quảng cáo toàn màn hình (bản demo)');
        }
      } catch (e) {
        recordError('interstitial', e);
      }
    }, INTERSTITIAL_MIN_RESULT_MS + 60);
  }

  /* ------------------------------------------------------- Ván / trận */

  function makeMatch(overrides = {}) {
    const mode = overrides.mode || settings.mode;
    const isAi = mode === 'ai';
    return {
      mode,
      difficulty: overrides.difficulty || settings.difficulty,
      size: overrides.size || settings.boardSize,
      first: overrides.first || settings.first,
      timeLimitOn: overrides.timeLimitOn !== undefined ? overrides.timeLimitOn : settings.timeLimitOn,
      timeSec: overrides.timeSec || settings.timeLimitSec,
      tutorial: !!overrides.tutorial,
      nameA: overrides.nameA || (isAi ? 'Bạn' : 'Người 1'),
      nameB: overrides.nameB || (isAi ? 'Máy' : 'Người 2'),
    };
  }

  function startQuick() {
    startMatch();
  }

  /** Bắt đầu trận theo cài đặt hiện tại (có thể qua oẳn tù tì). */
  function startMatch(overrides = {}) {
    const m = makeMatch(overrides);
    if (m.first === 'toss') {
      pendingMatch = m;
      setScreen('play');
      prepareEmptyBoard(m);
      ui.showRps();
      pauseClock();
      audio.play('rps');
      return;
    }
    launchGame(m, m.first === 'com' ? 'B' : 'A');
  }

  let pendingMatch = null;

  function prepareEmptyBoard(m) {
    // Ván "trống" để làm nền cho màn oẳn tù tì (không tính là ván đã chơi).
    gameId++;
    match = m;
    game = createGame({ n: m.size });
    hintLeft = HINT_LIMIT;
    lastMoveInfo = null;
    warnBox = null;
    paused = false;
    ui.setSizeDisabled(false);
    ui.updateTutorialBar({ visible: false });
    ui.updateHintButton(hintLeft, HINT_LIMIT);
    render();
  }

  function launchGame(m, firstPlayer) {
    gameId++;
    pointerDownEdge = null;
    pointerDownPos = null;
    pointerDownId = null;
    match = m;
    game = createGame({ n: m.size, first: firstPlayer });
    hintLeft = HINT_LIMIT;
    lastMoveInfo = null;
    warnBox = null;
    hoverEdge = null;
    focusEdge = null;
    keyboardActive = false;
    paused = false;
    ui.updateTutorialBar({ visible: false });
    ui.updateHintButton(hintLeft, HINT_LIMIT);
    ui.setSizeDisabled(false);
    setScreen('play');
    ads.hideBanner();
    render();
    restartTurnClock();
    scheduleAiIfNeeded();
    try { renderer.resize(); } catch { /* bỏ qua */ }
  }

  /* -------------------------------------------------------- Oẳn tù tì */

  function onRpsPick(choice) {
    const result = playRps(choice);
    audio.play('rps');
    ui.playRpsAnimation(result.playerPick, result.comPick, result.winner, reduced());
  }

  function onRpsDone(winner) {
    const m = pendingMatch || makeMatch();
    pendingMatch = null;
    // BUG (14/11): trước đây không đóng hộp "Oẳn tù tì" → bàn mở phía sau nhưng modal vẫn phủ,
    // người chơi thấy như "không qua được màn chơi". Phải đóng modal trước khi vào bàn.
    try { ui.closeRps(); } catch { /* bỏ qua */ }
    const humanFirst = winner === 'player';
    // Người chơi luôn là A; máy/Người 2 là B.
    launchGame(m, humanFirst ? 'A' : 'B');
    if (m.mode === 'ai') {
      ui.showToast(humanFirst ? 'Bạn thắng oẳn tù tì — đi trước' : 'Máy thắng oẳn tù tì — máy đi trước');
    } else {
      ui.showToast(humanFirst ? 'Người 1 thắng oẳn tù tì — đi trước' : 'Người 2 thắng oẳn tù tì — đi trước');
    }
  }

  /** Bước 5 tutorial: bàn bị khoá nên control tùy chọn được đưa lên vùng nhìn thấy. */
  function revealOptions() {
    try { ui.revealOptions(); } catch { /* bỏ qua */ }
  }

  /* ------------------------------------------------------------ Menu */

  function goMenu() {
    gameId++;
    pointerDownEdge = null;
    pointerDownPos = null;
    pointerDownId = null;
    globalThis.clearInterval(clockTimer);
    globalThis.clearTimeout(aiTimer);
    globalThis.clearTimeout(tutorialAdvanceTimer);
    globalThis.clearTimeout(tutorialAiTimer);
    interstitialPending = false;
    tutorial = null;
    game = null;
    match = null;
    paused = false;
    ui.updateTutorialBar({ visible: false, hint: '', hintState: '' });
    ui.setOptionsExpanded(false);
    setScreen('menu');
    ads.showBanner();
    if (!readJSON(STORAGE_KEYS.tutorialDone, false)) openQuickGuide();
  }

  function requestNewGame() {
    if (!game || screen !== 'play') { startMatch(); return; }
    if (isTutorialBoard()) {
      // LỖI ĐÃ SỬA (14/11): trước đây gọi finishGuide(true) → mở ván thật NHƯNG `tutorial.active`
      // vẫn còn, nên bàn bị khoá theo kịch bản (chỉ 6 cạnh được phép) → "bấm Ván mới không chơi được"
      // và nút quay lại cũng không thoát. Nay thoát tutorial hẳn rồi về menu cho người chơi chọn.
      ui.confirmModal({
        title: 'Bỏ hướng dẫn?',
        message: 'Bạn muốn thoát hướng dẫn và về menu?',
        confirmLabel: 'Thoát hướng dẫn',
        cancelLabel: 'Ở lại',
        danger: true,
        onConfirm: () => finishTutorial({ goMenu: true }),
      });
      return;
    }
    if (isOver(game)) { startMatch(); return; }
    pauseClock();
    ui.confirmModal({
      title: 'Ván mới?',
      message: 'Ván đang chơi sẽ bị huỷ và bắt đầu ván mới.',
      confirmLabel: 'Ván mới',
      cancelLabel: 'Chơi tiếp',
      danger: true,
      onConfirm: () => startMatch(),
      onClose: () => resumeClock(),
    });
  }

  function requestBack() {
    if (!game || screen !== 'play') { goMenu(); return; }
    if (isTutorialBoard()) {
      pauseClock();
      ui.confirmModal({
        title: 'Huỷ hướng dẫn?',
        message: 'Bạn muốn thoát hướng dẫn và về menu?',
        confirmLabel: 'Về menu',
        cancelLabel: 'Ở lại',
        danger: true,
        // Cùng lỗi như trên: finishGuide(true) giữ `tutorial.active` → nút "Về menu" mở ván thật.
        onConfirm: () => finishTutorial({ goMenu: true }),
        onClose: () => resumeClock(),
      });
      return;
    }
    pauseClock();
    ui.confirmModal({
      title: 'Về menu?',
      message: 'Ván đang chơi sẽ bị huỷ.',
      confirmLabel: 'Về menu',
      cancelLabel: 'Chơi tiếp',
      danger: true,
      onConfirm: () => goMenu(),
      onClose: () => resumeClock(),
    });
  }

  /* ---------------------------------------------------------- Gợi ý */

  async function requestHint() {
    if (!game || screen !== 'play' || isOver(game)) return;
    if (hintLeft <= 0) {
      ui.showToast('Hết gợi ý');
      return;
    }
    if (!isTutorialBoard() && match.mode === 'ai' && hintLeft === 0) return;
    pauseClock();
    hintLeft--;
    ui.updateHintButton(hintLeft, HINT_LIMIT);
    const info = hintInfo();
    const line = pickHintLine(info);
    ui.showToast(line.text, { ms: 3200 });
    ui.announce(line.text);
    resumeClock();
  }

  function hintInfo() {
    const thirds = thirdEdgeBoxes(game);
    const caps = legalEdges(game).filter((e) => boxesClosedBy(game, e).length > 0);
    const opponentThird = thirds.filter((b) => boxState(game, b.br, b.bc).vs === 0 || true).length;
    const total = 2 * game.n * (game.n + 1);
    return {
      myCapturable: currentIsHuman() === (game.turn === 'A') ? caps.length : 0,
      opponentThird,
      anyThird: thirds.length,
      remaining: legalEdges(game).length,
      total,
    };
  }

  /* --------------------------------------------------- Tooltip lần đầu */

  function maybeShowFirstTooltip() {
    // Chỉ nhắc MỘT lần duy nhất, ở ván đầu tiên sau khi đã có người chơi thật (không phải
    // ván dựng tự động bằng debug hook, không phải tutorial) và chưa từng thấy.
    if (tooltipShown || isTutorialBoard() || !game || debugDriven) return;
    if (playedGames > 0) return;
    if (readJSON(STORAGE_KEYS.tooltipSeen, false)) return;
    if (!readJSON(STORAGE_KEYS.tutorialDone, false)) return;
    const s = score(game);
    const total = 2 * game.n * (game.n + 1);
    const empty = legalEdges(game).length;
    if (s.total > 0 || empty < total * 0.6) return;
    tooltipShown = true;
    ui.showToast(FIRST_TOOLTIP.text, { ms: 8000 });
    globalThis.clearTimeout(tooltipTimer);
    tooltipTimer = globalThis.setTimeout(() => {
      writeJSON(STORAGE_KEYS.tooltipSeen, true);
    }, 8000);
  }

  /* ======================================================== TUTORIAL ==== */

  function openQuickGuide() {
    ui.renderGuideCards(drawGuideCard);
    setScreen('guide');
    ads.showBanner();
  }

  /** Vẽ minh hoạ canvas tĩnh 176×176 cho 3 thẻ Hướng dẫn nhanh (§4). */
  function drawGuideCard(canvas, card) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const size = 176;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => (cs.getPropertyValue(n) || '').trim();
    const step = 48; // §4: lưới cách đều 48px
    const n = 3;
    const origin = (size - step * n) / 2;
    const P = (i, j) => ({ x: origin + i * step, y: origin + j * step });
    // Các chấm tròn của lưới (không vẽ sẵn viền ngoài)
    ctx.fillStyle = v('--grid-dot') || v('--border-strong');
    for (let r = 0; r <= n; r++) {
      for (let c = 0; c <= n; c++) {
        const p = P(c, r);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Cạnh trong 2px, cap tròn 1px
    ctx.lineCap = 'round';
    const playerA = v('--player-a');
    ctx.strokeStyle = card.seedOwner === 'B' ? v('--player-b') : playerA;
    ctx.lineWidth = 2;
    for (const [r, c, o] of card.seedEdges) {
      ctx.beginPath();
      if (o === 'H') {
        const a = P(c, r);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + step, a.y);
      } else {
        const a = P(c, r);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x, a.y + step);
      }
      ctx.stroke();
    }
    // Ô được làm nổi
    if (card.highlightBox) {
      const [br, bc] = card.highlightBox;
      const a = P(bc, br);
      const inset = step * 0.09;
      ctx.fillStyle = card.seedOwner === 'B' ? v('--box-b-bg') : v('--box-a-bg');
      ctx.fillRect(a.x + inset, a.y + inset, step - 2 * inset, step - 2 * inset);
      ctx.strokeStyle = card.seedOwner === 'B' ? v('--box-b-border') : v('--box-a-border');
      ctx.lineWidth = 1.5;
      ctx.strokeRect(a.x + inset, a.y + inset, step - 2 * inset, step - 2 * inset);
    }
    if (card.showTick) {
      const [br, bc] = card.highlightBox;
      const a = P(bc, br);
      ctx.strokeStyle = playerA;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x + step * 0.3, a.y + step * 0.52);
      ctx.lineTo(a.x + step * 0.45, a.y + step * 0.66);
      ctx.lineTo(a.x + step * 0.72, a.y + step * 0.36);
      ctx.stroke();
    }
    if (card.showAvoidArrow) {
      // Ô nguy hiểm được đóng khung cam mảnh + mũi tên cong chỉ RA XA (đừng vào).
      const [br, bc] = card.highlightBox;
      const a = P(bc, br);
      const warn = v('--player-b');
      ctx.save();
      ctx.strokeStyle = warn;
      ctx.lineWidth = 2;
      ctx.setLineDash && ctx.setLineDash([5, 4]);
      ctx.strokeRect(a.x + 3, a.y + 3, step - 6, step - 6);
      ctx.setLineDash && ctx.setLineDash([]);
      // Mũi tên cong: từ phía ô nguy hiểm vòng ra ngoài trái-trên, đầu mũi tên hướng ra xa.
      const cx = a.x + step * 0.5;
      const cy = a.y + step * 0.5;
      const r = step * 0.95;
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI * 0.95, Math.PI * 1.55, false);
      ctx.stroke();
      // Đầu mũi tên tại góc cuối cung (hướng tiếp tuyến, chỉ ra xa).
      const endA = Math.PI * 1.55;
      const ex = cx + Math.cos(endA) * r;
      const ey = cy + Math.sin(endA) * r;
      const tx = -Math.sin(endA);
      const ty = Math.cos(endA);
      ctx.beginPath();
      ctx.moveTo(ex - tx * 7 + ty * 4, ey - ty * 7 - tx * 4);
      ctx.lineTo(ex, ey);
      ctx.lineTo(ex - tx * 7 - ty * 4, ey - ty * 7 + tx * 4);
      ctx.stroke();
      ctx.restore();
      // Cạnh "thứ 3" đang bỏ ngỏ: vẽ nét đứt cam nhạt để thấy chỗ nguy hiểm.
      for (const [r2, c2, o] of card.warnEdges || []) {
        ctx.save();
        ctx.strokeStyle = warn;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 2;
        ctx.setLineDash && ctx.setLineDash([3, 3]);
        ctx.beginPath();
        if (o === 'H') {
          const p = P(c2, r2);
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + step, p.y);
        } else {
          const p = P(c2, r2);
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x, p.y + step);
        }
        ctx.stroke();
        ctx.setLineDash && ctx.setLineDash([]);
        ctx.restore();
      }

    }
  }

  /**
   * Rời màn "Hướng dẫn nhanh".
   *  - `goStraightToPlay = true` (nút "Bỏ qua") → vào thẳng ván thật 3×3 độ khó Dễ,
   *    vẫn ghi db_tutorial_done để không tự hiện lại (vẫn mở lại được từ menu).
   *  - `false` (nút đóng ×) → chỉ quay về menu, KHÔNG ép chơi.
   */
  function finishGuide(goStraightToPlay) {
    writeJSON(STORAGE_KEYS.tutorialDone, true);
    // An toàn: nếu đang ở màn hướng dẫn mà trạng thái tutorial còn sót thì dọn luôn, tránh bàn
    // mở ra trong trạng thái "bàn khoá theo kịch bản".
    if (isTutorialBoard()) {
      globalThis.clearTimeout(tutorialAdvanceTimer);
      globalThis.clearTimeout(tutorialAiTimer);
      tutorial = null;
      ui.updateTutorialBar({ visible: false, hint: '', hintState: '' });
      ui.setOptionsExpanded(false);
    }
    if (goStraightToPlay) {
      startMatch({ size: 3, difficulty: 'easy', first: 'you', mode: 'ai' });
    } else {
      setScreen('menu');
      ads.showBanner();
    }
  }

  function startTutorial() {
    pointerDownEdge = null;
    pointerDownPos = null;
    pointerDownId = null;
    globalThis.clearTimeout(tutorialAdvanceTimer);
    globalThis.clearTimeout(tutorialAiTimer);
    tutorial = { active: true, index: 0, board4: null, touchedControl: false, aiMoved: false };
    match = makeMatch({
      mode: 'ai',
      size: TUTORIAL_STEPS.boardSize,
      difficulty: 'easy',
      first: 'you',
      timeLimitOn: false,
      tutorial: true,
      nameA: 'Bạn',
      nameB: 'Máy',
    });
    gameId++;
    paused = false;
    hintLeft = HINT_LIMIT;
    setScreen('play');
    ads.hideBanner();
    beginStep(1);
    try { renderer.resize(); } catch { /* bỏ qua */ }
  }

  /** Dựng bàn theo seedEdges của bước (`nk` = nước cuối thuộc ai). */
  function buildBoard(seedEdges, seedOwner = 'A') {
    const g = createGame({ n: TUTORIAL_STEPS.boardSize });
    const rand = seedEdges.slice();
    let i = 0;
    while (rand.length) {
      // Xen kẽ để bàn trông tự nhiên như đã chơi dở; cạnh cuối cùng thuộc seedOwner.
      const e = i === 0 ? rand.pop() : rand.shift();
      applyMove(g, e);
      i++;
      if (i % 2 === 0 && rand.length > 1) {
        // giữ nhịp nhưng không quan trọng: lượt sẽ đặt lại theo kịch bản
        continue;
      }
    }
    // Đặt lại chủ ô để đúng kịch bản (người chơi = A).
    for (let k = 0; k < g.boxes.length; k++) g.boxes[k] = g.boxes[k] ? seedOwner : null;
    g.turn = 'A';
    return g;
  }

  function beginStep(id) {
    const step = getStep(id);
    if (!step) { finishTutorial(); return; }
    tutorial.index = id - 1;
    tutorial.aiMoved = false;
    tutorial.touchedControl = false;
    globalThis.clearTimeout(tutorialAdvanceTimer);
    globalThis.clearTimeout(tutorialAiTimer);
    warnBox = null;
    lastMoveInfo = null;
    if (step.seatFromStateOf && tutorial.board4) {
      game = tutorial.board4;
      game.turn = 'A';
    } else {
      game = buildBoard(step.seedEdges);
    }
    if (step.dangerBox) {
      warnBox = step.dangerBox;
      warnFlashUntil = 0;
    }
    paused = true; // tutorial không có đồng hồ
    ui.updateTutorialBar({
      visible: true,
      step: step.title,
      text: step.instruction,
      hint: step.hint,
      hintState: '',
      showFinish: step.id === 5,
      finishLabel: TUTORIAL_LABELS.finishCta,
    });
    ui.updateHintButton(HINT_LIMIT, HINT_LIMIT);
    setScreen('play');
    render();
    // Bước 5 cho phép thử đổi control thật; các bước khác khoá để không lệch kịch bản.
    ui.setSizeDisabled(id === 5);
    // Đưa hàng tùy chọn vào tầm mắt ở bước 5 (bàn bị khoá, chỉ còn control để bấm).
    try { if (id === 5) ui.scrollOptionsIntoView(); } catch { /* bỏ qua */ }
  }

  function allowedNow(edge) {
    if (!isTutorialBoard()) return true;
    const step = getStep(tutorial.index + 1);
    if (!step) return false;
    return listHasEdge(step.allowedEdges, edge);
  }

  function isDecoy(edge) {
    const step = getStep(tutorial.index + 1);
    if (!step) return false;
    return listHasEdge(step.decoyEdges || [], edge);
  }

  function commitTutorialMove(edge) {
    const step = getStep(tutorial.index + 1);
    if (!step || !game) return false;
    if (isDecoy(edge)) {
      // Bước 4: cạnh mồi → rung + nháy đỏ + hoàn tác sau 900ms.
      const res = applyMove(game, edge);
      if (!res.ok) return false;
      lastMoveInfo = { edge, player: res.player, closed: res.closed };
      highlightAt = now();
      renderer.animateMove({ edge, player: res.player, closed: res.closed });
      audio.play('tick');
      if (warnBox) warnFlashUntil = now() + 900;
      vibrate(200);
      ui.updateTutorialBar({ visible: true, hint: step.failLine, hintState: 'fail' });
      render();
      const gid = gameId;
      const seq = game.turnSeq;
      globalThis.setTimeout(() => {
        if (gid !== gameId || !game || game.turnSeq !== seq) return;
        warnFlashUntil = 0;
        beginStep(step.id); // hoàn tác = dựng lại đúng seed của bước
      }, step.failUndoDelayMs || 900);
      return true;
    }
    if (!listHasEdge(step.allowedEdges, edge)) {
      return false; // ngoài vùng cho phép → không phản hồi
    }
    const res = applyMove(game, edge);
    if (!res.ok) return false;
    lastMoveInfo = { edge, player: res.player, closed: res.closed };
    highlightAt = now();
    renderer.animateMove({ edge, player: res.player, closed: res.closed });
    audio.play('tick');
    if (res.closed.length) audio.play('tock', 1);
    hoverEdge = null;
    render();
    // Câu chốt
    ui.updateTutorialBar({ visible: true, hint: step.successLine, hintState: 'success' });
    if (step.id === 4) warnFlashUntil = 0;
    ui.announce(step.successLine);
    // Bước 3: đến lượt máy → máy đi đúng aiReply.
    if (step.id === 3) {
      const key = `[${edge[0]},${edge[1]},${edge[2]}]`;
      const reply = (step.aiReply && step.aiReply[key]) || step.aiMoves;
      ui.updateTutorialBar({ visible: true, hint: TUTORIAL_LABELS.comThinking, hintState: '' });
      const gid = gameId;
      const seq = game.turnSeq;
      tutorialAiTimer = globalThis.setTimeout(() => {
        if (gid !== gameId || !game || game.turnSeq !== seq) return;
        const e = reply && reply[0];
        if (!e) return;
        const r2 = applyMove(game, e);
        if (!r2.ok) return;
        lastMoveInfo = { edge: r2.edge, player: r2.player, closed: r2.closed };
        highlightAt = now();
        renderer.animateMove({ edge: r2.edge, player: r2.player, closed: r2.closed });
        audio.play('tick');
        render();
        // Hiện câu chốt "Lại đến lượt bạn." và GIỮ nó đủ advanceDelayMs TRƯỚC khi sang bước 4
        // (nếu gọi advanceTutorial ngay, thanh dưới bị ghi đè bởi câu của bước 4).
        ui.updateTutorialBar({ visible: true, hint: TUTORIAL_LABELS.comDone, hintState: 'success' });
        tutorial.aiMoved = true;
        const seq2 = game.turnSeq;
        tutorialAdvanceTimer = globalThis.setTimeout(() => {
          if (gid !== gameId || !game) return;
          if (tutorial.index === 2) {
            tutorial.board3 = cloneForTutorial(game);
            advanceTutorial(4);
          }
        }, step.advanceDelayMs);
      }, step.aiDelayMs || 600);
      return true;
    }
    if (step.id === 5) {
      return true;
    }
    const gid = gameId;
    const seq = game.turnSeq;
    tutorialAdvanceTimer = globalThis.setTimeout(() => {
      if (gid !== gameId || !game) return;
      // Bước 1 và 2 không phụ thuộc turnSeq (tutorial không có timer tranh chấp).
      advanceTutorial(step.id + 1);
    }, step.advanceDelayMs);
    return true;
  }

  function advanceTutorial(nextId) {
    if (!isTutorialBoard()) return;
    const cur = getStep(tutorial.index + 1);
    if (cur && cur.id === 4) tutorial.board4 = cloneForTutorial(game);
    if (nextId > TUTORIAL_STEPS.steps.length) {
      finishTutorial();
      return;
    }
    beginStep(nextId);
  }

  function cloneForTutorial(g) {
    const copy = createGame({ n: g.n });
    for (const [k, p] of g.edges) copy.edges.set(k, p);
    copy.boxes = g.boxes.slice();
    copy.turn = 'A';
    copy.turnSeq = g.turnSeq;
    copy.moveCount = g.moveCount;
    return copy;
  }

  /** Bước 5: khi người chơi chạm control thật trong thanh tùy chọn. */
  function onTutorialControlTouched() {
    const step = getStep(tutorial ? tutorial.index + 1 : 0);
    if (!step || step.id !== 5 || tutorial.touchedControl) return;
    tutorial.touchedControl = true;
    ui.updateTutorialBar({ visible: true, hint: TUTORIAL_STEP5_DONE_HINT, hintState: 'success' });
    ui.showToast(step.successLine);
    audio.play('blip');
  }

  function finishTutorial({ goMenu: backToMenu = false } = {}) {
    globalThis.clearTimeout(tutorialAdvanceTimer);
    globalThis.clearTimeout(tutorialAiTimer);
    tutorial = null;
    warnBox = null;
    writeJSON(STORAGE_KEYS.tutorialDone, true);
    writeJSON(STORAGE_KEYS.tooltipSeen, true);
    ui.updateTutorialBar({ visible: false });
    // Ẩn cả nút "Bỏ qua" / "Xong" của tutorial và khối tùy chọn của bước 5 (trước đây dính lại
    // sau khi học xong). `setOptionsExpanded(false)` gọi thẳng để không phụ thuộc beginStep.
    ui.setOptionsExpanded(false);
    ui.updateTutorialBar({ visible: false, hint: '', hintState: '' });
    if (backToMenu) {
      goMenu();
      return;
    }
    // Mở ván thật 3×3, độ khó Dễ, người chơi đi trước.
    startMatch({ size: 3, difficulty: 'easy', first: 'you', mode: 'ai', timeLimitOn: settings.timeLimitOn });
  }

  /* ---------------------------------------------------------- Input */

  function hitTest(clientX, clientY, { onlyLegal = false } = {}) {
    if (!game) return null;
    const rect = ui.elements.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const geom = renderer.geometry();
    if (geom.step <= 0) return null;
    const scaleX = geom.cssW > 0 ? geom.cssW / rect.width : 1;
    const scaleY = geom.cssH > 0 ? geom.cssH / rect.height : 1;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const n = game.n;
    // Vị trí trong ô lưới điểm gần nhất để biết đang gần cạnh ngang hay dọc.
    const fx = (x - geom.originX) / geom.step;
    const fy = (y - geom.originY) / geom.step;
    const dx = fx - Math.round(fx);
    const dy = fy - Math.round(fy);
    const maxDist = Math.min(26, geom.step * 0.46);
    const candidates = [];
    // Cạnh ngang gần nhất: [round(fy), floor(fx), 'H']
    candidates.push({ edge: [Math.round(fy), Math.floor(fx), 'H'], dist: Math.abs(dy) * geom.step, along: Math.abs(dx) });
    // Cạnh dọc gần nhất: [floor(fy), round(fx), 'V']
    candidates.push({ edge: [Math.floor(fy), Math.round(fx), 'V'], dist: Math.abs(dx) * geom.step, along: Math.abs(dy) });
    candidates.forEach((c) => {
      c.okAlong = c.along <= 0.5 + 0.08;
      c.okDist = c.dist <= maxDist;
    });
    const valid = candidates.filter((c) => {
      if (!c.okAlong || !c.okDist || !inRange(c.edge, n)) return false;
      if (onlyLegal && !isLegal(game, c.edge)) return false;
      return true;
    });
    if (!valid.length) return null;
    valid.sort((a, b) => a.dist - b.dist);
    return valid[0].edge;
  }

  function inRange(edge, n) {
    const [r, c, o] = edge;
    if (o === 'H') return r >= 0 && r <= n && c >= 0 && c <= n - 1;
    return r >= 0 && r <= n - 1 && c >= 0 && c <= n;
  }

  const canvas = ui.elements.canvas;

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return; // mobile: không preview khi kéo (tránh loạn)
    if (!game || screen !== 'play') return;
    const legalEdge = hitTest(e.clientX, e.clientY, { onlyLegal: true });
    const next = legalEdge && (!isTutorialBoard() || allowedNow(legalEdge) || isDecoy(legalEdge)) ? legalEdge : null;
    if ((hoverEdge && !next) || (!hoverEdge && next) || (hoverEdge && next && edgeKey(hoverEdge) !== edgeKey(next))) {
      hoverEdge = next;
      render(false); // chỉ đổi preview trên canvas → không đụng DOM
    }
  });

  canvas.addEventListener('pointerleave', () => {
    if (hoverEdge) {
      hoverEdge = null;
      render(false);
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (!game || screen !== 'play') return;
    if (!currentIsHuman()) return;
    if (boardLocked()) return; // bước 5 tutorial: bàn khoá, nút Xong nằm dưới bàn
    if (pointerDownId !== null) return; // chống multi-touch đè lên ngón đang giữ
    const edge = hitTest(e.clientX, e.clientY, { onlyLegal: true });
    pointerDownEdge = edge;
    pointerDownPos = edge ? { x: e.clientX, y: e.clientY } : null;
    pointerDownId = edge ? e.pointerId : null;
    if (pointerDownEdge) {
      keyboardActive = false;
      // KHÔNG setPointerCapture: bắt pointer là trình duyệt gửi mọi pointerup về canvas, khiến
      // nút nằm dưới ngón tay (vd "Bỏ qua" của hướng dẫn) có thể mất cú thả → không phát `click`
      // (người dùng phải bấm 2 lần). Kéo-huỷ đã được xử lý qua sự kiện pointerup trên canvas.
      hoverEdge = pointerDownEdge;
      render(false);
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!pointerDownEdge) return;
    if (pointerDownId !== null && e.pointerId !== pointerDownId) return;
    const start = pointerDownEdge;
    const downPos = pointerDownPos;
    pointerDownEdge = null;
    pointerDownPos = null;
    pointerDownId = null;
    const edge = hitTest(e.clientX, e.clientY, { onlyLegal: true });
    const geom = renderer.geometry();
    const dragDist = downPos ? Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) : 0;
    const cancelThreshold = Math.max(18, geom.step * 0.42);
    // Kéo-huỷ: chỉ huỷ khi người chơi kéo tay ra xa khỏi vị trí chạm ban đầu VÀ rời khỏi cạnh đã chọn.
    if ((!edge || edgeKey(edge) !== edgeKey(start)) && dragDist > cancelThreshold) {
      hoverEdge = null;
      render();
      return;
    }
    hoverEdge = null;
    commitMove(start);
  });

  canvas.addEventListener('pointercancel', (e) => {
    if (pointerDownId !== null && e.pointerId !== pointerDownId) return;
    pointerDownEdge = null;
    pointerDownPos = null;
    pointerDownId = null;
    hoverEdge = null;
    render();
  });

  /* ------------------------------------------------------- Bàn phím */

  function refreshFocusEdge() {
    if (!game) return;
    const legal = legalEdges(game).filter((e) => !isTutorialBoard() || allowedNow(e) || isDecoy(e));
    if (!legal.length) { focusEdge = null; return; }
    if (!focusEdge || !legal.some((e) => edgeKey(e) === edgeKey(focusEdge))) {
      focusEdge = legal[0];
    }
  }

  /**
   * Đọc CẠNH ĐANG CHỌN bằng bàn phím thành chữ cho trình đọc màn hình (vùng aria-live polite).
   * Bàn cờ là <canvas aria-hidden="true">; lưới ẩn `.sr-grid` là kênh ARIA chính, nhưng khi chơi
   * bằng phím trên canvas (Tab → canvas) người dùng trình đọc màn hình cần biết cạnh nào đang chọn.
   */
  function announceFocusEdge() {
    if (!focusEdge) return;
    const [r, c, o] = focusEdge;
    ui.announce(`Đang chọn: cạnh ${o === 'H' ? 'ngang' : 'dọc'} hàng ${r + 1} cột ${c + 1}.`);
  }

  // Focus ring CHỈ hiện khi người chơi THỰC SỰ điều hướng bằng phím (mũi tên/Enter/Space…).
  // BUG báo 14/11: chỉ cần bấm chuột/Chạm vào bàn là canvas nhận focus → `keyboardActive = true`
  // → vẽ vòng focus màu xanh ở cạnh đầu tiên (góc trên-trái) dù KHÔNG có nước đi nào được thực hiện;
  // người chơi tưởng đó là viền ô. Nay: focus bằng chuột/chạm thì KHÔNG vẽ ring; chỉ khi bấm phím
  // điều hướng mới bật (xử lý ở keydown bên dưới).
  canvas.addEventListener('focus', () => {
    keyboardActive = false;
    refreshFocusEdge();
    render();
  });

  canvas.addEventListener('blur', () => {
    keyboardActive = false;
    render();
  });

  canvas.addEventListener('keydown', (e) => {
    if (!game || screen !== 'play') return;
    keyboardActive = true;
    if (!focusEdge) refreshFocusEdge();
    if (!focusEdge) return;
    const n = game.n;
    const all = [];
    for (let rr = 0; rr <= n; rr++) for (let cc = 0; cc < n; cc++) all.push([rr, cc, 'H']);
    for (let cc = 0; cc <= n; cc++) for (let rr = 0; rr < n; rr++) all.push([rr, cc, 'V']);
    const playable = all.filter((x) => isLegal(game, x) && (!isTutorialBoard() || allowedNow(x) || isDecoy(x)));
    const idx = playable.findIndex((x) => edgeKey(x) === edgeKey(focusEdge));
    let nextIdx = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIdx = Math.min(playable.length - 1, idx + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIdx = Math.max(0, idx - 1);
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = playable.length - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (currentIsHuman() && !boardLocked()) commitMove(focusEdge);
      return;
    } else {
      return;
    }
    e.preventDefault();
    focusEdge = playable[nextIdx] || focusEdge;
    render();
    announceFocusEdge();
  });

  /* -------------------------------------- Lưới ẩn cho trình đọc màn hình */

  function rebuildSrGrid() {
    const grid = ui.elements.srGrid;
    if (!grid || !game) return;
    grid.innerHTML = '';
    // Bước 5 tutorial: bàn khoá → lưới ẩn rỗng (không mời người dùng bấm cạnh vô ích).
    if (boardLocked()) return;
    const legal = legalEdges(game).filter((e) => !isTutorialBoard() || allowedNow(e) || isDecoy(e));
    for (const e of legal) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'gridcell');
      const type = e[2] === 'H' ? 'ngang' : 'dọc';
      btn.setAttribute('aria-label', `Cạnh ${type} hàng ${e[0] + 1} cột ${e[1] + 1}, chưa tô`);
      btn.addEventListener('click', () => {
        if (currentIsHuman()) commitMove(e);
      });
      // Đi nước bằng lưới ẩn (trình đọc màn hình) — người dùng không thấy canvas nên cần biết
      // cạnh nào 'đã tô' / bàn đã sẵn sàng chơi bằng trình đọc màn hình.
      btn.addEventListener('focus', () => {
        ui.announce(`Sẵn sàng: ${legal.length} cạnh chưa tô. Cạnh đang chọn: ${type} hàng ${e[0] + 1} cột ${e[1] + 1}.`);
      });
      grid.appendChild(btn);
    }
  }

  /* ------------------------------------------------------------ Ad hoc */

  function syncEverything() {
    ui.syncSettings(settings);
    ui.syncThemeButton(settings.theme);
    ui.syncSoundButton(settings.sound);
    ui.showSoundChip(settings.sound && !audioUnlocked);
    ads.showBanner();
  }

  /* --------------------------------------------------------- Vòng đời */

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseClock();
    } else {
      resumeClock();
      scheduleAiIfNeeded();
    }
  });

  // Escape/đóng modal → chạy lại nhịp máy.
  const observer = { attached: false };
  function watchModal() {
    if (observer.attached) return;
    observer.attached = true;
    const modalEl = ui.elements.modal;
    const mo = new MutationObserver(() => {
      if (modalEl.hidden) {
        resumeClock();
        scheduleAiIfNeeded();
      } else {
        pauseClock();
      }
    });
    mo.observe(modalEl, { attributes: true, attributeFilter: ['hidden'] });
  }
  watchModal();

  /* ------------------------------------------------------------- DEBUG */

  function snapshot() {
    if (!game) return null;
    const s = score(game);
    return {
      screen,
      tutorial: isTutorialBoard() ? tutorial.index + 1 : null,
      n: game.n,
      turn: game.turn,
      turnSeq: game.turnSeq,
      moveCount: game.moveCount,
      score: { A: s.A, B: s.B, total: s.total },
      remaining: legalEdges(game).length,
      over: isOver(game),
      mode: match ? match.mode : null,
      difficulty: match ? match.difficulty : null,
      hintLeft,
      theme: settings.theme,
      errors: errors.slice(),
    };
  }

  const debugApi = {
    startGame(opts = {}) {
      const o = typeof opts === 'object' && opts ? opts : {};
      debugDriven = true;
      if (o.tutorial) { startTutorial(); return snapshot(); }
      startMatch({
        size: Number.isInteger(o.size) ? o.size : settings.boardSize,
        mode: ['ai', 'pvp'].includes(o.mode) ? o.mode : settings.mode,
        difficulty: ['easy', 'medium', 'hard'].includes(o.difficulty) ? o.difficulty : settings.difficulty,
        first: o.first === 'com' ? 'com' : (o.first === 'toss' ? 'toss' : 'you'),
        timeLimitOn: o.timeLimitOn !== undefined ? !!o.timeLimitOn : settings.timeLimitOn,
        timeSec: o.timeSec,
      });
      return snapshot();
    },
    playEdge(edge) {
      if (!Array.isArray(edge) || edge.length < 3) return { ok: false, reason: 'invalid' };
      const e = [Number(edge[0]), Number(edge[1]), String(edge[2])];
      const ok = commitMove(e, { byAi: true });
      return { ok, state: snapshot() };
    },
    /** Chơi một cạnh hợp lệ bất kỳ (tiện cho test/screenshot khi cần đánh nhanh). */
    playLegalEdge() {
      if (!game || isOver(game)) return { ok: false, reason: 'over' };
      const legal = legalEdges(game);
      if (!legal.length) return { ok: false, reason: 'over' };
      const ok = commitMove(legal[0], { byAi: true });
      return { ok, state: snapshot() };
    },
    /** Chỉ dùng cho test: vào thẳng bước tutorial thứ `id` (1..5). */
    gotoTutorialStep(id) {
      const step = getStep(id);
      if (!step) return { ok: false, reason: 'bad-step' };
      if (!isTutorialBoard()) startTutorial();
      tutorial.board4 = null;
      tutorial.aiMoved = false;
      tutorial.touchedControl = false;
      beginStep(id);
      return { ok: true, state: snapshot() };
    },
    /** Chỉ dùng cho test: về menu ngay (không qua hộp xác nhận). */
    showMenu() {
      goMenu();
      return snapshot();
    },
    getState: () => snapshot(),
    setTheme(t) {
      if (!['system', 'light', 'dark'].includes(t)) return false;
      applySettingChange({ theme: t });
      return true;
    },
    /** Chỉ dùng cho test: chạy nước của máy ngay (không chờ delay). */
    stepAi() {
      if (!game || !match || match.mode !== 'ai' || game.turn !== 'B') return { ok: false };
      globalThis.clearTimeout(aiTimer);
      const seq = game.turnSeq;
      const edge = chooseMove(game, { level: match.difficulty });
      if (!edge || game.turnSeq !== seq) return { ok: false };
      commitMove(edge, { byAi: true });
      return { ok: true, state: snapshot() };
    },
    errors,
  };
  Object.freeze(debugApi);
  globalThis.__game = debugApi;

  /* ----------------------------------------------------------- Khởi động */

  // Nếu mở bằng file:// và module đã nạp được (ví dụ qua bundle) → vẫn chạy bình thường.
  syncEverything();
  ui.showSoundChip(settings.sound);
  setScreen('menu');
  ads.showBanner();

  // Tự mở hướng dẫn nhanh lần đầu (nếu chưa học).
  if (!readJSON(STORAGE_KEYS.tutorialDone, false)) {
    openQuickGuide();
  }

  // Query param debug: tự vào ván để chụp ảnh/test.
  if (debug) {
    const auto = params.get('start') === '1' || params.get('autostart') === '1';
    if (auto) {
      startMatch({ mode: settings.mode, size: settings.boardSize, difficulty: settings.difficulty, first: 'you' });
    }
  }

  // Vẽ lại khi đổi theme (renderer tự nghe 'themechange'), cập nhật HUD.
  globalThis.addEventListener('themechange', () => { try { render(); } catch { /* bỏ qua */ } });

  renderSelftest();
  // Báo cho index.html biết app đã khởi động (để không hiện hướng dẫn file://).
  globalThis.__bootOk = true;
}

/* ---------------------------------------------------------------------------
 * Điểm vào: chờ DOM sẵn sàng, bắt lỗi khởi động để hiện #selftest.
 * ------------------------------------------------------------------------- */
function safeBoot() {
  try {
    boot();
  } catch (e) {
    recordError('boot', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeBoot, { once: true });
} else {
  safeBoot();
}
