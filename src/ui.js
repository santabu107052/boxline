/**
 * ui.js — lớp DOM: icon SVG, màn hình, HUD, modal, toast, oẳn tù tì, màn hướng dẫn nhanh.
 *
 * Nguồn: docs/20-DESIGN.md §5, §8 (icon stroke 2px inline, không icon font, không CDN)
 *        docs/30-TUTORIAL.md (câu chữ lấy từ tutorial.js, KHÔNG viết lại trong file này).
 *
 * Nguyên tắc: ui.js KHÔNG quyết định luật/điểm; nó chỉ render theo dữ liệu được đưa vào
 * và phát sự kiện cho main.js qua callback.
 */
import {
  BOARD_SIZES,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  FIRST_LABELS_AI,
  FIRST_LABELS_PVP,
  FIRST_OPTIONS,
  RPS_LABELS,
  TIME_LIMITS,
  THEMES,
  APP_NAME,
  APP_SUBTITLE,
} from './config.js';
import { GLOSSARY, HINT_LABELS, QUICK_GUIDE, RULES_MODAL, RULES_SHORT, TUTORIAL_STEPS } from './tutorial.js';

/* ---------------------------------------------------------------------------
 * ICON — tự dựng path, stroke 2px, viewBox 24×24, currentColor (§8.1)
 * ------------------------------------------------------------------------- */
const ICON_PATHS = {
  // Bánh răng: vòng ngoài răng cưa + lỗ tâm (không dùng nan tỏa tia để khỏi giống icon mặt trời).
  settings: [
    '<circle cx="12" cy="12" r="3.2"/>',
    '<path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.6a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 19.4 9v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  ],
  sun: ['<circle cx="12" cy="12" r="5"/>', '<path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>'],
  moon: ['<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'],
  monitor: ['<rect x="3" y="4" width="18" height="12" rx="2"/>', '<path d="M9 20h6M12 16v4"/>'],
  timer: ['<circle cx="12" cy="12" r="9"/>', '<path d="M12 7v5l3 3"/>'],
  refresh: ['<path d="M20 12a8 8 0 1 1-2.34-5.66"/>', '<path d="M20 4v5h-5"/>'],
  bulb: ['<path d="M9 18h6"/><path d="M10 21h4"/>', '<path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>'],
  help: ['<circle cx="12" cy="12" r="9"/>', '<path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/>', '<path d="M12 17.5h.01"/>'],
  play: ['<path d="M8 5.5l10 6.5-10 6.5z" fill="currentColor" stroke="none"/>'],
  close: ['<path d="M6 6l12 12M18 6L6 18"/>'],
  user: ['<circle cx="12" cy="8" r="4"/>', '<path d="M4 20c1.6-3.6 4.6-5 8-5s6.4 1.4 8 5"/>'],
  cpu: ['<rect x="6" y="6" width="12" height="12" rx="4"/>', '<path d="M9.5 11h.01M14.5 11h.01"/><path d="M12 3v3M12 18v3"/>'],
  volumeOn: ['<path d="M4 9v6h3l5 4V5L7 9z"/>', '<path d="M16.5 8.5a5 5 0 0 1 0 7"/>', '<path d="M19 6a9 9 0 0 1 0 12"/>'],
  volumeOff: ['<path d="M4 9v6h3l5 4V5L7 9z"/>', '<path d="M16 9.5l5 5M21 9.5l-5 5"/>'],
  trophy: ['<path d="M8 4h8v5a4 4 0 0 1-8 0z"/>', '<path d="M8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4"/>', '<path d="M12 13v4M9 20h6"/>'],
  equal: ['<path d="M5 10h14M5 14h14"/>'],
  chevronDown: ['<path d="M6 9l6 6 6-6"/>'],
  arrowLeft: ['<path d="M15 5l-7 7 7 7"/>'],
  book: ['<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/>', '<path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>'],
  grid: ['<rect x="3" y="3" width="18" height="18" rx="2"/>', '<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'],
  check: ['<path d="M5 12.5l4.5 4.5L19 7.5"/>'],
  flag: ['<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>'],
};

/** Tạo SVGElement cho icon. Không dùng innerHTML của trang. */
export function icon(name, size = 24, extraClass = '') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', `icon ${extraClass}`.trim());
  const paths = ICON_PATHS[name] || ICON_PATHS.grid;
  for (const markup of paths) {
    // Markup là hằng số nội bộ (không phải input người dùng) → an toàn.
    const wrap = document.createElementNS(ns, 'g');
    wrap.innerHTML = markup; // eslint-disable-line
    // Chỉ chép phần tử con; .icon trên <svg> lo fill/stroke.
    while (wrap.firstChild) {
      const child = wrap.firstChild;
      if (child.nodeType === 1 && !child.getAttribute('fill')) child.setAttribute('fill', 'none');
      svg.appendChild(child);
    }
  }
  return svg;
}

/** Ký hiệu người chơi: A = tròn, B = tam giác (§8.2). */
export function playerSymbol(which, size = 22) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'sym');
  if (which === 'B') {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M12 5 L19 18 L5 18 Z');
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2');
    p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p);
  } else {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', '12');
    c.setAttribute('cy', '12');
    c.setAttribute('r', '7');
    c.setAttribute('fill', 'none');
    c.setAttribute('stroke', 'currentColor');
    c.setAttribute('stroke-width', '2');
    svg.appendChild(c);
    const d = document.createElementNS(ns, 'circle');
    d.setAttribute('cx', '12');
    d.setAttribute('cy', '12');
    d.setAttribute('r', '2');
    d.setAttribute('fill', 'currentColor');
    svg.appendChild(d);
  }
  return svg;
}

/** Bàn tay oẳn tù tì — búa / bao / kéo (nét mảnh, tự dựng). */
export function rpsIcon(choice, size = 40) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  const paths = {
    rock: '<rect x="6" y="8" width="12" height="11" rx="4"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    paper: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h3"/>',
    scissors: '<circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="M9 16L19 4M15 16L5 4"/>',
  };
  svg.setAttribute('class', 'icon');
  const g = document.createElementNS(ns, 'g');
  g.innerHTML = paths[choice] || paths.rock; // eslint-disable-line
  // Style nằm ở .icon của <svg> nên phần tử con tự nhận currentColor (không fill đen).
  while (g.firstChild) svg.appendChild(g.firstChild);
  return svg;
}

/* ---------------------------------------------------------------------------
 * TIỆN ÍCH DOM
 * ------------------------------------------------------------------------- */
function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v; // chỉ cho hằng số nội bộ
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

const $ = (id) => document.getElementById(id);

/* ---------------------------------------------------------------------------
 * UI FACTORY
 * ------------------------------------------------------------------------- */

/**
 * @param {{on?:object, getSettings?:Function, audio?:object}} deps
 *        on = { startGame, quickGuide, tutorial, settings, change, hint, newGame,
 *               rules, theme, toggleSound, rpsPick, resultAction }
 */
export function createUI(deps = {}) {
  const on = deps.on || {};
  const emit = (name, ...args) => {
    if (typeof on[name] === 'function') on[name](...args);
  };
  let settings = { theme: 'system', sound: true, ...(deps.getSettings ? deps.getSettings() : {}) };
  let modalStack = [];
  let lastFocused = null;
  let toastTimer = 0;
  let toastHideTimer = 0;
  let comboHideTimer = 0;
  let rpsBusy = false;

  /* ----------------------------------------------------------- SEGMENTED */

  /**
   * Dựng segmented control (role=radiogroup, aria-checked; bàn phím ←/→).
   * @returns {{el:HTMLElement, setValue:Function, getValue:Function, setDisabled:Function}}
   */
  function segmented({ name, options, value, onChange, extraClass = '', labels = null, id = null, wrap = false }) {
    const group = h('div', {
      class: `segmented ${extraClass}${wrap ? ' segmented--grid' : ''}`.trim(),
      role: 'radiogroup',
      id: id || undefined,
      'aria-label': name,
    });
    let current = value;
    const segs = [];
    const labelOf = (v) => (labels && labels[v] !== undefined ? labels[v] : String(v));
    options.forEach((opt) => {
      const seg = h('button', {
        type: 'button',
        class: 'segmented__seg',
        role: 'radio',
        'aria-checked': String(opt === current),
        tabindex: opt === current ? '0' : '-1',
        'aria-label': labelOf(opt),
        text: labelOf(opt),
        dataset: { value: String(opt) },
      });
      seg.addEventListener('click', () => {
        setValue(opt, true);
      });
      seg.addEventListener('keydown', (e) => {
        const idx = options.indexOf(current);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          const nxt = options[(idx + 1) % options.length];
          setValue(nxt, true);
          segs[options.indexOf(nxt)].focus();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = options[(idx - 1 + options.length) % options.length];
          setValue(prev, true);
          segs[options.indexOf(prev)].focus();
        }
      });
      segs.push(seg);
      group.appendChild(seg);
    });

    function setValue(next, userInitiated = false) {
      if (next === current) return;
      current = next;
      segs.forEach((s, i) => {
        const on_ = options[i] === current;
        s.setAttribute('aria-checked', String(on_));
        s.setAttribute('tabindex', on_ ? '0' : '-1');
      });
      if (userInitiated && typeof onChange === 'function') onChange(current);
    }

    return {
      el: group,
      setValue: (v) => setValue(v, false),
      getValue: () => current,
      setDisabled: (flag) => {
        segs.forEach((s) => {
          s.setAttribute('aria-disabled', flag ? 'true' : 'false');
          s.disabled = !!flag;
        });
      },
      focus: () => segs[options.indexOf(current)] && segs[options.indexOf(current)].focus(),
    };
  }

  /** Hàng switch (role=switch), cả hàng bấm được, cao ≥ 44px. */
  function switchRow({ label, sub, checked, onChange, id }) {
    const row = h('button', {
      type: 'button',
      class: 'row',
      role: 'switch',
      id: id || undefined,
      'aria-checked': String(!!checked),
      'aria-label': label,
    }, [
      h('span', { class: 'row__label' }, [
        label,
        sub ? h('span', { class: 'row__sub', text: sub }) : null,
      ]),
      h('span', { class: 'switch', 'aria-hidden': 'true' }),
    ]);
    row.addEventListener('click', () => {
      if (row.getAttribute('aria-disabled') === 'true') return;
      const next = row.getAttribute('aria-checked') !== 'true';
      row.setAttribute('aria-checked', String(next));
      if (typeof onChange === 'function') onChange(next);
    });
    return {
      el: row,
      set: (v) => row.setAttribute('aria-checked', String(!!v)),
      get: () => row.getAttribute('aria-checked') === 'true',
      setDisabled: (flag) => row.setAttribute('aria-disabled', flag ? 'true' : 'false'),
    };
  }

  /**
   * Hàng thanh trượt (âm lượng). Input `type=range` là điều khiển CHUẨN của trình duyệt: có sẵn
   * hỗ trợ bàn phím (mũi tên/Home/End) và trình đọc màn hình. Nhãn đọc được giá trị theo %.
   * (DESIGN §8.3: "âm lượng 60%" mặc định — trước đây cấu hình `volume` CÓ trong dữ liệu nhưng
   * KHÔNG có chỗ chỉnh trong UI.)
   */
  function sliderRow({ label, value, onChange, id, min = 0, max = 1, step = 0.05 }) {
    const out = h('output', { class: 'row__value', id: `${id}-value`, text: `${Math.round(value * 100)}%` });
    const input = h('input', {
      type: 'range',
      class: 'slider',
      id,
      min: String(min),
      max: String(max),
      step: String(step),
      value: String(value),
      'aria-label': label,
      'aria-valuetext': `${Math.round(value * 100)} phần trăm`,
    });
    const row = h('div', { class: 'row row--slider' }, [
      h('span', { class: 'row__label' }, [label, out]),
      input,
    ]);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      out.textContent = `${Math.round(v * 100)}%`;
      input.setAttribute('aria-valuetext', `${Math.round(v * 100)} phần trăm`);
      if (typeof onChange === 'function') onChange(v);
    });
    return {
      el: row,
      set: (v) => {
        input.value = String(v);
        out.textContent = `${Math.round(v * 100)}%`;
        input.setAttribute('aria-valuetext', `${Math.round(v * 100)} phần trăm`);
      },
    };
  }

  /* ---------------------------------------------------------------- MENU */

  const modeSeg = segmented({
    name: 'Chế độ chơi',
    options: ['ai', 'pvp'],
    labels: { ai: 'Chơi với máy', pvp: '2 người' },
    value: settings.mode || 'ai',
    onChange: (v) => { syncMenuVisibility(v); emit('change', { mode: v }); },
  });
  const sizeSeg = segmented({
    id: 'seg-size',
    name: 'Kích thước bàn',
    options: BOARD_SIZES,
    labels: Object.fromEntries(BOARD_SIZES.map((n) => [n, `${n}×${n}`])),
    value: settings.boardSize || 5,
    extraClass: 'segmented--sizes',
    wrap: true,
    onChange: (v) => emit('change', { boardSize: v }),
  });
  const diffSeg = segmented({
    id: 'seg-difficulty',
    name: 'Độ khó',
    options: DIFFICULTIES,
    labels: DIFFICULTY_LABELS,
    value: settings.difficulty || 'medium',
    onChange: (v) => emit('change', { difficulty: v }),
  });
  const firstSeg = segmented({
    name: 'Ai đi trước',
    options: FIRST_OPTIONS,
    value: settings.first || 'you',
    labels: settings.mode === 'pvp' ? FIRST_LABELS_PVP : FIRST_LABELS_AI,
    onChange: (v) => emit('change', { first: v }),
  });
  const timeToggle = switchRow({
    id: 'switch-time',
    label: 'Thời gian mỗi lượt',
    sub: 'Hết giờ thì mất lượt',
    checked: settings.timeLimitOn !== false,
    onChange: (v) => {
      syncTimePicker(v);
      emit('change', { timeLimitOn: v });
    },
  });
  const timePicker = h('div', { class: 'time-picker' });
  const timeSeg = segmented({
    name: 'Số giây mỗi lượt',
    options: TIME_LIMITS,
    labels: Object.fromEntries(TIME_LIMITS.map((s) => [s, `${s} giây`])),
    value: settings.timeLimitSec || 20,
    onChange: (v) => emit('change', { timeLimitSec: v }),
  });
  timePicker.appendChild(timeSeg.el);

  function syncTimePicker(flag) {
    timePicker.hidden = !flag;
    timeSeg.setDisabled(!flag);
  }

  const sizeField = h('fieldset', { class: 'fieldset', id: 'field-size' }, [
    h('legend', { class: 'fieldset__legend', text: 'Kích thước bàn' }),
    sizeSeg.el,
  ]);
  const diffField = h('fieldset', { class: 'fieldset', id: 'field-difficulty' }, [
    h('legend', { class: 'fieldset__legend', text: 'Độ khó' }),
    diffSeg.el,
  ]);
  const firstField = h('fieldset', { class: 'fieldset' }, [
    h('legend', { class: 'fieldset__legend', text: 'Ai đi trước' }),
    firstSeg.el,
    h('p', { class: 'fieldset__hint', id: 'first-hint', text: 'Chọn Oẳn tù tì để tung búa–bao–kéo quyết định ai đi trước.' }),
  ]);

  function syncMenuVisibility(mode) {
    diffField.hidden = mode !== 'ai';
  }

  const themeIconBtn = h('button', {
    type: 'button',
    class: 'btn btn--icon',
    id: 'btn-theme',
    'aria-label': 'Đổi giao diện: theo hệ thống',
    title: 'Đổi giao diện',
  }, [icon('monitor', 24)]);
  const settingsIconBtn = h('button', {
    type: 'button',
    class: 'btn btn--icon',
    id: 'btn-settings',
    'aria-label': 'Cài đặt',
    title: 'Cài đặt',
  }, [icon('settings', 24)]);
  const soundBtn = h('button', {
    type: 'button',
    class: 'chip',
    id: 'btn-sound',
    'aria-pressed': settings.sound !== false ? 'true' : 'false',
  }, [icon(settings.sound !== false ? 'volumeOn' : 'volumeOff', 20), h('span', { text: settings.sound !== false ? 'Âm thanh: Bật' : 'Âm thanh: Tắt' })]);

  const guideBtn = h('button', { type: 'button', class: 'chip', id: 'btn-guide' }, [icon('book', 20), h('span', { text: 'Hướng dẫn' })]);

  /* Thanh "Chơi ngay" ghim đáy menu.
     Lý do (lỗi người dùng báo 14/11): danh sách tuỳ chọn dài hơn màn hình nên "Độ khó" — và trước
     đây cả nút "Chơi nhanh" — nằm ngoài khung nhìn, phải tự cuộn mới thấy, nhiều người tưởng game
     không có mục độ khó. Nút chơi + tóm tắt lựa chọn hiện tại luôn ghim dưới đáy, chỉ phần danh
     sách tuỳ chọn ở giữa mới cuộn. */
  const quickBtn = h('button', { type: 'button', class: 'btn btn--primary btn--block', id: 'btn-quick' }, [
    icon('play', 20), h('span', { text: 'Chơi nhanh' }),
  ]);
  const summaryLine = h('p', { class: 'menu-dock__summary', id: 'menu-summary', 'aria-live': 'polite' });
  const menuDock = h('div', { class: 'menu-dock' }, [summaryLine, quickBtn]);
  quickBtn.addEventListener('click', () => emit('startGame'));
  guideBtn.addEventListener('click', () => emit('quickGuide'));

  const menuHeader = h('header', { class: 'header menu__head' }, [
    h('span', { class: 'header__spacer' }),
    themeIconBtn,
    settingsIconBtn,
  ]);
  const menu = h('div', { class: 'menu' }, [
      // Hai lối tắt này đặt TRÊN danh sách tuỳ chọn để luôn thấy mà không phải cuộn.
      h('div', { class: 'menu__shortcuts' }, [guideBtn, soundBtn]),
      h('header', { class: 'brand' }, [
        h('h1', { class: 'brand__name', text: APP_NAME }),
        h('p', { class: 'brand__sub', text: APP_SUBTITLE }),
      ]),
      // Thứ tự theo mức quan trọng: chế độ → độ khó (chỉ có ở chế độ với máy) → bàn → ai đi trước → thời gian.
      h('div', { class: 'menu__actions' }, [modeSeg.el]),
      diffField,
      sizeField,
      firstField,
      h('fieldset', { class: 'fieldset', id: 'field-time' }, [timeToggle.el, timePicker]),
  ]);
  const menuScreen = h('section', { class: 'screen screen--menu', id: 'screen-menu', 'aria-label': 'Màn hình chính' }, [
    menuHeader,
    menu,
    menuDock,
  ]);
  syncMenuVisibility(modeSeg.getValue());
  syncTimePicker(timeToggle.get());
  updateMenuSummary();

  /** Cập nhật dòng tóm tắt trên thanh "Chơi ngay" (để người chơi biết mình đang chọn gì). */
  function updateMenuSummary(vals = null) {
    const v = vals || {
      mode: modeSeg.getValue(),
      boardSize: sizeSeg.getValue(),
      difficulty: diffSeg.getValue(),
      timeLimitOn: timeToggle.get(),
      timeLimitSec: Number(timeSeg.getValue()),
    };
    const parts = [v.mode === 'pvp' ? '2 người' : `Máy · ${DIFFICULTY_LABELS[v.difficulty] || ''}`.trim()];
    parts.push(`bàn ${v.boardSize}×${v.boardSize}`);
    parts.push(v.timeLimitOn ? `${v.timeLimitSec} giây/lượt` : 'không giới hạn thời gian');
    summaryLine.textContent = parts.join(' · ');
  }


  themeIconBtn.addEventListener('click', () => emit('cycleTheme'));
  settingsIconBtn.addEventListener('click', () => emit('settings'));
  soundBtn.addEventListener('click', () => emit('toggleSound'));

  function iconMark() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('class', 'brand__mark icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const g = document.createElementNS(ns, 'g');
    g.innerHTML = '<rect x="6" y="6" width="52" height="52" rx="8"/><path d="M6 28h52M6 44h52M28 6v52M44 6v52"/>'; // eslint-disable-line
    // Chép style của <g> lên từng phần tử con (khi tách khỏi <g>, attribute của <g> mất).
    const kids = [...g.childNodes];
    for (const k of kids) {
      k.setAttribute('fill', 'none');
      k.setAttribute('stroke', 'currentColor');
      k.setAttribute('stroke-width', '3');
      k.setAttribute('stroke-linecap', 'round');
      k.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(k);
    }
    return svg;
  }

  /* ----------------------------------------------------------------- HUD */

  const hudAName = h('span', { class: 'hud__name', id: 'hud-a-name', text: 'Bạn' });
  const hudAScore = h('span', { class: 'hud__score', id: 'hud-a-score', text: '0' });
  const hudBName = h('span', { class: 'hud__name', id: 'hud-b-name', text: 'Máy' });
  const hudBScore = h('span', { class: 'hud__score', id: 'hud-b-score', text: '0' });
  const hudA = h('div', { class: 'hud__player hud__player--a', id: 'hud-a' }, [playerSymbol('A'), hudAName, hudAScore]);
  const hudB = h('div', { class: 'hud__player hud__player--b', id: 'hud-b' }, [hudBScore, hudBName, playerSymbol('B')]);
  const hudClockText = h('span', { id: 'hud-clock-text', text: '0:20' });
  const hudProgress = h('i', { id: 'hud-progress' });
  const clockEl = h('div', { class: 'hud__clock', id: 'hud-clock' }, [
    h('span', { class: 'hud__clock-time' }, [icon('timer', 16), hudClockText]),
    h('div', { class: 'hud__progress', 'aria-hidden': 'true' }, [hudProgress]),
  ]);
  const hud = h('div', { class: 'hud', role: 'group', 'aria-label': 'Điểm số' }, [hudA, clockEl, hudB]);
  const liveRegion = h('div', {
    class: 'visually-hidden',
    id: 'live-region',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });

  /* --------------------------------------------------------------- BOARD */

  // tabindex="0": bàn cờ PHẢI tới được bằng Tab để chơi toàn bộ ván bằng bàn phím
  // (docs/30-TUTORIAL.md §9 "Tab đi được qua các cạnh hợp lệ"; DESIGN §6.3 "Focus ring trên canvas").
  // Trước đây canvas không có tabindex → không thể vào bàn bằng Tab, chỉ click được.
  const canvas = h('canvas', {
    id: 'board',
    'aria-hidden': 'true',
    tabindex: '0',
    role: 'application',
    'aria-label': 'Bàn cờ. Dùng phím mũi tên để chọn cạnh, Enter hoặc Space để tô.',
  });
  // Lưới ẩn cho trình đọc màn hình: mỗi cạnh là 1 NÚT THẬT 44×44 (vùng chạm chuẩn) nhưng bị clip
  // trong 1px — người dùng chuột/chạm dùng canvas, trình đọc màn hình/bàn phím vẫn tab tới được.
  const srGrid = h('div', { class: 'sr-grid', id: 'sr-grid', role: 'grid', 'aria-label': 'Bàn cờ: các cạnh chưa tô' });
  const comboBadge = h('div', { class: 'combo-badge', id: 'combo-badge', role: 'status', 'aria-live': 'polite' });
  const boardWrap = h('div', { class: 'board-wrap', id: 'board-wrap' }, [canvas, srGrid, comboBadge]);

  const tutSkipBtn = h('button', { type: 'button', class: 'btn btn--ghost', id: 'btn-tut-skip', text: 'Bỏ qua' });
  const tutFinishBtn = h('button', { type: 'button', class: 'btn btn--primary btn--block', id: 'btn-tut-finish', hidden: true, text: 'Xong' });
  const resultNewBtn = h('button', { type: 'button', class: 'btn btn--primary', id: 'btn-result-new', text: 'Ván mới' });
  const resultMenuBtn = h('button', { type: 'button', class: 'btn btn--ghost', id: 'btn-result-menu', text: 'Về menu' });
  const guideStartBtn = h('button', { type: 'button', class: 'btn btn--primary btn--block', id: 'btn-guide-start', text: QUICK_GUIDE.cta });
  const guideSkipBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--block', id: 'btn-guide-skip', text: QUICK_GUIDE.skip });
  const tutStepEl = h('span', { class: 'tut-bar__step', id: 'tut-step', text: TUTORIAL_STEPS.steps[0].title });
  const tutTextEl = h('p', { class: 'tut-bar__text', id: 'tut-text', text: TUTORIAL_STEPS.steps[0].instruction });
  const tutHintEl = h('p', { class: 'tut-bar__hint', id: 'tut-hint', text: TUTORIAL_STEPS.steps[0].hint });
  const tutBar = h('div', { class: 'tut-bar', id: 'tut-bar', hidden: true }, [
    h('div', { class: 'tut-bar__top' }, [
      tutStepEl,
      h('span', { class: 'tut-bar__spacer' }),
      tutSkipBtn,
    ]),
    tutTextEl,
    tutHintEl,
    tutFinishBtn,
  ]);

  const btnNew = h('button', { type: 'button', class: 'btn btn--ghost', id: 'btn-new' }, [
    icon('refresh', 20), h('span', { class: 'btn__label', text: 'Ván mới' }),
  ]);
  const btnHint = h('button', { type: 'button', class: 'btn btn--ghost', id: 'btn-hint' }, [
    icon('bulb', 20), h('span', { class: 'btn__label', text: 'Gợi ý' }),
  ]);
  const btnHelp = h('button', { type: 'button', class: 'btn btn--ghost btn--icon-label', id: 'btn-help', 'aria-label': 'Xem luật chơi' }, [
    icon('help', 20), h('span', { class: 'btn__label', text: 'Luật' }),
  ]);
  const actionBar = h('div', { class: 'action-bar', id: 'action-bar' }, [btnNew, btnHint, btnHelp]);

  const backBtn = h('button', { type: 'button', class: 'btn btn--icon', id: 'btn-back', 'aria-label': 'Về menu', title: 'Về menu' }, [icon('arrowLeft', 24)]);
  const guideCloseBtn = h('button', { type: 'button', class: 'btn btn--icon', id: 'btn-guide-close', 'aria-label': 'Đóng hướng dẫn' }, [icon('close', 24)]);
  const playHeader = h('header', { class: 'header' }, [
    backBtn,
    h('div', {}, [
      h('h1', { class: 'header__title', text: APP_NAME }),
      h('span', { class: 'header__sub', id: 'header-sub', text: APP_SUBTITLE }),
    ]),
    h('span', { class: 'header__spacer' }),
  ]);

  const playScreen = h('section', { class: 'screen screen--play', id: 'screen-play', 'aria-label': 'Bàn chơi', hidden: true }, [
    playHeader,
    hud,
    tutBar,
    boardWrap,
    actionBar,
  ]);

  // NÚT HÀNH ĐỘNG GẮN ĐÁY (sticky): ở màn cao (390×844+) và desktop, bàn cờ co lại còn một nửa
  // khung nên CTA ("Chơi thử Tutorial" / "Bỏ qua") nằm ngoài màn hình, phải cuộn mới thấy —
  // người mới KHÔNG thấy nút để bắt đầu (ảnh qc/shots-final/r01-menu-light-390.png).
  // Gom 2 nút vào 1 khối dính đáy của màn Hướng dẫn + 2 nút của màn Kết quả.
  const guideActions = h('div', { class: 'guide__actions', id: 'guide-actions' }, [guideStartBtn, guideSkipBtn]);
  const resultActions = h('div', { class: 'result__actions result__actions--sticky' }, [resultNewBtn, resultMenuBtn]);

  // Tutorial bước 5: hàng tùy chọn thật hiện ngay dưới bàn (docs/30-TUTORIAL.md §2 bước 5: người
  // chơi phải bấm được control thật).
  // BUG NGHIÊM TRỌNG đã sửa (14/11): trước đây khối này nhận THẲNG `sizeField`, `diffField`,
  // `timeToggle.el` → appendChild KÉO 3 node đó RA KHỎI MENU, nên menu vĩnh viễn mất mục
  // "Kích thước bàn" và "Độ khó". Nay dựng bằng SEGMENTED ĐỘC LẬP (bản sao), không đụng node menu.
  const tutOptions = h('div', { class: 'tut-options', id: 'tut-options' });
  let tutOptionsFilled = false;
  function fillTutOptions() {
    if (tutOptionsFilled) return;
    tutOptionsFilled = true;
    tutOptions.appendChild(h('p', { class: 'tut-options__lead', text: TUTORIAL_STEPS.steps[4].hint }));
    const sizeCloneSeg = segmented({
      name: 'Kích thước bàn (bài học)',
      options: BOARD_SIZES,
      labels: Object.fromEntries(BOARD_SIZES.map((n) => [n, `${n}×${n}`])),
      value: sizeSeg.getValue(),
      extraClass: 'segmented--sizes segmented--clone',
      wrap: true,
      onChange: (v) => { sizeSeg.setValue(v); emit('change', { boardSize: v }); },
    });
    const diffCloneSeg = segmented({
      name: 'Độ khó (bài học)',
      options: DIFFICULTIES,
      labels: DIFFICULTY_LABELS,
      value: diffSeg.getValue(),
      onChange: (v) => { diffSeg.setValue(v); emit('change', { difficulty: v }); },
    });
    tutOptions.appendChild(h('fieldset', { class: 'fieldset', style: 'margin-top:0' }, [
      h('legend', { class: 'fieldset__legend', text: 'Kích thước bàn' }),
      sizeCloneSeg.el,
    ]));
    tutOptions.appendChild(h('fieldset', { class: 'fieldset' }, [
      h('legend', { class: 'fieldset__legend', text: 'Độ khó' }),
      diffCloneSeg.el,
    ]));
    tutOptions.appendChild(h('fieldset', { class: 'fieldset' }, [
      switchRow({
        label: 'Thời gian mỗi lượt',
        sub: 'Hết giờ thì mất lượt',
        checked: timeToggle.get(),
        onChange: (v) => { timeToggle.set(v); emit('change', { timeLimitOn: v }); },
      }).el,
    ]));
    // Chạm vào control thật của bước 5 → báo "đã xem tùy chọn" (optionsExplored).
    tutOptions.addEventListener('pointerup', () => emit('optionsTouched'));
  }
  playScreen.insertBefore(tutOptions, actionBar);
  tutOptions.hidden = true; // chỉ hiện ở bước 5 (main.js gọi setOptionsExpanded)

  /** Đưa hàng tùy chọn (tutorial bước 5) vào vùng nhìn thấy. */
  function revealOptions() {
    if (!tutOptions.hidden) {
      try { tutOptions.scrollIntoView({ block: 'center' }); } catch { /* bỏ qua */ }
    }
  }

  /** Ẩn/hiện khối tùy chọn của bước 5 (chỉ hiện khi tutorial đang ở bước 5). */
  function setOptionsExpanded(flag) {
    if (flag) fillTutOptions();   // dựng bản sao control (không đụng node của menu)
    tutOptions.hidden = !flag;
  }

  // Chạm vào bất kỳ control thật nào trong khối tùy chọn → báo "đã xem tùy chọn" (event optionsExplored).
  // Dùng `pointerup` BẮT SỰ KIỆN Ở PHA CAPTURE: `.segmented__seg` có `touch-action: manipulation`
  // nên trình duyệt CHỈ bắn `pointerup` (không bắn `click` hợp lệ) — lắng nghe `click` ở đây là hụt.
  const markOptionsTouched = () => emit('optionsTouched');
  tutOptions.addEventListener('pointerup', markOptionsTouched, true);
  tutOptions.addEventListener('click', markOptionsTouched, true);
  tutOptions.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') markOptionsTouched();
  }, true);

  /* ------------------------------------------------------------- GUIDE */

  const guideCards = h('div', { class: 'guide__cards' });
  const guideScreen = h('section', { class: 'screen screen--guide', id: 'screen-guide', 'aria-label': 'Hướng dẫn nhanh', hidden: true }, [
    h('header', { class: 'header' }, [
      h('h1', { class: 'header__title', text: QUICK_GUIDE.title }),
      h('span', { class: 'header__spacer' }),
      guideCloseBtn,
    ]),
    h('div', { class: 'menu' }, [
      h('p', { class: 'brand__sub', text: QUICK_GUIDE.subtitle }),
      h('div', { class: 'guide__scroll' }, [guideCards]),
    ]),
    guideActions,
  ]);

  /* ------------------------------------------------------------- RESULT */

  const resultTitle = h('h1', { class: 'result__title', id: 'result-title', text: '' });
  const resultNumA = h('span', { class: 'result__num', id: 'result-a', text: '0' });
  const resultNumB = h('span', { class: 'result__num', id: 'result-b', text: '0' });
  const resultNameA = h('span', { class: 'result__name', id: 'result-name-a', text: 'Bạn' });
  const resultNameB = h('span', { class: 'result__name', id: 'result-name-b', text: 'Máy' });
  const resultSummary = h('p', { class: 'result__summary', id: 'result-summary', text: '' });
  const resultScreen = h('section', { class: 'screen screen--result', id: 'screen-result', 'aria-label': 'Kết quả ván', hidden: true }, [
    h('div', { class: 'result' }, [
      resultTitle,
      h('div', { class: 'result__scores' }, [
        h('div', { class: 'result__col result__col--a' }, [playerSymbol('A', 26), resultNameA, resultNumA]),
        h('span', { class: 'result__sep', 'aria-hidden': 'true' }),
        h('div', { class: 'result__col result__col--b' }, [playerSymbol('B', 26), resultNameB, resultNumB]),
      ]),
      resultSummary,
    ]),
    resultActions,
  ]);


  /* -------------------------------------------------------------- MODAL */

  const scrim = h('div', { class: 'modal__scrim', id: 'modal-scrim' });
  const panel = h('div', {
    class: 'modal__panel',
    id: 'modal-panel',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'modal-title',
    tabindex: '-1',
  }, [h('div', { class: 'modal__grip', 'aria-hidden': 'true' })]);
  const modalRoot = h('div', { class: 'modal', id: 'modal', hidden: true }, [scrim, panel]);

  /**
   * Focus trap THẬT cho modal (DESIGN §5.4): chặn cả trường hợp focus đang ở NGOÀI panel
   * (ví dụ phần tử đang focus bị ẩn) — không chỉ xoay vòng khi ở phần tử đầu/cuối.
   * Trước đây focus có thể lọt ra menu phía sau (đo được bằng CDP: Tab 9 lần → rời panel).
   */
  function trapFocus(e) {
    if (e.key !== 'Tab' || !modalStack.length || modalRoot.hidden) return;
    const focusables = [...panel.querySelectorAll(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )].filter((el) => !el.closest('[hidden]') && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    if (!focusables.length) {
      e.preventDefault();
      try { panel.focus(); } catch { /* bỏ qua */ }
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    const inside = active && panel.contains(active);
    if (!inside) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalStack.length) {
      e.preventDefault();
      const top = modalStack[modalStack.length - 1];
      if (top.dismissible === false) return;
      closeModal();
    }
    trapFocus(e);
  });

  scrim.addEventListener('click', () => {
    const top = modalStack[modalStack.length - 1];
    if (top && top.dismissible !== false) closeModal();
  });

  /**
   * Mở modal.
   * @param {{title:string, body:HTMLElement|string, actions?:Array, dismissible?:boolean, onClose?:Function}} opts
   */
  function openModal(opts) {
    lastFocused = document.activeElement;
    panel.innerHTML = '';
    panel.appendChild(h('div', { class: 'modal__grip', 'aria-hidden': 'true' }));
    panel.appendChild(h('div', { class: 'modal__head' }, [
      h('h2', { class: 'modal__title', id: 'modal-title', text: opts.title || '' }),
      opts.dismissible === false
        ? null
        : h('button', { type: 'button', class: 'btn btn--icon', id: 'modal-close', 'aria-label': 'Đóng' }, [icon('close', 24)]),
    ]));
    const body = h('div', { class: 'modal__body' });
    if (typeof opts.body === 'string') body.appendChild(h('p', { text: opts.body }));
    else if (opts.body) body.appendChild(opts.body);
    panel.appendChild(body);

    const actions = h('div', { class: `modal__actions ${opts.actionsRow ? 'modal__actions--row' : ''}`.trim() });
    for (const a of opts.actions || []) {
      // `a.danger` = nút hành động PHÁ HUỶ (vd "Về menu" khi đang chơi): nền đỏ nhạt + chữ đỏ đậm
      // để người dùng thấy rõ đây là nút bấm được. Trước đây dùng `btn--danger` chỉ có chữ đỏ trên
      // nền trong suốt → trông như dòng chữ mờ, không ai biết bấm được (lỗi báo 14/11).
      const variant = a.danger ? 'btn--danger-solid' : (a.variant || 'btn--secondary');
      const btn = h('button', {
        type: 'button',
        class: `btn ${variant} btn--block`,
        id: a.id || undefined,
        text: a.label,
      });
      btn.addEventListener('click', () => {
        if (typeof a.onClick === 'function') a.onClick();
        if (a.close !== false) closeModal();
      });
      actions.appendChild(btn);
    }
    if (actions.childNodes.length) panel.appendChild(actions);
    const closeBtn = panel.querySelector('#modal-close');
    if (closeBtn) closeBtn.addEventListener('click', () => closeModal());

    modalRoot.hidden = false;
    modalStack.push({ dismissible: opts.dismissible, onClose: opts.onClose });
    const autofocus = opts.autofocus ? panel.querySelector(`#${opts.autofocus}`) : null;
    (autofocus || panel).focus();
    document.body.style.overflow = 'hidden';
    return panel;
  }

  function closeModal() {
    if (!modalStack.length) return;
    const top = modalStack.pop();
    if (!modalStack.length) {
      modalRoot.hidden = true;
      document.body.style.overflow = '';
    }
    if (typeof top.onClose === 'function') top.onClose();
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus(); } catch { /* bỏ qua */ }
    }
  }

  function isModalOpen() {
    return modalStack.length > 0;
  }

  /** Danh sách thuật ngữ (§6) dạng accordion. */
  function glossaryAccordion() {
    const wrap = h('div', { class: 'accordion', id: 'glossary' });
    wrap.appendChild(h('p', { class: 'fieldset__hint', text: GLOSSARY.metaphor }));
    for (const entry of GLOSSARY.entries) {
      const panelId = `acc-${GLOSSARY.entries.indexOf(entry)}`;
      const trigger = h('button', {
        type: 'button',
        class: 'accordion__trigger',
        'aria-expanded': 'false',
        'aria-controls': panelId,
      }, [h('span', { text: entry.term }), icon('chevronDown', 18, 'chev')]);
      const body = h('div', { class: 'accordion__panel', id: panelId, hidden: true }, [
        h('p', { text: entry.plain }),
        h('p', {}, [h('strong', { text: 'Ẩn dụ: ' }), entry.plain ? entry.metaphor : '']),
      ]);
      trigger.addEventListener('click', () => {
        const open = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', String(!open));
        body.hidden = open;
      });
      wrap.appendChild(h('div', { class: 'accordion__item' }, [trigger, body]));
    }
    wrap.appendChild(h('p', { class: 'fieldset__hint', text: GLOSSARY.metaphorCaveat }));
    return wrap;
  }

  /** Modal luật chơi ngắn (§5.2). */
  function showRules() {
    const list = h('ol', { class: 'rules-list' });
    for (const line of RULES_SHORT) list.appendChild(h('li', { text: line }));
    const glossWrap = h('div', { hidden: true });
    glossWrap.appendChild(glossaryAccordion());
    openModal({
      title: RULES_MODAL.title,
      body: h('div', {}, [list, glossWrap]),
      actionsRow: true,
      actions: [
        { label: RULES_MODAL.openGlossary, variant: 'btn--ghost', close: false, onClick: () => { glossWrap.hidden = !glossWrap.hidden; } },
        { label: RULES_MODAL.close, variant: 'btn--secondary' },
      ],
      autofocus: null,
    });
  }

  /** Modal cài đặt. */
  function showSettings() {
    const s = deps.getSettings ? deps.getSettings() : settings;
    let st = { ...s };
    const soundRow = switchRow({
      id: 'set-sound',
      label: 'Âm thanh',
      checked: st.sound !== false,
      onChange: (v) => { st.sound = v; emit('change', { sound: v }); },
    });
    const sfxRow = switchRow({
      id: 'set-sfx',
      label: 'Hiệu ứng âm thanh',
      checked: st.sfx !== false,
      onChange: (v) => { st.sfx = v; emit('change', { sfx: v }); },
    });
    const bgmRow = switchRow({
      id: 'set-bgm',
      label: 'Nhạc nền',
      checked: st.bgm !== false,
      onChange: (v) => { st.bgm = v; emit('change', { bgm: v }); },
    });
    const volumeRow = sliderRow({
      id: 'set-volume',
      label: 'Âm lượng',
      value: typeof st.volume === 'number' ? st.volume : 0.6,
      onChange: (v) => { st.volume = v; emit('change', { volume: v }); },
    });
    const hapticRow = switchRow({
      id: 'set-haptic',
      label: 'Rung (máy hỗ trợ)',
      checked: st.haptic !== false,
      onChange: (v) => { st.haptic = v; emit('change', { haptic: v }); },
    });
    const cbRow = switchRow({
      id: 'set-colorblind',
      label: 'Phân biệt rõ cho người mù màu',
      sub: 'Ô của hai người dùng hoa tiết khác nhau',
      checked: st.colorblindSafe !== false,
      onChange: (v) => { st.colorblindSafe = v; emit('change', { colorblindSafe: v }); },
    });
    const themeModalSeg = segmented({
      name: 'Giao diện',
      options: THEMES,
      labels: { system: 'Hệ thống', light: 'Sáng', dark: 'Tối' },
      value: st.theme || 'system',
      onChange: (v) => { st.theme = v; emit('change', { theme: v }); syncThemeButton(v); },
    });
    const body = h('div', {}, [
      h('fieldset', { class: 'fieldset', style: 'margin-top:0' }, [
        h('legend', { class: 'fieldset__legend', text: 'Giao diện' }),
        themeModalSeg.el,
      ]),
      h('fieldset', { class: 'fieldset' }, [
        h('legend', { class: 'fieldset__legend', text: 'Âm thanh' }),
        soundRow.el, sfxRow.el, bgmRow.el, volumeRow.el,
      ]),
      h('fieldset', { class: 'fieldset' }, [
        h('legend', { class: 'fieldset__legend', text: 'Trợ năng' }),
        hapticRow.el, cbRow.el,
      ]),
      h('p', { class: 'fieldset__hint', text: `${APP_NAME} · ${APP_SUBTITLE} — chơi offline, không thu thập dữ liệu.` }),
    ]);
    openModal({
      title: 'Cài đặt',
      body,
      actions: [{ label: 'Xong', variant: 'btn--primary' }],
    });
  }

  /** Hộp xác nhận. */
  function confirmModal({ title, message, confirmLabel, cancelLabel, onConfirm, danger = false }) {
    openModal({
      title,
      body: message,
      autofocus: 'confirm-ok',
      actions: [
        { label: cancelLabel || 'Huỷ', variant: 'btn--ghost' },
        { id: 'confirm-ok', label: confirmLabel || 'Đồng ý', danger, variant: danger ? 'btn--danger-solid' : 'btn--primary', onClick: onConfirm },
      ],
    });
  }

  /* -------------------------------------------------------------- TOAST */

  const toastEl = h('div', { class: 'toast', id: 'toast', role: 'status', 'aria-live': 'polite' });

  /**
   * @param {string} message
   * @param {{alert?:boolean, ms?:number}} opts
   */
  function showToast(message, opts = {}) {
    globalThis.clearTimeout(toastTimer);
    globalThis.clearTimeout(toastHideTimer);
    toastEl.innerHTML = '';
    toastEl.setAttribute('role', opts.alert ? 'alert' : 'status');
    toastEl.setAttribute('aria-live', opts.alert ? 'assertive' : 'polite');
    toastEl.appendChild(icon(opts.alert ? 'timer' : 'check', 18));
    toastEl.appendChild(h('span', { text: message }));
    toastEl.classList.add('is-visible');
    toastTimer = globalThis.setTimeout(() => {
      toastEl.classList.remove('is-visible');
      toastHideTimer = globalThis.setTimeout(() => { toastEl.innerHTML = ''; }, 200);
    }, opts.ms || 2400);
  }

  /** Xoá toast ngay (dùng khi rời màn chơi để thông báo cũ không dính sang màn kết quả). */
  function clearToast() {
    globalThis.clearTimeout(toastTimer);
    globalThis.clearTimeout(toastHideTimer);
    toastEl.classList.remove('is-visible');
    toastEl.innerHTML = '';
  }

  /* ---------------------------------------------------------- SOUND CHIP */

  // Chip âm thanh đã có sẵn trong index.html (nằm ngay trên khung quảng cáo).
  const soundChip = document.getElementById('sound-chip')
    || h('button', { type: 'button', class: 'sound-chip', id: 'sound-chip', hidden: true }, [
      icon('volumeOn', 18), h('span', { text: 'Chạm để bật âm thanh' }),
    ]);

  /* ----------------------------------------------------------------- RPS */

  const rpsTitle = h('h2', { class: 'modal__title', id: 'rps-title', text: 'Oẳn tù tì' });
  const rpsMeHand = h('div', { class: 'rps__hand', id: 'rps-me' }, [rpsIcon('rock', 44)]);
  const rpsComHand = h('div', { class: 'rps__hand', id: 'rps-com' }, [rpsIcon('rock', 44)]);
  const rpsStatus = h('p', { class: 'result__summary', id: 'rps-status', text: 'Chọn búa, bao hoặc kéo để quyết định ai đi trước.' });
  const rpsChoices = h('div', { class: 'rps__choices', id: 'rps-choices' });
  for (const choice of ['rock', 'paper', 'scissors']) {
    const b = h('button', {
      type: 'button',
      class: 'rps__choice',
      'aria-label': RPS_LABELS[choice],
      dataset: { choice },
    }, [rpsIcon(choice, 40), h('span', { text: RPS_LABELS[choice] })]);
    b.addEventListener('click', () => {
      if (rpsBusy) return;
      emit('rpsPick', choice);
    });
    rpsChoices.appendChild(b);
  }
  const rpsBody = h('div', { class: 'rps' }, [
    h('div', { class: 'rps__stage' }, [rpsMeHand, h('span', { class: 'rps__vs', text: 'vs' }), rpsComHand]),
    rpsStatus,
    rpsChoices,
  ]);

  /** Mở modal oẳn tù tì (3 pha 480ms; reduced-motion thì hiện ngay kết quả). */
  function showRps() {
    rpsBusy = false;
    panel.innerHTML = '';
    rpsStatus.textContent = 'Chọn búa, bao hoặc kéo để quyết định ai đi trước.';
    rpsChoices.hidden = false;
    rpsMeHand.className = 'rps__hand';
    rpsComHand.className = 'rps__hand';
    openModal({ title: rpsTitle.textContent, body: rpsBody, dismissible: false, actions: [] });
    // Đánh dấu lớp modal vừa mở để `closeRps()` chỉ đóng ĐÚNG hộp oẳn tù tì.
    if (modalStack.length) modalStack[modalStack.length - 1].kind = 'rps';
  }

  /**
   * Hiệu ứng 3 pha lắc rồi hiện kết quả.
   * @param {string} playerPick
   * @param {string} comPick
   * @param {'player'|'com'} winner
   */
  function playRpsAnimation(playerPick, comPick, winner, reducedMotion = false) {
    rpsBusy = true;
    rpsChoices.hidden = true;
    const finish = () => {
      rpsMeHand.innerHTML = '';
      rpsMeHand.appendChild(rpsIcon(playerPick, 44));
      rpsComHand.innerHTML = '';
      rpsComHand.appendChild(rpsIcon(comPick, 44));
      rpsMeHand.classList.remove('is-shaking');
      rpsComHand.classList.remove('is-shaking');
      rpsStatus.textContent = winner === 'player'
        ? `Bạn ra ${RPS_LABELS[playerPick]}, máy ra ${RPS_LABELS[comPick]} — bạn thắng.`
        : `Bạn ra ${RPS_LABELS[playerPick]}, máy ra ${RPS_LABELS[comPick]} — máy thắng.`;
      rpsBusy = false;
      emit('rpsDone', winner);
    };
    if (reducedMotion) {
      finish();
      return;
    }
    rpsMeHand.classList.add('is-shaking');
    rpsComHand.classList.add('is-shaking');
    // 3 pha 160ms mỗi pha (kéo → búa → bao) = 480ms.
    const seq = ['scissors', 'rock', 'paper'];
    seq.forEach((c, i) => {
      globalThis.setTimeout(() => {
        rpsComHand.innerHTML = '';
        rpsComHand.appendChild(rpsIcon(c, 44));
        rpsStatus.textContent = 'Kéo… búa… bao…';
      }, 160 * (i + 1));
    });
    globalThis.setTimeout(finish, 520);
  }

  function closeRps() {
    // Đóng đúng lớp modal của hộp oẳn tù tì (nếu đã đóng rồi thì thôi) — tránh trường hợp
    // hai lượt gọi liên tiếp làm đóng lây modal khác.
    const idx = modalStack.findIndex((entry) => entry && entry.kind === 'rps');
    if (idx >= 0) closeModal();
  }

  /* --------------------------------------------------------- HỮu DỤNG */

  function syncThemeButton(theme) {
    const label = { system: 'Theo hệ thống', light: 'Sáng', dark: 'Tối' }[theme] || 'Theo hệ thống';
    const ic = { system: 'monitor', light: 'sun', dark: 'moon' }[theme] || 'monitor';
    themeIconBtn.innerHTML = '';
    themeIconBtn.appendChild(icon(ic, 24));
    themeIconBtn.setAttribute('aria-label', `Giao diện: ${label}. Bấm để đổi.`);
    themeIconBtn.setAttribute('title', `Giao diện: ${label}`);
  }

  function syncSoundButton(on_) {
    soundBtn.innerHTML = '';
    soundBtn.appendChild(icon(on_ ? 'volumeOn' : 'volumeOff', 20));
    soundBtn.appendChild(h('span', { text: on_ ? 'Âm thanh: Bật' : 'Âm thanh: Tắt' }));
    soundBtn.setAttribute('aria-pressed', String(!!on_));
  }

  /** Cập nhật toàn bộ menu theo cài đặt (không phát sự kiện). */
  function syncSettings(next) {
    settings = { ...settings, ...next };
    modeSeg.setValue(settings.mode);
    sizeSeg.setValue(settings.boardSize);
    diffSeg.setValue(settings.difficulty);
    firstSeg.setValue(settings.first);
    setFirstLabels(settings.mode);
    timeToggle.set(settings.timeLimitOn);
    timeSeg.setValue(settings.timeLimitSec);
    syncTimePicker(settings.timeLimitOn);
    updateMenuSummary(settings);
    syncThemeButton(settings.theme);
    syncSoundButton(settings.sound);
    syncMenuVisibility(settings.mode);
  }

  /** Nhãn "Ai đi trước" đổi theo chế độ (Bạn/Máy ↔ Người 1/Người 2). */
  function setFirstLabels(mode) {
    const labels = mode === 'pvp' ? FIRST_LABELS_PVP : FIRST_LABELS_AI;
    firstSeg.el.querySelectorAll('.segmented__seg').forEach((seg) => {
      const v = seg.dataset.value;
      seg.textContent = labels[v];
      seg.setAttribute('aria-label', labels[v]);
    });
    firstSeg.el.setAttribute('aria-label', mode === 'pvp' ? 'Người nào đi trước' : 'Ai đi trước');
  }

  /* -------------------------------------------------------- MÀN HÌNH */

  const screens = { menu: menuScreen, play: playScreen, guide: guideScreen, result: resultScreen };

  function showScreen(name) {
    for (const [key, el] of Object.entries(screens)) {
      if (key === name) {
        el.hidden = false;
        el.classList.remove('is-leaving');
      } else {
        el.hidden = true;
      }
    }
  }

  /** Cập nhật HUD. */
  function updateHud({ scoreA, scoreB, nameA, nameB, turn, timeLeft, timeTotal, timeLimitOn, bump }) {
    const sa = hudAScore;
    const sb = hudBScore;
    if (sa.textContent !== String(scoreA)) {
      sa.textContent = String(scoreA);
      if (bump === 'A') {
        sa.classList.remove('is-bump');
        void sa.offsetWidth;
        sa.classList.add('is-bump');
      }
    }
    if (sb.textContent !== String(scoreB)) {
      sb.textContent = String(scoreB);
      if (bump === 'B') {
        sb.classList.remove('is-bump');
        void sb.offsetWidth;
        sb.classList.add('is-bump');
      }
    }
    hudAName.textContent = nameA;
    hudBName.textContent = nameB;
    hudA.classList.toggle('is-turn', turn === 'A');
    hudB.classList.toggle('is-turn', turn === 'B');
    clockEl.hidden = !timeLimitOn;
    if (timeLimitOn) {
      const secs = Math.max(0, Math.ceil(timeLeft));
      hudClockText.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      const ratio = timeTotal > 0 ? Math.max(0, Math.min(1, timeLeft / timeTotal)) : 0;
      hudProgress.style.transform = `scaleX(${ratio})`;
      clockEl.classList.toggle('is-low', timeLeft <= 5);
    }
  }

  /** Cập nhật thanh hướng dẫn tutorial. */
  function updateTutorialBar({ visible, step, text, hint, hintState, showFinish, finishLabel }) {
    tutBar.hidden = !visible;
    // Nút "Xong" và "Bỏ qua" chỉ thuộc thanh hướng dẫn: khi thanh ẩn phải ẩn theo
    // (trước đây chúng dính lại và nằm đè lên thanh hành động sau khi học xong tutorial).
    tutFinishBtn.hidden = !(visible && showFinish);
    tutSkipBtn.hidden = !visible;
    // Khối tùy chọn của bước 5 chỉ tồn tại khi đang ở bước 5 (dựng bản sao control khi cần).
    const showOpts = !!(visible && Number(showFinish));
    if (showOpts) fillTutOptions();
    tutOptions.hidden = !showOpts;
    if (!visible) return;
    if (step) tutStepEl.textContent = step;
    if (text !== undefined) tutTextEl.textContent = text;
    if (hint !== undefined) {
      tutHintEl.textContent = hint;
      tutHintEl.className = `tut-bar__hint${hintState ? ` is-${hintState}` : ''}`;
    }
    tutFinishBtn.hidden = !showFinish;
    if (finishLabel) tutFinishBtn.textContent = finishLabel;
  }

  function showComboBadge(text) {
    globalThis.clearTimeout(comboHideTimer);
    comboBadge.textContent = text;
    comboBadge.classList.remove('is-visible');
    void comboBadge.offsetWidth;
    comboBadge.classList.add('is-visible');
    comboHideTimer = globalThis.setTimeout(() => comboBadge.classList.remove('is-visible'), 1400);
  }

  function updateHintButton(left, total) {
    const label = btnHint.querySelector('.btn__label');
    const exhausted = left <= 0;
    btnHint.disabled = exhausted;
    if (label) label.textContent = exhausted ? HINT_LABELS.exhausted : HINT_LABELS.hint;
    btnHint.setAttribute('aria-label', exhausted ? HINT_LABELS.exhausted : `${HINT_LABELS.hint} (còn ${left}/${total})`);
  }

  function announce(text) {
    liveRegion.textContent = '';
    globalThis.setTimeout(() => { liveRegion.textContent = text; }, 30);
  }

  function showSoundChip(show) {
    soundChip.hidden = !show;
  }

  /* ------------------------------------------------ MÀN HƯỚNG DẪN NHANH */

  function renderGuideCards(drawIllustration) {
    guideCards.innerHTML = '';
    for (const card of QUICK_GUIDE.cards) {
      const cvs = document.createElement('canvas');
      cvs.width = 176;
      cvs.height = 176;
      cvs.setAttribute('aria-hidden', 'true');
      const item = h('div', { class: 'guide-card' }, [
        cvs,
        h('div', {}, [
          h('h2', { class: 'guide-card__title', text: card.title }),
          h('p', { class: 'guide-card__text', text: card.text }),
        ]),
      ]);
      guideCards.appendChild(item);
      if (typeof drawIllustration === 'function') drawIllustration(cvs, card);
    }
  }

  /* -------------------------------------------------- KẾT QUẢ VÁN ĐẤU */

  let resultCountTimer = 0;
  function showResult({ winnerText, scoreA, scoreB, nameA, nameB, summary, reducedMotion }) {
    resultTitle.textContent = winnerText;
    resultNameA.textContent = nameA;
    resultNameB.textContent = nameB;
    resultSummary.textContent = summary;
    globalThis.clearInterval(resultCountTimer);
    if (reducedMotion) {
      resultNumA.textContent = String(scoreA);
      resultNumB.textContent = String(scoreB);
    } else {
      // Đếm từng bước từ 0 → điểm thật trong 480ms.
      const start = performance.now();
      const dur = 480;
      resultNumA.textContent = '0';
      resultNumB.textContent = '0';
      resultCountTimer = globalThis.setInterval(() => {
        const t = Math.min(1, (performance.now() - start) / dur);
        resultNumA.textContent = String(Math.round(scoreA * t));
        resultNumB.textContent = String(Math.round(scoreB * t));
        if (t >= 1) globalThis.clearInterval(resultCountTimer);
      }, 40);
    }
    showScreen('result');
    try { resultNewBtn.focus(); } catch { /* bỏ qua */ }
  }

  /* ------------------------------------------------------------ WIRING */

  function wire() {
    btnNew.addEventListener('click', () => emit('newGame'));
    btnHint.addEventListener('click', () => emit('hint'));
    btnHelp.addEventListener('click', () => emit('rules'));
    backBtn.addEventListener('click', () => emit('back'));
    tutSkipBtn.addEventListener('click', () => emit('tutorialSkip'));
    tutFinishBtn.addEventListener('click', () => emit('tutorialFinish'));
    resultNewBtn.addEventListener('click', () => emit('resultNew'));
    resultMenuBtn.addEventListener('click', () => emit('resultMenu'));
    guideStartBtn.addEventListener('click', () => emit('guideStart'));
    guideSkipBtn.addEventListener('click', () => emit('guideSkip'));
    guideCloseBtn.addEventListener('click', () => emit('guideClose'));
    if (!soundChip.dataset.wired) {
      soundChip.dataset.wired = '1';
      soundChip.addEventListener('click', () => emit('unlockAudio'));
    }
  }
  wire();

  /** Gắn toàn bộ DOM vào #app. */
  function mount(root) {
    root.appendChild(menuScreen);
    root.appendChild(playScreen);
    root.appendChild(guideScreen);
    root.appendChild(resultScreen);
    root.appendChild(liveRegion);
    adSlotEnsure();
    root.appendChild(toastEl);
    root.appendChild(modalRoot);
  }

  /** #ad-slot sống trong index.html để LUÔN giữ chỗ (không tạo/không di chuyển → CLS = 0). */
  function adSlotEnsure() {
    const existing = document.getElementById('ad-slot');
    if (existing) return existing;
    const created = h('div', { id: 'ad-slot', 'aria-hidden': 'true' });
    document.body.appendChild(created);
    return created;
  }

  return {
    mount,
    screens,
    showScreen,
    segmented,
    switchRow,
    openModal,
    closeModal,
    isModalOpen,
    showRules,
    showSettings,
    confirmModal,
    showToast,
    clearToast,
    showSoundChip,
    showRps,
    playRpsAnimation,
    closeRps,
    updateHud,
    updateTutorialBar,
    updateHintButton,
    showComboBadge,
    announce,
    showResult,
    renderGuideCards,
    syncSettings,
    setFirstLabels,
    syncThemeButton,
    syncSoundButton,
    setOptionsExpanded,
    revealOptions,
    setModeValue: (m) => { modeSeg.setValue(m); syncMenuVisibility(m); setFirstLabels(m); },
    setSizeDisabled: (flag) => sizeSeg.setDisabled(flag),
    getModeValue: () => modeSeg.getValue(),
    updateMenuSummary,
    elements: {
      menu: menuScreen,
      play: playScreen,
      guide: guideScreen,
      result: resultScreen,
      canvas,
      boardWrap,
      srGrid,
      hud,
      clock: clockEl,
      tutBar,
      comboBadge,
      toast: toastEl,
      modal: modalRoot,
      modalPanel: panel,
      toastEl,
    },
  };
}

export { h as el, icon as makeIcon };
