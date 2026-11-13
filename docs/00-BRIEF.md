# BRIEF CHUNG — Game "Dots & Boxes" (Cờ Ô Vuông)

> Do Orchestrator ban hành. Mọi agent đọc file này TRƯỚC khi bắt tay làm.
> Cập nhật: 2026-11-13

## 1. Sản phẩm

Web game Dots & Boxes (nối cạnh tô ô vuông), chơi trên canvas, **không phụ thuộc framework**:
HTML + CSS + JS ES module, render Canvas 2D. Sau này đóng gói mobile bằng **Capacitor/WebView**
và gắn **AdMob**. Demo web phải mở được ngay bằng cách bấm vào `index.html`
(cũng có thể chạy `python3 -m http.server` nếu trình duyệt chặn ES module qua `file://`).

## 2. Quyết định người dùng đã chốt

| Hạng mục | Quyết định |
|---|---|
| Công nghệ | HTML/CSS/JS thuần (Canvas) + Capacitor cho mobile |
| Quảng cáo | AdMob: **banner** + **interstitial sau trận** + **rewarded** gợi ý nước đi |
| Giao diện | **Có cả Light + Dark**, mặc định theo hệ thống (`prefers-color-scheme`), có nút chuyển tay |
| Phong cách | Tối giản, hiện đại, không màu mè, có hiệu ứng hình ảnh |
| Đối tượng | Mọi người (không cần biết game) |

## 3. Tính năng bắt buộc (do người dùng yêu cầu)

1. Chơi với máy (AI) hoặc 2 người trên cùng máy.
2. Bật/tắt **giới hạn thời gian mỗi lượt** (mặc định 20 giây/lượt; hết giờ → mất lượt).
3. Chọn **kích thước bàn**: 3×3, 4×4, 5×5, 6×6, 7×7, 8×8 (đơn vị ô vuông).
4. Chọn **ai đi trước** hoặc **oẳn tù tì** (khi chơi với máy; 2 người cũng có oẳn tù tì).
5. Chọn **độ khó AI**: Dễ / Trung bình / Khó.
6. **Nhạc nền + SFX** (tổng hợp bằng Web Audio API, không cần file mp3 — nhẹ, offline).
7. **Tutorial** cho người mới (do Explainer viết nội dung, Dev hiện thực).
8. Điểm số hiển thị trực tiếp, ô được tô màu theo người chơi, khi tô đủ 4 cạnh → ghi điểm và **được đi tiếp**.
9. Kết thúc ván khi mọi cạnh đều được tô → tổng kết, người nhiều điểm hơn thắng (hòa nếu bằng).

## 4. Luật chơi (nguồn sự thật — không được lệch)

- Bàn có `n × n` ô; lưới điểm `(n+1) × (n+1)`.
- Tổng số cạnh: `2 * n * (n+1)`. Viền ngoài **đã được tô sẵn** (không ai được tô lại, không tính điểm từ viền).
- Hai người luân phiên tô **một cạnh trong** chưa được tô.
- Khi một ô đủ 4 cạnh: ô đó tính cho **người vừa tô cạnh thứ 4**, và người đó **được đi tiếp** (giữ lượt).
- Ván kết thúc khi tất cả cạnh trong đều đã tô. Ai nhiều ô hơn thì thắng.
- Tổng điểm 2 người luôn bằng `n²`.

## 5. Cấu trúc thư mục

```
dots-boxes/
├── index.html            # bản demo web (mở là chơi)
├── manifest.webmanifest  # PWA cơ bản
├── sw.js                 # service worker (offline cache)
├── src/
│   ├── styles.css        # design token light/dark + layout
│   ├── main.js           # khởi động, điều hướng màn hình
│   ├── engine.js         # luật chơi thuần (không DOM) → dễ unit test
│   ├── ai.js             # 3 mức độ khó
│   ├── render.js         # Canvas render + hiệu ứng
│   ├── audio.js          # Web Audio: BGM + SFX
│   ├── ui.js             # menu, HUD, modal, tutorial
│   ├── tutorial.js       # nội dung tutorial (Explainer → Dev)
│   └── config.js         # hằng số, lưu cài đặt localStorage
├── tests/
│   ├── engine.test.mjs   # node --test, không cần thư viện
│   └── ai.test.mjs
├── docs/
│   ├── 00-BRIEF.md
│   ├── 10-PLAN.md
│   ├── 20-DESIGN.md
│   ├── 30-TUTORIAL.md
│   ├── 40-MAINTENANCE.md
│   └── 50-QC.md
└── mobile/               # hướng dẫn Capacitor + AdMob (giai đoạn 2)
```

## 6. Ràng buộc kỹ thuật chung

- **Không thư viện ngoài**, không CDN → chạy offline 100%.
- ES modules thuần; code sạch, không TODO, không `console.log` rác trong bản phát hành.
- `engine.js` **thuần logic**, không chạm DOM/Canvas để unit test bằng `node --test`.
- Hiệu năng: 60fps trên điện thoại tầm trung; canvas dùng `devicePixelRatio` nhưng **cap 2x**.
- Truy cập: hỗ trợ bàn phím (Tab + Enter/Space chọn cạnh), `aria-label`, `prefers-reduced-motion`
  (tắt hiệu ứng động), focus ring rõ ràng, đối tượng màu không chỉ dựa vào màu (thêm ký hiệu).
- Tiếng Việt là ngôn ngữ chính của UI. Chuỗi có dấu đầy đủ.
- Không thu thập dữ liệu người dùng. Cài đặt chỉ lưu localStorage.

## 7. Điểm chèn quảng cáo (bản demo chỉ tạo "hook")

- `window.AdBridge` (adapter trung lập) với 3 hàm: `showBanner()`, `showInterstitial()`, `showRewarded()`.
- Trên web demo: `AdBridge` giả lập (mock) — hiện hộp thoại mô phỏng, **không có quảng cáo thật**.
- Trên mobile (giai đoạn 2): cắm plugin AdMob vào đúng 3 hàm — không phải sửa logic game.
- Vị trí: banner ở màn hình Menu + màn hình kết quả; interstitial sau khi kết thúc ván
  (tối đa 1 lần/2 ván, không xen giữa ván); rewarded khi người chơi bấm "Gợi ý nước đi".

## 8. Ngôn ngữ báo cáo

Mỗi agent trả kết quả bằng tiếng Việt, kèm **đường dẫn file** đã tạo/sửa để Orchestrator nghiệm thu.
