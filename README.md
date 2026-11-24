# Boxline — Cờ Ô Vuông

Game **Dots & Boxes** (nối cạnh – tô ô vuông) viết bằng HTML + CSS + JavaScript thuần, vẽ bàn cờ
bằng Canvas 2D. Chạy **offline 100%**, không thư viện ngoài, không CDN.

| Hạng mục | Giá trị đã chốt |
|---|---|
| Tên hiển thị | **Boxline** |
| Phụ đề | **Cờ Ô Vuông** |
| Tên đầy đủ (manifest/store) | `Boxline: Dots & Boxes` |
| `short_name` | `Boxline` |
| Bundle id dự kiến (mobile) | `com.santabu.boxline` |

## 0. Chơi ngay trên web (đã phát hành)

- 🎮 **https://santabu107052.github.io/boxline/** — bản demo, mở được trên điện thoại và máy tính.
- 🧩 Bản một tệp: **https://santabu107052.github.io/boxline/bundle.html** (mở trực tiếp, không cần máy chủ).
- 📦 Mã nguồn: **https://github.com/santabu107052/boxline**

## 1. Cách chạy (chọn 1 trong 3)

### Cách 1 — Mở `bundle.html` (không cần máy chủ)
```bash
node build-bundle.mjs      # tạo bundle.html (một tệp duy nhất, tự inline CSS + JS)
open bundle.html           # macOS
```
`bundle.html` chứa toàn bộ game trong một tệp nên mở được bằng cách bấm đúp, kể cả qua `file://`.

### Cách 2 — `./serve.sh`
```bash
./serve.sh                 # http://127.0.0.1:8765/
```

### Cách 3 — `python3 -m http.server`
```bash
python3 -m http.server 8765 --bind 127.0.0.1
# rồi mở http://127.0.0.1:8765/
```

> **Vì sao cần máy chủ?** `index.html` dùng ES module. Mở thẳng bằng `file://` thì một số trình
> duyệt chặn tải module. Khi đó trang hiện hộp hướng dẫn tiếng Việt với 3 cách chạy ở trên —
> không bao giờ là trang trắng.

Query param hữu ích để test/chụp ảnh:
`?theme=dark|light|system`, `?mode=ai|pvp`, `?size=3…8`, `?debug=1`.

## 2. Cấu trúc thư mục

```
dots-boxes/
├── index.html            # app shell (ES module) + noscript + hộp hướng dẫn khi file:// bị chặn
├── bundle.html           # SINH RA bởi build-bundle.mjs (đừng sửa tay)
├── build-bundle.mjs      # đóng gói thành 1 tệp chạy được qua file://
├── serve.sh              # chạy máy chủ tĩnh 127.0.0.1:8765
├── manifest.webmanifest  # PWA
├── sw.js                 # service worker: cache-first app shell (chỉ tài nguyên nội bộ)
├── icon.svg              # icon lưới ô vuông
├── src/
│   ├── styles.css        # DESIGN §10 (token light/dark nguyên khối) + layout/component
│   ├── config.js         # hằng số, preset cài đặt, oẳn tù tì, localStorage an toàn
│   ├── engine.js         # LUẬT CHƠI thuần logic (không DOM) — unit test bằng node --test
│   ├── ai.js             # 3 mức độ khó (Dễ / Trung bình / Khó)
│   ├── render.js         # Canvas 2D: DPR cap 2×, 10 lớp z-order, hiệu ứng E1–E6
│   ├── audio.js          # Web Audio API: BGM + SFX tổng hợp (không file mp3)
│   ├── tutorial.js       # TUTORIAL_STEPS + câu chữ + gợi ý + bảng thuật ngữ
│   ├── ui.js             # DOM: menu, HUD, modal, toast, oẳn tù tì, màn hướng dẫn
│   └── main.js           # state machine, đồng hồ lượt, máy đi, AdBridge, debug hook
├── tests/
│   ├── engine.test.mjs   # 19 test luật chơi
│   ├── ai.test.mjs       # 13 test AI + matchup (N = 200 ván/cặp)
│   └── tutorial.test.mjs # 22 test nội dung + kịch bản tutorial
├── screenshots/          # ảnh chụp Chrome headless
├── mobile/README.md      # hướng dẫn Capacitor + AdMob (giai đoạn 2)
└── docs/                 # tài liệu đặc tả (không sửa khi làm Dev)
```

## 3. Cách test

```bash
node --test tests/*.test.mjs     # 54 test (node ≥ 18, không cần thư viện)
# hoặc
npm test
```

Kết quả mong đợi: **54 pass / 0 fail**. Trong đó:

- **luật chơi**: tổng điểm luôn `n²`, `applyMove` idempotent, tổng `2n(n+1)` cạnh hợp lệ
  (gồm cả cạnh mép bàn), mọi ô (góc, mép, giữa) đều cần đủ 4 cạnh mới kín, undo, passTurn,
  serialize/restore;
- **AI**: Hard thắng Easy ≥ 85%, Hard thắng Medium ≥ 70% (N = 200 ván, **đổi bên mỗi ván** để
  triệt tiêu lợi thế đi trước), thời gian nghĩ ≤ 60 ms/lượt trên bàn 8×8;
- **tutorial**: mọi cạnh trong `allowedEdges`/`decoyEdges` đều nằm trên bàn (`isOnBoard`) và chưa tô;
  bước 2 kín đúng 1 ô; cạnh an toàn ở bước 4 không kín ô và không sinh thêm ô 3 cạnh; máy ở bước 3 giữ bàn sạch.

## 4. Cách chụp screenshot

```bash
# 1. mở máy chủ
./serve.sh

# 2. chụp (Chrome headless, kích thước điện thoại)
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=390,844 \
  --screenshot=screenshots/menu-light.png \
  "http://127.0.0.1:8765/index.html?theme=light&debug=1"
```

Muốn chụp **bàn đang chơi sau N nước**, dùng debug hook (có ở `?debug=1`):

```js
// dán vào Console (DevTools) hoặc điều khiển qua CDP
__game.startGame({ size: 5, mode: 'ai', difficulty: 'medium', first: 'you', timeLimitOn: false });
[[1,0,'H'],[1,1,'H'],[2,0,'H'],[0,1,'V'],[1,1,'V'],[2,1,'V'],[3,1,'H'],[1,2,'V']]
  .forEach((e) => __game.playEdge(e));
__game.getState();      // snapshot: screen, n, turn, score, remaining, over, errors…
__game.setTheme('dark');
```

> Ảnh chụp bằng cờ `--screenshot` của Chrome có thể bị **lệch/tràn ngang giả tạo** trên macOS
> (khung chụp rộng hơn viewport). Để có ảnh đúng bằng viewport, chụp qua CDP
> (`Page.captureScreenshot` sau `Emulation.setDeviceMetricsOverride`).

## 5. AdBridge — **bản mock**

`window.AdBridge` là adapter trung lập, hiện **giả lập** (không có quảng cáo thật):

| Hàm | Hành vi trên web demo |
|---|---|
| `showBanner()` | đánh dấu khung `#ad-slot` (khung này **luôn** cao `--ad-reserve` = 50px nên layout không nhảy) |
| `hideBanner()` | bỏ đánh dấu |
| `showInterstitial(opts)` | chỉ hiện khi màn kết quả đã hiển thị ≥ 1.2s, không hiện giữa ván, tối đa 1 lần / 2 ván; demo chỉ báo bằng toast |
| `showRewarded()` | luôn "thưởng" (demo), dùng cho nút **Gợi ý** khi đấu với máy |

Sang mobile chỉ cần thay phần thân 3 hàm này bằng plugin AdMob — **không sửa logic game**.

## 6. Kiểm thử trong Chrome (đã làm thực tế)

- Mở `bundle.html` qua `file://` → bàn cờ render, chơi được; `window.__errors` rỗng.
- Mở `http://127.0.0.1:8765/index.html?debug=1` → mọi màn hình chụp được bằng CDP, không có lỗi
  JS trong console.
- Đóng góp lỗi runtime (nếu có) được hiển thị trong `<pre id="selftest">` và `window.__errors`.

## 7. Ghi chú

- Mobile (Capacitor + AdMob): xem [`mobile/README.md`](mobile/README.md).
- Không thu thập dữ liệu người dùng; cài đặt chỉ nằm trong `localStorage`.
- Tiếng Việt có dấu đầy đủ, không emoji trong UI, gọi đối thủ là "máy".
