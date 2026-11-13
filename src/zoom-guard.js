/**
 * zoom-guard.js — phát hiện "khung nhìn nhìn thấy hẹp do người dùng PHÓNG to" và đặt
 * `<html data-zoom="narrow">` để CSS dùng bố cục hẹp (styles.css mục "KHUNG HẸP KHI TRANG BỊ PHÓNG TO").
 *
 * Vì sao cần: media query chỉ chạy trên bề rộng LAYOUT (`documentElement.clientWidth`), KHÔNG phản ánh
 * zoom của người dùng (200% → thấy ~195 CSS px nhưng vẫn báo 390px). Không có API thuần CSS nào phát
 * hiện zoom theo trang, nên dùng số đo runtime.
 *
 * Số đo dùng: `clientWidth / (visualViewport hợp lệ || innerWidth)`.
 *  - `visualViewport.scale` chỉ đáng toàn tín khi `visualViewport.width ≈ innerWidth` (người dùng KHÔNG
 *    pinch, chỉ zoom bằng Ctrl+scroll / UI ↔ CSS `zoom`); khi lệch là pinch → dùng `innerWidth`.
 *  - Ngưỡng: khung nhìn nhìn thấy < 340px → bố cục hẹp (tương ứng mốc `max-width: 359px` của DESIGN §4.2).
 *
 * Không tốn thời gian khi trang tĩnh: chỉ tính lại ở các sự kiện resize/visualViewport.resize (đã
 * throttle bằng rAF) và một lần sau khi boot.
 */
export const NARROW_VISIBLE_PX = 340;

function zoomOf() {
  try {
    const vv = globalThis.visualViewport;
    // Zoom bằng UI/Ctrl+scroll: visualViewport.scale là nghịch đảo của zoom (1/2 khi 200%).
    if (vv && vv.scale > 0) {
      const s = vv.scale;
      if (s < 0.999) return 1 / s;
      if (s > 1.001) return 1 / s;   // pinch-out: vv lớn hơn → cũng quy về "đang phóng"
    }
    // CSS `zoom` (và một số trình duyệt coi zoom như CSS zoom): trình duyệt KHÔNG báo trong
    // visualViewport.scale → đọc hệ số zoom của chính <html>.
    const de = document.documentElement;
    const cssZoom = Number(globalThis.getComputedStyle ? getComputedStyle(de).zoom : 1);
    if (Number.isFinite(cssZoom) && cssZoom > 0.999 && cssZoom !== 1) return cssZoom;
    const cssZoomBody = Number(globalThis.getComputedStyle ? getComputedStyle(document.body).zoom : 1);
    if (Number.isFinite(cssZoomBody) && cssZoomBody > 0.999 && cssZoomBody !== 1) return cssZoomBody;
    return 1;
  } catch {
    return 1;
  }
}

/** Bề rộng nhìn thấy (CSS px) = bề rộng layout / hệ số zoom. */
function visibleWidth() {
  try {
    const de = document.documentElement;
    const cw = de.clientWidth || 0;
    if (!cw) return 0;
    return cw / zoomOf();
  } catch {
    return 0;
  }
}

export function installZoomGuard() {
  const root = document.documentElement;
  let raf = 0;
  const apply = () => {
    raf = 0;
    const w = visibleWidth();
    const narrow = w > 0 && w < NARROW_VISIBLE_PX;
    const want = narrow ? 'narrow' : '';
    if (want) {
      if (root.getAttribute('data-zoom') !== want) root.setAttribute('data-zoom', want);
    } else if (root.hasAttribute('data-zoom')) {
      root.removeAttribute('data-zoom');
    }
    root.style.setProperty('--vw-visible', w ? `${Math.round(w)}px` : '');
  };
  const schedule = () => {
    if (raf) return;
    raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(apply) : setTimeout(apply, 0);
  };
  apply();
  // CSS `zoom` đổi giữa chừng KHÔNG luôn bắn `resize` → dò thêm vài nhịp đầu bằng `setTimeout` (KHÔNG
  // dùng requestAnimationFrame: yêu cầu "rAF khi bàn TĨNH = 0" được đo đúng bằng bộ đếm rAF, nhịp dò
  // dùng rAF sẽ làm nhiễu phép đo). Chỉ dò 8 lần × 500ms ở 4 giây đầu; sau đó chỉ nghe sự kiện.
  let ticks = 0;
  const poll = () => {
    ticks++;
    if (ticks > 8) return;
    apply();
    if (!document.hidden) setTimeout(poll, 500);
  };
  setTimeout(poll, 500);
  globalThis.addEventListener('resize', schedule, { passive: true });
  if (globalThis.visualViewport) globalThis.visualViewport.addEventListener('resize', schedule, { passive: true });
  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('orientationchange', schedule, { passive: true });
  }
  return { apply, visibleWidth };
}
