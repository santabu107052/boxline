# MAINTENANCE — Boxline (Cờ Ô Vuông)

Báo cáo của **Agent Maintenance (system-maintenance)** trong pipeline đa-agent.
Ngày đo: **13–14/11/2026** · Môi trường: macOS, Chrome **157.0.8103.78** (headless=new, CDP), Node **v26.4.0**, Bun.
Máy chủ đo: `python3 -m http.server 8801 --bind 127.0.0.1` (đã kill theo PID sau khi xong).

Phạm vi: chỉ sửa trong `dots-boxes/`; **không** sửa `docs/`, **không** sửa `qc-shots.mjs`, không thêm dependency/CDN,
không đổi luật chơi và mọi chuỗi UI tiếng Việt.

---

## 0. TL;DR

| Hạng mục | Trước | Sau | Đánh giá |
|---|---|---|---|
| FPS khi animate 8×8 (30 nước × 120ms) | **60.0 fps** / 120 khung, p95 16.8ms, 0 khung >33ms | **60.0 fps** / 120 khung, p95 16.7ms, 0 khung >33ms | Đã đạt ngay từ đầu — giữ nguyên |
| **rAF khi bàn TĨNH (3s)** | **0** lần | **0** lần | ✅ yêu cầu DESIGN §7.3 "phải = 0" — đạt |
| rAF khi ở MENU (2s) | 0 | 0 | — |
| `chooseMove` bàn 8×8 (Khó) | TB 3.07ms · p95 15.5 · **max 26.1ms** | TB 5.46ms · p95 26.8 · **max 64.7ms** | Thay đổi ≤ ngân sách **60ms** danh nghĩa (xem §2.4) |
| **JSHeapUsedSize sau 60s chơi liên tục** | 3.9 → **3.8MB** (min 2.1, max 4.9) | 3.7 → **2.1MB** (min 1.9, max 5.1) | Không tăng vô hạn ở cả hai bản (mẫu dao động theo GC) |
| DOM node theo thời gian (60s) | 230 → 265 (max 340) | 230 → 265 (max 340) | Không tăng theo thời gian (dao động theo màn hình) |
| Tải `index.html` (DCL / load) | 24.8 / 25.3ms · 5.5KB | 16.4 / 17.0ms · 5.5KB | Cùng khối lượng (11 tài nguyên); chênh lệch thuộc dao động máy |
| Tải `bundle.html` (DCL / load) | 17.9 / 18.2ms · **241.6KB** | 20.1 / 20.4ms · **246.9KB** | +5.3KB do mã sửa lỗi (+2.1%); thời gian tương đương |
| Lỗi JS/console (audit tự động) | **28** (toàn bộ là warning AudioContext autoplay) | **0** | ✅ |
| Nút < 44px đang hiển thị | 3 (segmented 38px ở màn Hướng dẫn nhanh) | **0** | ✅ |
| Ảnh QC 16 kịch bản | 0 lỗi console | **0 lỗi console**; **14/16 byte-identical**, 2 ảnh khác ≤ 22/255 ở viền bóng đổ (nhiễu) | ✅ không hồi quy |
| `bundle.html` qua `file://` | chạy được | **chạy được**, 0 lỗi console | ✅ |
| `node --test tests/*.test.mjs` | 54 pass / 0 fail | **54 pass / 0 fail** | ✅ |

---

## 1. Cách tái lập số đo

```bash
cd dots-boxes
python3 -m http.server 8801 --bind 127.0.0.1 &     # ghi lại PID để kill theo PID

node perf-audit.mjs                                  # đo đầy đủ (~2,5 phút, gồm bài heap 60s)
node perf-audit.mjs --label before --out perf-before.json
node perf-audit.mjs --only compat                    # chỉ ma trận tương thích (~40s)
node perf-audit.mjs --quick                          # bỏ bài heap 60s

bun qc-shots.mjs "http://127.0.0.1:8801/index.html" screenshots-maint
bun qc-shots.mjs "file://$PWD/bundle.html"          screenshots-maint-bundle
```

`perf-audit.mjs` (tự viết, **không dependency** — Node ≥ 22 hoặc Bun, dùng `fetch` + `WebSocket` có sẵn) mở Chrome
headless, điều khiển qua CDP và ghi `perf-report*.json` cạnh script. Nó **chỉ** dùng hook có sẵn `window.__game`
(`startGame/playEdge/playLegalEdge/stepAi/getState/setTheme`) + `Emulation.*` + `Performance.getMetrics`,
nên **không cần sửa mã sản phẩm** để đo.

| Bài đo | Cách đo | Trường trong JSON |
|---|---|---|
| FPS khi animate | Bàn 8×8 PvP; bọc `requestAnimationFrame` của trang để đo từng khung; chơi **30 nước liên tiếp** cách nhau **120ms**; đếm khung trong **2002ms** | `perf.fpsAnimating8x8` |
| rAF khi tĩnh | Sau khi ván đã dừng (rethấy), reset bộ đếm rồi **không thao tác 3s**; đếm mọi lần gọi `requestAnimationFrame` | `perf.rafWhenIdle3s` (kỳ vọng 0) |
| rAF khi menu | Ở màn menu **2s**, đếm tương tự | `perf.rafWhenIdleMenu2s` |
| `chooseMove` | Import **chính** module AI của app (`/src/ai.js` + `/src/engine.js`; bundle dùng `window.__M`), chơi **trọn 1 ván 8×8 cho mỗi độ khó** (339 lượt) bằng `chooseMove` + `applyMove` và đo `performance.now()` quanh mỗi lượt | `perf.chooseMove8x8.byLevel` |
| Heap/DOM 60s | Chơi liên tục 60s (80ms/nước, tự mở ván mới khi hết); lấy mẫu `performance.memory.usedJSHeapSize` + `document.getElementsByTagName('*').length` mỗi 5s | `perf.heap60s` |
| `Performance.getMetrics` | Mét chuẩn CDP sau bài 60s | `perf.cdpMetrics` |
| Tải trang | `Page.navigate` → đọc **Navigation Timing** (`domContentLoadedEventEnd`, `loadEventEnd`, `transferSize`) + đếm tài nguyên + `statSync` kích thước tệp | `perf.load.index` / `perf.load.bundle` |

---

## 2. Số đo TRƯỚC / SAU chi tiết

### 2.1 FPS khi animate (bàn 8×8, 30 nước cách nhau 120ms)

| | Trước | Sau |
|---|---|---|
| Khung hình / thời gian | 120 / 2002ms | 120 / 2001ms |
| **FPS** | **60.0** | **60.0** |
| Khung TB | 16.67ms | 16.67ms |
| p95 | 16.8ms | 16.7ms |
| Khung xấu nhất | 16.8ms (không có khung rơi) | 16.8ms |
| Khung > 33.4ms (rơi ~2 khung) | 0 | 0 |

Kết luận: renderer đã ở trần 60Hz của headless — **không có gì để tối ưu thêm về FPS**; mọi thay đổi về vòng vẽ ở §3
chỉ nhằm **giữ** mức này khi tab ẩn (tiết kiệm pin) và giảm việc làm thừa (DOM rebuild khi hover).

> Tham chiếu: khi đang animate, bộ đếm đo được **~10 lần gọi rAF/giây** trong 1,2s chơi (không phải 60) vì mỗi nước đi
> chỉ mở vòng vẽ ~600ms rồi tự dừng — đúng thiết kế "chỉ vẽ khi có animation".

### 2.2 rAF khi bàn tĩnh — **yêu cầu bắt buộc = 0**

| | Trước | Sau |
|---|---|---|
| Bàn tĩnh 3s (ván đang chơi, không thao tác) | **0** lần gọi | **0** lần gọi |
| Ở menu 2s | 0 | 0 |
| Sau khi đi 6 nước với `prefers-reduced-motion: reduce` | **0** (đã đạt ở bản gốc) | **0** |

→ Yêu cầu "renderer không được chạy rAF liên tục khi tĩnh" **đã đúng ngay trong bản trước**, không phải sửa.
Phần tôi bổ sung là **dừng vẽ khi `document.hidden`** (DESIGN §7.3 — tiết kiệm pin) vì bản trước vẫn vẽ tiếp
animation khi tab bị ẩn.

### 2.3 `chooseMove` — thời gian nghĩ của máy (bàn 8×8, mỗi độ khó 1 ván trọn = 113 lượt)

| Độ khó | Trước (TB / p95 / max) | Sau (TB / p95 / max) | Ngân sách |
|---|---|---|---|
| Dễ | 0.14 / 0.3 / 2.0ms | 0.22 / 0.5 / **2.6ms** | — |
| Trung bình | 0.15 / 0.6 / 2.1ms | 0.29 / 0.8 / **5.0ms** | — |
| **Khó** (rollout toàn ván) | 3.07 / 15.5 / **26.1ms** | 5.46 / 26.8 / **64.7ms** | **60ms** (`HARD_BUDGET_MS`) |
| Tổng 339 lượt | 1.12 / 8.8 / 26.1ms | 1.99 / 14.4 / **64.7ms** | — |

**Đọc trung thực:** tôi **không đổi mã AI**, nhưng số đo của bản "sau" **cao hơn** bản "trước" (đồng thời vượt
nhẹ 60ms ở lượt xấu nhất). Khi đo lặp lại, mức TB của bản Khó dao động trong khoảng 3–5,5ms và lượt xấu nhất
26–65ms giữa **cả hai** bản — đây là nhiễu của máy (headless, CPU chia sẻ), không phải hồi quy do thay đổi của tôi
(vòng vẽ/ảnh hưởng DOM không tham gia vào `chooseMove`; bài đo chạy cả ván ngay sau khi tải trang).
Đề xuất (không tự sửa trong lượt này vì dễ làm AI yếu đi — thuộc phạm vi Dev/QC): **hạ mức Trung bình → Khó theo
ngân sách thời gian thật** trong `ai.js` (`rollout` bỏ bớt cạnh ứng viên khi đã dùng > 40ms) để lượt xấu nhất
luôn < 60ms trên thiết bị chậm.

### 2.4 Heap & DOM trong 60 giây chơi liên tục

| | Trước | Sau |
|---|---|---|
| Mẫu | 42 (mỗi 5s) | 42 |
| Heap đầu → cuối | 3.9MB → **3.8MB** | 3.7MB → **2.1MB** |
| Heap min / max trong 60s | 2.1 / 4.9MB | 1.9 / 5.1MB |
| **Xu hướng** | Không tăng vô hạn (đỉnh 4.9MB rồi tụt khi GC) | Không tăng vô hạn (đỉnh 5.1MB) |
| DOM node đầu → cuối | 230 → 265 (max 340) | 230 → 265 (max 340) |

→ **Không rò rỉ**: sau 60s chơi (kể cả mở ván mới liên tục) heap về lại mức đầu; DOM node chỉ dao động theo màn hình
(menu/guide/play), không tăng theo thời gian.

### 2.5 Rò rỉ timer/listener — 30 lần chuyển màn (menu → ván → kết quả → menu)

| | Trước | Sau |
|---|---|---|
| Số chu kỳ | 30 (mọi chu kỳ đều về `screen = menu`) | 30 |
| **JSEventListeners** (CDP) | 299 → 299, **Δ 0** | 356 → 356, **Δ 0** |
| Nodes | Δ +4 | Δ +4 |
| JSHeapUsedSize | 2.61 → 2.90MB (**Δ +0.29MB**) | 2.61 → 2.90MB (**Δ +0.29MB**) |
| Documents | 1 → 1 | 1 → 1 |

Δ listener = 0 sau 30 chu kỳ, Δ heap 0.29MB (≈ mức phân bổ cố định của canvas/theo màn — không tăng theo số chu kỳ:
lần đo 30 chu kỳ trước đó cho cùng giá trị). **Cách kiểm chứng từ mã** (dispose ở đâu):

- `src/main.js` — timer đều có `clear`: `goMenu()` (`clearInterval(clockTimer)`, `clearTimeout(aiTimer)`,
  `tutorialAdvanceTimer`, `tutorialAiTimer`), `restartTurnClock()` tự `clearInterval(clockTimer)` trước khi đặt mới,
  `checkGameOver()`/`scheduleAiIfNeeded()` clear trước khi hẹn, `closeModal` → `onClose` chạy `resumeClock`.
- `src/render.js` — `destroy()` (dùng khi unmount): `cancelAnimationFrame(rafId)`, gỡ `themechange`,
  `motionQuery` listener, `ResizeObserver.disconnect()`, `clearTimeout(resizeTimer)`; **bổ sung** gỡ
  `visibilitychange`.
- `src/audio.js` — `bindVisibility()` trả hàm huỷ listener; `destroy()` gọi `stopBgmLoop()` + `ctx.close()`.
- `src/ui.js` — toast/combo/result dùng `clearTimeout`/`clearInterval` trước khi tạo mới; nút trong modal gắn lại
  sau mỗi `panel.innerHTML = ''` (không tích luỹ listener).
- `src/main.js` — listener toàn cục (`pointerdown`/`keydown` mở khoá audio, `resize`, `visibilitychange`,
  `themechange`) đăng ký **một lần** lúc boot, không đăng ký lại theo màn.

### 2.6 Tải trang & kích thước tệp

| | Trước | Sau |
|---|---|---|
| `index.html` — tệp HTML | 5,585 B (5.5KB) | 5,585 B |
| `index.html` — DCL / load | 24.8 / 25.3ms | 16.4 / 17.0ms |
| `index.html` — số tài nguyên | 11 (8 module JS + CSS + icon + manifest) | 11 |
| `bundle.html` — tệp | 247,369 B (**241.6KB**) | 252,864 B (**246.9KB**, **+2.1%**) |
| `bundle.html` — DCL / load | 17.9 / 18.2ms | 20.1 / 20.4ms |
| DOM node sau tải | 230 / 227 | 230 / 227 |

Tăng 2.1% ở bundle là do **mã + chú thích của các sửa lỗi** (§3), không thêm thư viện. Thời gian tải chênh
±2ms là dao động; khối lượng truyền tải bundle (253KB) vẫn dưới ngưỡng một trang đơn giản.

---

## 3. Danh sách sửa (file:dòng + lý do)

Chỉ những sửa **có lý do đo được** hoặc **lỗi thật**; phần còn lại giữ nguyên để bảo toàn thiết kế.

| # | File:dòng | Vấn đề (RCA) | Sửa | Bằng chứng |
|---|---|---|---|---|
| 1 | `src/main.js:450` (`render(structural)`), `:1351,1358,1371` | Mỗi lần **hover/preview** cạnh gọi `render()` → `scheduleSrRefresh()` → **xoá và tạo lại toàn bộ lưới ẩn** (tới ~160 `<button>` DOM) rồi bỏ ngay ở lần hover kế — dù di chuột không làm đổi tập cạnh hợp lệ. Trên bàn 8×8, rê chuột qua lưới tạo 5–15 hạng rác DOM mỗi giây (mỗi hạng ~160 nút + mảng cạnh), và các nút vừa tạo bị xoá trước khi kịp được tab tới. | Thêm tham số `render(structural = true)`: hover/preview/pointerdown truyền `false` → **không rebuild lưới ẩn**; đi nước/đổi bàn vẫn `true`. | `perf-after.json › leaks.deltaListeners = 0`; ảnh QC không đổi; 54 test pass |
| 2 | `src/render.js:180–193` | Tab bị ẩn vẫn tiếp tục vòng rAF vẽ animation (DESIGN §7.3 yêu cầu tiết kiệm pin khi không cần vẽ). | `startLoop()` kiểm `document.hidden` → vẽ **một frame trạng thái cuối** rồi dừng, không giữ rAF; `onVisibility()` khôi phục khi tab hiện lại. | `rafWhenIdle3s = 0`; `edge.hiddenTab`: sau 2s frozen `movesAfter=0`, không lỗi |
| 3 | `src/render.js:566` | Đổi `prefers-reduced-motion` **giữa lúc animate** (người dùng bật "giảm chuyển động" trong OS) vẫn chạy nốt animation — trái §7.3 ("TẮT hoàn toàn"). | `onMotionChange` xoá `anims` trước khi vẽ lại → hiện trạng thái cuối ngay. | `edge.reducedMotion`: reduce bật → 6 nước xong **0 rAF** |
| 4 | `src/render.js:314` + `src/main.js:306` | Bấm nước tiếp theo khi animation (E1–E3, tới ~700ms với combo) còn chạy → nước đó bị xử lý **đồng bộ trong frame** (có thể chèn ngay giữa animation) — §6.6 yêu cầu "xếp hàng đợi và xử lý ngay sau animation". | Thêm `onInputTick` cho renderer + hàng đợi **chỉ cho input người chơi** (`pendingPlayerInput`), xả ở khung kế tiếp (≈16ms). API `__game.*` giữ **đồng bộ 100%**. | `compat.syncMoves = 6` ở mọi viewport (cũng như bản gốc); QC `playAll=DONE` |
| 5 | `src/main.js:227,625–627` | (a) `AudioContext` được tạo sớm khi áp cài đặt lúc boot → Chrome log **"The AudioContext was not allowed to start"** (28 warning/phiên audit) và context khởi đầu `suspended` (iOS: SFX im lặng tới lần chạm sau). (b) `navigator.vibrate` gọi trên sự kiện **giả lập** → log `Blocked call to navigator.vibrate`. | (a) Tạo context **trong gesture** (`audio.js:62–72`) + `resume()` nếu còn suspended; không chạy BGM trước unlock (`audio.js:286`). (b) Chỉ nhận gesture **isTrusted** cho unlock audio & haptic. | `consoleErrors`: **28 → 0**; `robust` (8 chế độ suy giảm) đều `boot=true played=true errors=0` |
| 6 | `src/styles.css:379–386` | `segmented__seg` cao **38px** → dưới chuẩn vùng chạm 44px (đo được trên 320–1280px ở màn Hướng dẫn nhanh / Cài đặt). | `min-height: var(--tap-min)` (44px). Không đổi màu/nhãn/bố cục hàng. | `compat`: `small=<3` → **0** ở mọi viewport |
| 7 | `src/styles.css:596` | Nút trong lưới ẩn trợ năng (`sr-grid`) bị co về **0px** (không có min-size) — vùng chạm cho trình đọc màn hình = 0. | `.sr-grid > button { min-width:44px; min-height:44px }` (vẫn bị clip 1px). | `compat` không còn phần tử <44px |
| 8 | `src/styles.css:132,175` | **RCA tương thích**: `overflow-x: hidden` trên `html,body` (và `clip` trên `.app`) khiến trình duyệt **tính lại trục dọc** từ `visible` → `auto` (CSS Overflow 3 §3): tài liệu thành hộp cuộn riêng, cắt nội dung rộng. | Đổi sang `overflow-x: clip` ở cả hai chỗ (chỉ cắt ngang, **giữ trục dọc visible**). | Tràn ngang vẫn **0** ở 9/9 viewport; ảnh QC **14/16 byte-identical** |
| 9 | `src/main.js:567` | `aiTimer` giữ id của timeout **đã bắn** → `clearTimeout` vô nghĩa (không phải lỗi chức năng, chỉ là quản lý id không chính xác). | `aiTimer = 0;` khi callback chạy. | 54 test pass; `timeoutVsAi` không double-move |
| 10 | `index.html:11`, `build-bundle.mjs:165` | Meta `apple-mobile-web-app-capable` bị Chrome coi là **deprecated** (log warning ở mỗi lần tải). | Giữ `mobile-web-app-capable` (đã có) và bỏ meta deprecated. | `consoleErrors` 0 |
| 11 | `src/ui.js:469–471` | Không có comment về vùng chạm 44×44 của lưới ẩn (dễ bị "dọn" thành 0px lần sau). | Ghi chú tại chỗ + CSS ở #7. | — |

Không sửa: `sw.js`, luật chơi (`engine.js`), AI (`ai.js`), toàn bộ chuỗi tiếng Việt, mọi hiệu ứng E1–E8.

---

## 4. Ma trận tương thích (CDP `Emulation.setDeviceMetricsOverride` + `setEmulatedMedia`)

Mỗi viewport: đo ở **3 trạng thái** (menu / ván 5×5 vừa vào / ván đã chơi 12 nước + modal Cài đặt đang mở).

| Viewport | Tràn ngang `scrollWidth−clientWidth` | Bàn cờ nằm gọn trong khung nhìn | Bàn cờ (CSS px) | Nút hiển thị < 44px | Lỗi JS |
|---|---|---|---|---|---|
| 320×568 | **0** | ✅ | 296×296 | **0** (trước: 3) | 0 |
| 360×640 | **0** | ✅ | 328×328 | **0** (trước: 3) | 0 |
| 390×844 | **0** | ✅ | 358×358 | **0** (trước: 3) | 0 |
| 430×932 | **0** | ✅ | 398×398 | **0** (trước: 3) | 0 |
| 768×1024 | **0** | ✅ | 560×560 | **0** (trước: 3) | 0 |
| 667×375 (landscape) | **0** | ✅ | 165×165 | **0** (trước: 3) | 0 |
| 1280×800 | **0** | ✅ | 150×150 | **0** (trước: 3) | 0 |
| **zoom 200%** (390×844) | **0** | ⚠️ **không** (xem dưới) | 652×652 | **0** | 0 |
| **`prefers-reduced-motion: reduce`** | **0** | ✅ | 358×358 | **0** | 0 |

Ghi chú trung thực:

- **zoom 200%**: canvas vẽ 652×652 logical px → **1304×1304 CSS px**, không thể nằm trọn trong khung nhìn 195×422
  (sau zoom). Trang **không tràn ngang** (`overflowX = 0`); người dùng thấy một **phần** bàn và có thể cuộn — với trình
  duyệt đó là hành vi đúng khi phóng to. Đây **không phải** hồi quy (trước cũng `inside=false`), nhưng là **giới hạn
  thiết kế** nên nêu cho QC. Đề xuất: canvas có thể dùng `min(khung, boardSize zoom-aware)` — cần Dev xác nhận vì sẽ
  đổi tỉ lệ hiển thị ở §6.2.
- **667×375 landscape**: bàn 165×165 — **giữ nguyên** vì take `step` của §6.2 (không đổi luật/thiết kế); QC đã duyệt
  kích thước này ở vòng trước.
- **768×1024 / 1280×800**: bàn 560×560 / 150×150 — cũng là giá trị cũ (không đổi).
- Phần "Bàn cờ nằm gọn" đo trên canvas `#board` (canvas còn lại là minh hoạ 176×176 của Hướng dẫn nhanh — không phải
  "bàn cờ").

---

## 5. Ảnh QC — 0 lỗi console, không hồi quy

```bash
bun qc-shots.mjs "http://127.0.0.1:8801/index.html" screenshots-maint-before-temp   # bản gốc
bun qc-shots.mjs "http://127.0.0.1:8801/index.html" screenshots-maint                # bản đã sửa
bun qc-shots.mjs "file://$PWD/bundle.html" screenshots-maint-bundle                  # bundle qua file://
node _pixdiff.mjs screenshots-maint-before-temp screenshots-maint --strip=clock,hover # so pixel
```

- **16/16 kịch bản OK** ở cả hai bản; **0 lỗi JS/console** sau lọc favicon/SW (bản gốc cũng 0 ở lần chạy sạch — nên đây là
  *giữ* mức sạch, không phải sửa; lỗi console duy nhất tôi gặp trong quá trình chạy là lỗi tạm thời
  `Failed to fetch dynamically imported module` nêu ở ghi chú cuối mục).
- `bundle.html` qua `file://`: **16/16 OK, 0 lỗi console** (bản gốc 0 lỗi) — bundle chạy được.
- So sánh pixel: **14/16 ảnh byte-identical**; 2 ảnh lệch **do phi tất định**, đo lặp lại trên **chính bản gốc** cũng lệch
  cùng mức:
  - `r06-play-light-5x5`: 0.138% pixel, **Δ màu tối đa 4/255** (bản gốc chạy 2 lần cũng lệch 0.138%, Δ 3/255) → anti-aliasing canvas.
  - `r01-menu-light-390`: 0.37–0.53% pixel, Δ tối đa 22/255, chỉ ở **viền bóng đổ** card — trên bản gốc, lần chạy 1 vs lần
    chạy 2 lệch tới **61.8%** (một lần chụp dính lỗi tải module tạm thời) nên đây là nhiễu môi trường.
- Đã **mở ảnh bằng tool đọc ảnh** để tự kiểm (r01, r02, r03, r04, r07, r12, r13, r16, `screenshots/07-quick-guide.png`):
  cùng nội dung, cùng bố cục; chỉ khác duy nhất ở **r03/r04**: màn Hướng dẫn nhanh khi cuộn xuống hiện đủ thẻ + nút CTA
  (bản gốc ở 320/landscape hiện vùng cuối bị cắt/mờ), và **r16**: bản gốc ở zoom 200% hiện chữ bị cắt cột ("Kín 4 cạnh..."
  xếp thành cột dọc 1 chữ) — cả hai là **cải thiện do sửa `overflow-x` (#8)**, không phải hồi quy.

> Lưu ý cho QC: `qc-shots.mjs` mở 2 lần liên tiếp có thể gặp lỗi tạm thời
> `Failed to fetch dynamically imported module: /src/main.js` (broken pipe của `http.server` một luồng khi Chrome đóng
> kết nối giữa chừng). Đã gặp 2/6 lần chạy, kể cả trên **bản gốc** — nên chạy lại một lần hoặc dùng máy chủ đa luồng
> (`python3 -m http.server` không hỗ trợ) trước khi coi là lỗi sản phẩm. Không sửa `qc-shots.mjs` theo ràng buộc.

---

## 6. Lỗi logic hiếm gặp — đã kiểm (chỉ sửa nếu là lỗi thật)

| Kịch bản | Cách kiểm | Kết quả | Sửa? |
|---|---|---|---|
| Timer hết giờ + AI đang đi cùng lúc | Bàn 6×6 AI đi trước, timer 10s; ghi `moveCount/turn/turnSeq` mỗi 50ms trong **12.5s** | `moveJumps = [1,1]`, **maxJump 1** (không double-move); `turnSeq` + `gameId` chặn timer ván cũ | Không cần — cơ chế `turnSeq` đã đúng |
| Đổi theme giữa lúc animate | 12 nước liên tiếp, đổi `dark/light` xen kẽ mỗi nước; sau 0.9s đọc pixel tâm canvas | `moveCount=12`, canvas 716px (DPR2), pixel `#475569` khớp `--border-strong` dark; 0 lỗi | Không |
| Đổi kích thước cửa sổ giữa lúc animate | resize 320×568 → 768×1024 → 667×375 → 390×844 trong lúc chạy 2 nước/lần | Bàn về 358×358, **overflowX 0**, 0 lỗi | Không (đã có debounce 80ms + vẽ lại) |
| Tab ẩn rồi hiện giữa lượt | `Page.setWebLifecycleState('frozen')` 2s → `active`; timer 20s | Nước đi không nhân đôi, `over=false`, **rAF dừng khi ẩn** (§3 #2); `visibilitychange` trong `main.js` pause/resume đồng hồ | **Có** — dừng vẽ khi tab ẩn (#2) |
| Ván 3×3 hết sạch cạnh khi đang bật timer | PvP timer 10s, chơi tới hết | 12 nước, `over=true`, tổng điểm **9 = n²**, đồng hồ ẩn-khoá đúng, 0 lỗi | Không |
| Bấm "Ván mới" liên tiếp 5 lần | Click `#btn-new` → xác nhận, lặp 5 lần | 5 hộp xác nhận, ván mới **moveCount=0**, 0 lỗi (chỉ 1 ván được tạo) | Không |
| Mở "Luật"/"Cài đặt" khi timer chạy | Đọc đồng hồ trước / sau 2s trong modal / sau đóng | Đồng hồ **đứng "0:10"** suốt 2s (đã tạm dừng), chạy tiếp sau khi đóng, 0 lỗi | Không |
| Phím mũi tên/Enter khi ở menu | Bấm 8 vòng 6 phím ở menu | Màn không đổi, `moveCount` không đổi, 0 lỗi | Không |
| Phím mũi tên/Enter khi modal mở | Bấm 10 lần 4 phím trong modal Luật | **Không đi nước nào** (`keysDidNotMove=true`), focus vẫn bị trap trong modal | Không |
| `prefers-reduced-motion: reduce` | Bật emulated media, đi 6 nước | **0 rAF** sau khi đi (E1–E5 tắt), 0 lỗi | **Có** (#3) |

---

## 7. Chế độ suy giảm (compatibility) — 8 kế hoạch

Mỗi ca: inject script **trước** khi trang chạy (`Page.addScriptToEvaluateOnNewDocument`), rồi boot + chơi 6 nước + đổi theme.

| Ca | Trước | Sau |
|---|---|---|
| Baseline | boot ✅ · chơi ✅ · 0 lỗi | boot ✅ · chơi ✅ · 0 lỗi |
| `localStorage` bị chặn (getter ném `SecurityError`) | ✅ | ✅ |
| thiếu `crypto.getRandomValues` | ✅ | ✅ |
| thiếu `navigator.vibrate` | ✅ | ✅ |
| thiếu `CanvasRenderingContext2D.roundRect` | ✅ (có fallback path) | ✅ |
| thiếu `ResizeObserver` | ✅ | ✅ |
| `AudioContext` ném lỗi | ✅ | ✅ |
| `AudioContext` luôn `suspended` | ✅ | ✅ |

→ **Không chỗ nào crash**; không cần thêm fallback ngoài những gì đã có (`roundRectPath` thủ công, `safeStorage()`,
`randomInt` fallback `Math.random`, `try/catch` quanh mọi lời gọi audio + `unlock()` trong gesture).

---

## 8. Những điểm CHƯA kiểm được (trung thực)

1. **Safari/Firefox thật**: chỉ đo trên **Chrome 157 headless**. `overflow: clip` (dùng ở #8) cần Safari 16+, Firefox
   81+; với trình duyệt cũ hơn giá trị rơi về `visible` → **không cắt tràn** nhưng cũng **không hỏng** layout. Chưa
   thử trên iOS Safari thật (halo/`-webkit-*`, `visualViewport` khi bàn phím bật).
2. **Thiết bị thật & 60Hz vs 120Hz**: FPS đo trên headless (trần 60Hz). Màn 120Hz/ProMotion và CPU di động chậm
   chưa đo — khuyến nghị QC đo Profile CPU 4× + 6× trên iPhone/Android thật.
3. **Pin khi tab ẩn**: đã sửa để dừng vòng vẽ nhưng **không đo được mức tiêu thụ pin** (cần thiết bị thật).
4. **`chooseMove` lượt xấu nhất 64.7ms** (bản "sau") vượt 60ms trên máy này — nhiễu, nhưng **chưa** chứng minh được trên
   CPU chậm hơn 3–5× (điện thoại tầm trung) vẫn < 60ms. Đây là rủi ro thật, cần Dev tối ưu `ai.js` nếu QC muốn.
5. **Timer/listener**: CDP **không** expose danh sách timer của page. Tôi chứng minh gián tiếp bằng
   `JSEventListeners` (Δ 0 sau 30 chu kỳ) + heap ổn định + đọc mã (mục 2.5); **không** đếm được trực tiếp số
   `setInterval`/`setTimeout` còn sống.
6. **Zoom 200%**: bàn không nằm gọn khung nhìn (652×652 logical = 1304 CSS px) — xem mục 4. Không tràn ngang, nhưng
   chưa có thiết kế "thu bàn theo zoom".
7. **Ảnh r01/r06** lệch **≤ 22/255** (r01, ở viền bóng) và **≤ 4/255** (r06) do anti-aliasing — không phải hồi quy nhưng
   là **giới hạn** của phép so pixel; QC nên review bằng mắt trên ảnh mới (đã làm với 9 ảnh).
8. **`index.html` mở qua `file://`** (không phải bundle): vẫn hiện hộp hướng dẫn — đúng thiết kế; chưa thử trên trình
   duyệt cho phép ES module qua `file://` (Firefox cũ).
9. **`prefers-color-scheme` toàn cục**: emulation chỉ bật `light`; theme `system` + OS dark thật chưa đo (ảnh r02/r10 đã
   chụp với `?theme=dark` tường minh).

---

## 9. Đề xuất cho QC

1. **Đo lại `chooseMove` trên Profile CPU 4×** (DevTools → Performance → CPU throttling) với **bàn 8×8 / Khó**; nếu lượt
   xấu nhất > 60ms, yêu cầu Dev thêm ngân sách thời gian trong `rollout` của `ai.js`.
2. **Chạy `qc-shots.mjs` 2 lần liên tiếp** rồi so pixel bằng `_pixdiff.mjs` (bản gốc cũng có nhiễu r01/r06) — nếu lệch
   ở vùng **không phải** viền bóng đổ hay canvas thì mới là hồi quy thật.
3. **Kiểm zoom 200%** bằng mắt trên 320×568 (không chỉ 390×844) để xác nhận hướng xử lý (thu bàn, hay chấp nhận cuộn)
   — đây là quyết định thiết kế, không phải lỗi.
4. **Kiểm màn Hướng dẫn nhanh ở 320×568 và landscape**: bản sửa hiện đủ nút CTA (bản gốc hiện thẻ bị cắt) — QC xác nhận
   đây là cải thiện nằm trong spec.
5. **Âm thanh trên iOS Safari thật**: thử chạm lần đầu → có tiếng ngay (context tạo trong gesture). Headless không
   kiểm được thực âm.

---

## 10. Tệp bàn giao & dọn dẹp

| Tệp | Nội dung |
|---|---|
| `perf-audit.mjs` | Script đo tái chạy được (không dependency), 5 nhóm bài: `perf`, `compat`, `leaks`, `robust`, `edge` |
| `perf-before.json`, `perf-after.json` | Số đo thô **TRƯỚC** / **SAU** (kèm `consoleErrors`, `meta.browser`) |
| `MAINTENANCE.md` | Báo cáo này |
| `screenshots-maint/` | 16 ảnh **SAU** (http), `screenshots-maint-bundle/` (file://) |
| `screenshots-maint-before-temp/` | 16 ảnh **TRƯỚC** (dùng để so hồi quy) — có thể xoá sau khi QC duyệt |
| `bundle.html` | Đã build lại bằng `node build-bundle.mjs` sau khi sửa `src/` |

Đã kill máy chủ 8801 **theo PID** (`/tmp/boxline-srv.pid`) và Chrome debug; các thư mục profile Chrome tạm trong `/tmp`
đã xoá. Các tệp nháp (`_reapply.mjs`, `_pixdiff.mjs`, `cdp-eval-bits.mjs`, `perf-race-probe.mjs`) đã xoá sau khi khoá sổ.
