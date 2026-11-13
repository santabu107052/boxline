# 20 — DESIGN SYSTEM: Dots & Boxes (Cờ Ô Vuông)

> Tác giả: Agent Designer (visual-designer) · Ngày: 2026-11-13
> Nguồn ràng buộc: [`docs/00-BRIEF.md`](./00-BRIEF.md) (luật chơi, stack, ad hook, a11y).
> Đích: Dev copy trực tiếp token vào `src/styles.css`, hằng số vào `src/config.js`, số đo vào `src/render.js`.
> Ngôn ngữ UI: tiếng Việt có dấu. Mọi con số trong tài liệu **dùng đơn vị CSS px** trừ khi ghi `pt`/`ratio`.

---

## 0. TL;DR cho Dev (đọc 45 giây)

| Hạng mục | Chốt |
|---|---|
| Phong cách | Tối giản hình học, phẳng, chỉ dùng **1 màu nhấn lam**, 2 màu người chơi (lam + cam đất) |
| Theme | Light mặc định theo hệ thống, `data-theme="light"\|"dark"\|"system"` trên `<html>`, lưu `localStorage` |
| Bàn cờ | Canvas + `devicePixelRatio` **cap 2x**, render bằng `requestAnimationFrame` |
| Nhận diện người chơi | **Màu + hình** (tròn vs tam giác) + **hoa tiết** (không chấm vs gạch chéo) — không bao giờ chỉ màu |
| Vùng chạm | Tối thiểu **44×44**, ưu tiên 48×48 cho nút chính trên bàn cờ |
| Motion | 8 hiệu ứng, tất cả ≤ 480ms; `prefers-reduced-motion: reduce` → chỉ còn crossfade 120ms |
| Ad banner | Chỗ chừa cố định `--ad-reserve: 50px`, layout **không nhảy** khi banner xuất hiện |

---

## 1. Nguyên tắc thị giác

### 1.1 Ba từ khóa (bộ lọc mọi quyết định)

1. **Lưới** — Bàn cờ *chính là* giao diện. Đường thẳng, khoảng trống đều, không trang trí thêm. Mọi thành phần UI căn theo cùng một đơn vị 4px.
2. **Nhịp** — Một cạnh được vẽ → một ô bật sáng → điểm nhảy. Mỗi hành động có **đúng một** phản hồi thị giác, không hiệu ứng chồng hiệu ứng.
3. **Rõ** — Trạng thái lượt của ai, ai đang dẫn điểm, cạnh vừa tô ở đâu: nhận ra trong **< 0,5 giây**, không cần đọc chữ.

### 1.2 Ba điều cấm

1. **Không gradient rực** — Cấm gradient nhiều màu bão hòa, cấm glow/neon. Chỉ cho phép **một** gradient rất nhẹ 0→8% opacity làm bóng đổ mềm của modal (tùy chọn).
2. **Không đổ bóng nặng** — Tối đa **2 tầng shadow**, blur ≤ 24px, opacity ≤ 0.10. Cấm `box-shadow` 3 tầng lồi/vát, cấm `text-shadow` trên bàn cờ.
3. **Không quá 2 màu nhấn** — Tổng màu nhấn = **1 lam (accent) + 1 cam (player B)**. Trạng thái lỗi/thành công chỉ dùng cho thông báo, **không** dùng để trang trí nút bấm thông thường.

### 1.3 Quy luật 60–30–10 (áp vào bàn cờ)

| Tỷ lệ | Vùng | Theme light | Theme dark |
|---|---|---|---|
| 60% | Nền bàn cờ + surface | `--surface-1` | `--surface-1` |
| 30% | Đường lưới, dot, chữ phụ | `--grid-line` + `--text-secondary` | như light |
| 10% | Cạnh/ô của 2 người chơi + accent | `--player-a` / `--player-b` / `--accent` | như light |

Màu người chơi **luôn bị giới hạn ≤ 10% diện tích**: ô đã tô dùng **màu tint nhạt** (`--box-a-bg`), chỉ đường viền và hoa tiết mang màu đậm đặc. Điều này giữ bàn cờ "tối giản", không thành bảng màu rực khi tô kín.

---

## 2. Design token

### 2.1 Quy ước đặt tên

`--<nhóm>-<vai trò>`: `surface` (nền) · `text` (chữ) · `border` (viền/sợi tách) · `grid` (đường lưới canvas) · `player-a|b` · `box-a|b` (ô đã tô) · `accent` · `focus` · `danger|success` · `shadow` · `radius` · `space` · `motion`.

Phần **kích thước** (`radius`, `space`, `font`, `motion`, `layout`) **không đổi theo theme** → khai báo một lần ở `:root`.

### 2.2 Bảng token — LIGHT (chuẩn, khai báo trong `:root`)

| Nhóm | Tên biến | Giá trị | Ghi chú |
|---|---|---|---|
| Nền | `--surface-0` | `#F7F8FA` | Nền app (sau lưng card/bàn cờ) |
| Nền | `--surface-1` | `#FFFFFF` | Card, khung bàn cờ, HUD |
| Nền | `--surface-2` | `#EEF0F4` | Nền chìm: segmented track, input, nút ghost hover |
| Nền phụ | `--surface-tint-a` | `#E8EEFD` | Nền ô đã tô — người A (tint lam nhạt) |
| Nền phụ | `--surface-tint-b` | `#FCEFD9` | Nền ô đã tô — người B (tint cam nhạt) |
| Nền phụ | `--surface-scrim` | `rgba(17, 24, 39, 0.40)` | Lớp phủ modal/dialog |
| Chữ | `--text-primary` | `#111827` | Tiêu đề, số điểm, nhãn nút |
| Chữ | `--text-secondary` | `#475569` | Mô tả, nhãn phụ |
| Chữ | `--text-muted` | `#5D6779` | Placeholder, chú thích nhỏ, chữ disabled |
| Chữ | `--text-on-accent` | `#FFFFFF` | Chữ trên nút primary |
| Lưới | `--grid-line` | `#7C879B` | Đường lưới trong bàn (chỉ cho lưới "khe" nếu dùng) |
| Lưới | `--grid-dot` | `#475569` | Dot/dấu giao điểm (dùng `--text-secondary` cho đồng bộ) |
| Viền | `--border` | `#7C879B` | Sợi viền tiêu chuẩn (xem 2.5 — dùng ở 40% alpha cho sợi mảnh) |
| Viền | `--border-strong` | `#475569` | Viền trạng thái focus/selected khi cần khối đặc |
| Người A | `--player-a` | `#2563EB` | Lam cobalt — cạnh, dot active, viền ô |
| Người A | `--player-a-hover` | `#1D4ED8` | Hover/pressed |
| Người A | `--player-a-pattern` | `rgba(37, 99, 235, 0.16)` | Màu hoa tiết "không chấm" trong ô A |
| Người B | `--player-b` | `#A3540A` | Cam đất — cạnh, dot active, viền ô |
| Người B | `--player-b-hover` | `#7C3E06` | Hover/pressed |
| Người B | `--player-b-pattern` | `rgba(163, 84, 10, 0.18)` | Màu hoa tiết gạch chéo trong ô B |
| Ô đã tô | `--box-a-bg` | `#E8EEFD` | = `--surface-tint-a` (alias cho ngữ nghĩa) |
| Ô đã tô | `--box-a-border` | `#2563EB` | Viền chữ nhật bo góc của ô A |
| Ô đã tô | `--box-b-bg` | `#FCEFD9` | |
| Ô đã tô | `--box-b-border` | `#A3540A` | |
| Nhấn | `--accent` | `#1D4ED8` | Nút primary, link, chỉ báo lượt |
| Nhấn | `--accent-hover` | `#1E40AF` | Hover |
| Nhấn | `--accent-soft` | `#DCE6FD` | Nền chip/segmented đang chọn |
| Focus | `--focus-ring` | `#1D4ED8` | Màu ring (dùng kèm `outline-offset`) |
| Focus | `--focus-ring-gap` | `#FFFFFF` | Halo ngoài ring để nổi trên mọi nền |
| Trạng thái | `--danger` | `#B42318` | Hết giờ, lỗi |
| Trạng thái | `--danger-soft` | `rgba(180, 35, 24, 0.10)` | Nền cảnh báo |
| Trạng thái | `--success` | `#067647` | Thông báo thành công |
| Trạng thái | `--success-soft` | `rgba(6, 118, 71, 0.10)` | |
| Toast | `--toast-bg` | `#111827` | Toast nền đậm (cả 2 theme) |
| Toast | `--toast-text` | `#F2F4F7` | |
| Shadow | `--shadow-1` | `0 1px 2px rgba(17,24,39,.06), 0 1px 3px rgba(17,24,39,.08)` | Card, nút nổi |
| Shadow | `--shadow-2` | `0 8px 24px rgba(17,24,39,.10)` | Modal, menu thả |
| Đường viền 1px | `--hairline` | `rgba(124, 135, 155, .40)` | Dùng cho sợi tách mảnh (xem 2.5) |

### 2.3 Bảng token — DARK (khai báo trong `@media (prefers-color-scheme: dark)` và `[data-theme="dark"]`)

| Nhóm | Tên biến | Giá trị | Ghi chú |
|---|---|---|---|
| Nền | `--surface-0` | `#0B0E13` | Nền app |
| Nền | `--surface-1` | `#141821` | Card, khung bàn cờ |
| Nền | `--surface-2` | `#1C222D` | Nền chìm, track, input |
| Nền phụ | `--surface-tint-a` | `#13203A` | Ô A |
| Nền phụ | `--surface-tint-b` | `#2A2114` | Ô B |
| Nền phụ | `--surface-scrim` | `rgba(3, 5, 9, 0.64)` | |
| Chữ | `--text-primary` | `#F2F4F7` | |
| Chữ | `--text-secondary` | `#C3CAD6` | |
| Chữ | `--text-muted` | `#98A2B3` | |
| Chữ | `--text-on-accent` | `#0A1120` | **Chữ tối** trên nút primary sáng (không dùng trắng!) |
| Lưới | `--grid-line` | `#636F88` | |
| Lưới | `--grid-dot` | `#C3CAD6` | |
| Viền | `--border` | `#636F88` | |
| Viền | `--border-strong` | `#98A2B3` | |
| Người A | `--player-a` | `#7CA6FF` | Lam sáng |
| Người A | `--player-a-hover` | `#A6C2FF` | |
| Người A | `--player-a-pattern` | `rgba(124, 166, 255, 0.22)` | |
| Người B | `--player-b` | `#F5B54D` | Hổ phách sáng |
| Người B | `--player-b-hover` | `#FFD08A` | |
| Người B | `--player-b-pattern` | `rgba(245, 181, 77, 0.24)` | |
| Ô đã tô | `--box-a-bg` | `#13203A` | |
| Ô đã tô | `--box-a-border` | `#7CA6FF` | |
| Ô đã tô | `--box-b-bg` | `#2A2114` | |
| Ô đã tô | `--box-b-border` | `#F5B54D` | |
| Nhấn | `--accent` | `#93B4FF` | |
| Nhấn | `--accent-hover` | `#A9C3FF` | |
| Nhấn | `--accent-soft` | `#1E2B45` | |
| Focus | `--focus-ring` | `#93B4FF` | |
| Focus | `--focus-ring-gap` | `#0B0E13` | |
| Trạng thái | `--danger` | `#FF9C8F` | |
| Trạng thái | `--danger-soft` | `rgba(255, 156, 143, 0.14)` | |
| Trạng thái | `--success` | `#6FD79A` | |
| Trạng thái | `--success-soft` | `rgba(111, 215, 154, 0.14)` | |
| Toast | `--toast-bg` | `#1F2937` | |
| Toast | `--toast-text` | `#F2F4F7` | |
| Shadow | `--shadow-1` | `0 1px 2px rgba(0,0,0,.48), 0 1px 3px rgba(0,0,0,.40)` | |
| Shadow | `--shadow-2` | `0 12px 32px rgba(0,0,0,.56)` | |
| Đường viền 1px | `--hairline` | `rgba(99, 111, 136, .56)` | |

### 2.4 Kích thước, bo góc, khoảng cách, chuyển động (chung cả 2 theme)

| Nhóm | Tên biến | Giá trị |
|---|---|---|
| Thang 4px | `--space-1 … --space-12` | `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96` px |
| Bo góc | `--radius-xs` / `--radius-sm` / `--radius-md` / `--radius-lg` / `--radius-full` | `4` / `8` / `12` / `16` / `9999` px |
| Bo góc ô cờ | `--box-radius` | `8` px (mobile ≤ 400px: `6` px) |
| Vùng chạm | `--tap-min` | `44` px (tối thiểu, mọi thiết bị) |
| Vùng chạm lớn | `--tap-lg` | `48` px (nút trên HUD, nút trong bàn) |
| Cao nút | `--control-h` / `--control-h-lg` | `44` / `52` px |
| Viền mảnh | `--stroke-hairline` / `--stroke-1` / `--stroke-2` / `--stroke-3` | `1` / `1.5` / `2` / `3` px |
| Focus | `--focus-width` / `--focus-offset` | `2` px / `2` px |
| Chữ | `--font-sans` | xem §3.1 |
| Chuyển động | `--dur-fast` / `--dur-base` / `--dur-slow` | `120` / `200` / `320` ms |
| Chuyển động | `--ease-out` / `--ease-in-out` / `--ease-spring` | `cubic-bezier(.2,.7,.3,1)` / `cubic-bezier(.4,0,.2,1)` / `cubic-bezier(.34,1.4,.5,1)` |

### 2.5 Kết quả kiểm tra tương phản WCAG 2.1 — **ĐO THẬT**

**Công cụ:** `python3 designer_helper.py wcag <fg> <bg>` (helper của DSH, tính theo công thức relative luminance của W3C WCAG 2.1, trả `contrast_ratio` + `status`).
Mọi số dưới đây là **output thô** của công cụ, không phải số ước lượng. Ngưỡng áp dụng: chữ thường **≥ 4.5:1**, chữ lớn (≥ 18,66px bold hoặc ≥ 24px) **≥ 3:1**, thành phần phi văn bản quan trọng (đường lưới, viền ô, dot) **≥ 3:1** (WCAG 1.4.11).

#### LIGHT

| Tiền cảnh | Nền | Tỷ lệ đo được | Kết luận |
|---|---|---|---|
| `--text-primary` #111827 | surface-0 #F7F8FA | **16.69** | Đạt AAA |
| `--text-primary` #111827 | surface-1 #FFFFFF | **17.74** | Đạt AAA |
| `--text-primary` #111827 | surface-2 #EEF0F4 | **15.55** | Đạt AAA |
| `--text-secondary` #475569 | surface-0 #F7F8FA | **7.13** | Đạt AAA |
| `--text-secondary` #475569 | surface-1 #FFFFFF | **7.58** | Đạt AAA |
| `--text-secondary` #475569 | surface-2 #EEF0F4 | **6.64** | Đạt AA |
| `--text-muted` #5D6779 | surface-0 #F7F8FA | **5.37** | Đạt AA |
| `--text-muted` #5D6779 | surface-1 #FFFFFF | **5.70** | Đạt AA |
| `--text-muted` #5D6779 | surface-2 #EEF0F4 | **5.00** | Đạt AA |
| `--player-a` #2563EB | surface-0 #F7F8FA | **4.86** | Đạt AA |
| `--player-a` #2563EB | surface-1 #FFFFFF | **5.17** | Đạt AA |
| `--player-a` #2563EB | surface-2 #EEF0F4 | **4.53** | Đạt AA |
| `--player-b` #A3540A | surface-0 #F7F8FA | **5.16** | Đạt AA |
| `--player-b` #A3540A | surface-1 #FFFFFF | **5.48** | Đạt AA |
| `--player-b` #A3540A | surface-2 #EEF0F4 | **4.81** | Đạt AA |
| `--accent` #1D4ED8 | surface-0 #F7F8FA | **6.31** | Đạt AA |
| `--accent` #1D4ED8 | surface-1 #FFFFFF | **6.70** | Đạt AA |
| `--accent` #1D4ED8 | surface-2 #EEF0F4 | **5.87** | Đạt AA |
| `--danger` #B42318 | surface-0 / surface-1 / surface-2 | **6.19 / 6.57 / 5.76** | Đạt AA |
| `--success` #067647 | surface-0 / surface-1 / surface-2 | **5.36 / 5.69 / 4.99** | Đạt AA |
| `--focus-ring` #1D4ED8 | surface-0 / surface-1 / surface-2 | **6.31 / 6.70 / 5.87** | Đạt AA |
| `--text-on-accent` #FFFFFF | `--accent` #1D4ED8 (nút primary) | **6.70** | Đạt AA |
| `--text-on-accent` #FFFFFF | `--accent-hover` #1E40AF | **8.72** | Đạt AAA |
| `--text-primary` #111827 | `--accent-soft` #DCE6FD (chip đang chọn) | **14.18** | Đạt AAA |
| `--accent` #1D4ED8 | `--accent-soft` #DCE6FD | **5.35** | Đạt AA |
| `--toast-text` #F2F4F7 | `--toast-bg` #111827 | **16.10** | Đạt AAA |
| `--text-primary` #111827 | `--box-a-bg` #E8EEFD | **15.27** | Đạt AAA |
| `--text-primary` #111827 | `--box-b-bg` #FCEFD9 | **15.62** | Đạt AAA |
| `--box-a-border` #2563EB | `--box-a-bg` #E8EEFD (viền ô) | **4.45** | Đạt (phi văn bản, ngưỡng 3:1) |
| `--box-b-border` #A3540A | `--box-b-bg` #FCEFD9 (viền ô) | **4.83** | Đạt AA |
| `--grid-line` #7C879B | surface-0 / surface-1 / surface-2 | **3.41 / 3.62 / 3.18** | Đạt 3:1 (phi văn bản) |
| `--border` #7C879B | surface-0 / surface-1 / surface-2 | **3.41 / 3.62 / 3.18** | Đạt 3:1 |

#### DARK

| Tiền cảnh | Nền | Tỷ lệ đo được | Kết luận |
|---|---|---|---|
| `--text-primary` #F2F4F7 | surface-0 / surface-1 / surface-2 | **17.54 / 16.12 / 14.48** | Đạt AAA |
| `--text-secondary` #C3CAD6 | surface-0 / surface-1 / surface-2 | **11.73 / 10.77 / 9.68** | Đạt AAA |
| `--text-muted` #98A2B3 | surface-0 / surface-1 / surface-2 | **7.51 / 6.90 / 6.20** | Đạt AAA |
| `--player-a` #7CA6FF | surface-0 / surface-1 / surface-2 | **8.06 / 7.41 / 6.65** | Đạt AAA |
| `--player-b` #F5B54D | surface-0 / surface-1 / surface-2 | **10.68 / 9.81 / 8.81** | Đạt AAA |
| `--accent` #93B4FF | surface-0 / surface-1 / surface-2 | **9.40 / 8.64 / 7.76** | Đạt AAA |
| `--danger` #FF9C8F | surface-0 / surface-1 / surface-2 | **9.58 / 8.80 / 7.91** | Đạt AAA |
| `--success` #6FD79A | surface-0 / surface-1 / surface-2 | **10.92 / 10.03 / 9.01** | Đạt AAA |
| `--focus-ring` #93B4FF | surface-0 / surface-1 / surface-2 | **9.40 / 8.64 / 7.76** | Đạt AAA |
| `--text-on-accent` #0A1120 | `--accent` #93B4FF (nút primary) | **9.17** | Đạt AAA |
| `--text-on-accent` #0A1120 | `--accent-hover` #A9C3FF | **10.72** | Đạt AAA |
| `--text-primary` #F2F4F7 | `--accent-soft` #1E2B45 | **12.82** | Đạt AAA |
| `--accent` #93B4FF | `--accent-soft` #1E2B45 | **6.87** | Đạt AA |
| `--toast-text` #F2F4F7 | `--toast-bg` #1F2937 | **13.32** | Đạt AAA |
| `--text-primary` #F2F4F7 | `--box-a-bg` #13203A | **14.71** | Đạt AAA |
| `--text-primary` #F2F4F7 | `--box-b-bg` #2A2114 | **14.37** | Đạt AAA |
| `--box-a-border` #7CA6FF | `--box-a-bg` #13203A | **6.76** | Đạt 3:1 |
| `--box-b-border` #F5B54D | `--box-b-bg` #2A2114 | **8.75** | Đạt AA |
| `--grid-line` #636F88 | surface-0 / surface-1 / surface-2 | **3.83 / 3.52 / 3.16** | Đạt 3:1 |
| `--border` #636F88 | surface-0 / surface-1 / surface-2 | **3.83 / 3.52 / 3.16** | Đạt 3:1 |

> **Lưu ý đo trung thực (không giấu):**
> - `--hairline` (rgba 40%/56%) là sợi tách trang trí, khi blend trên nền sẽ cho tương phản **thấp hơn 3:1** (đo gián tiếp: `#D3D8E0` trên `#FFFFFF` = **1.43**). Đây là **được phép** vì không phải thành phần giao diện mang nghĩa (WCAG 1.4.11 yêu cầu 3:1 cho thành phần *cần thiết để nhận biết*). **Quy tắc bắt buộc:** mọi viền/ranh giới mang nghĩa (viền ô cờ, viền input đang focus, viền segmented) **phải dùng `--border` hoặc `--accent`, không dùng `--hairline`**.
> - **Chữ disabled** = `--text-muted` (đo 5.00 LIGHT / 6.20 DARK trên surface-2), **không** dùng `opacity: .4` trên chữ (WCAG miễn trừ disabled nhưng ta vẫn giữ ≥ 4.5:1 để người lớn tuổi đọc được).
> - Hai màu người chơi **gần bằng độ sáng**: `#2563EB` vs `#A3540A` = **1.06**, `#7CA6FF` vs `#F5B54D` = **1.32** → nếu **đổi sang ảnh xám** hai người gần như trùng nhau. Đây là lý do §2.6 bắt buộc ký hiệu + hoa tiết. Hoa tiết/viền (không phải nền tint) mới là tín hiệu chính, vì `--box-a-border` vs `--box-b-border` vẫn tách được nhờ hướng hoa tiết (chấm vs gạch chéo) — chi tiết ở §6.4.

### 2.6 Phân biệt người chơi khi mù màu đỏ-lục (deuteranopia)

Đỏ-lục (deuteranopia) làm lam và cam **không bị trộn lẫn** về mặt sắc (khác axis đỏ-lục), nhưng người mù màu **vẫn có thể nhầm khi độ sáng gần nhau** (đúng trường hợp ta vừa đo). Vì vậy tín hiệu nhận danh **không được phụ thuộc vào màu**:

| Trục nhận danh | Người A | Người B |
|---|---|---|
| Màu | `--player-a` (lam) | `--player-b` (cam đất / hổ phách) |
| Hình trong HUD | **Hình tròn** (vòng lam đặc, ring 2px) | **Hình tam giác** (tam giác đều cạnh 12px, hướng lên) |
| Hoa tiết trong ô đã tô | **Chấm** lưới 6×6 (dot 1,2px, bước 6px) | **Gạch chéo** 45°, độ dày 1px, bước 7px |
| Chữ trong ô (nếu bật `boxLabels`) | `A` | `B` |
| Dot tại giao điểm khi là "đầu cạnh vừa vẽ" | ring tròn | ring tròn (dùng chung) |
| Trong màn kết quả | Biểu tượng tròn + tên "Bạn"/"Máy"/"Người chơi 1" | Biểu tượng tam giác |

Quy tắc: **trong bất kỳ màn hình nào có cả 2 người, ký hiệu hình phải xuất hiện trước hoặc cùng cỡ với chấm màu.** Cấm thiết kế chỉ dùng một chấm màu tròn để báo lượt.

Khi bật `colorblindSafe: true` (mặc định **bật**): bàn cờ vẽ hoa tiết ngay cả khi hệ điều hành báo `prefers-color-scheme` bất kỳ, và tăng độ đậm hoa tiết lên 2 bước (`--player-*-pattern` ×1.5 alpha, cap 0.32).

---

## 3. Typography

### 3.1 Font stack hệ thống (không tải webfont, chạy offline)

```css
--font-sans: "SF Pro Text", -apple-system, BlinkMacSystemFont,
             "Segoe UI Variable Text", "Segoe UI", Roboto, "Helvetica Neue",
             "Noto Sans", "Segoe UI Emoji", Arial, sans-serif;
--font-num: "SF Pro Rounded", -apple-system, "Segoe UI", Roboto, sans-serif;
```

**Vì sao an toàn với tiếng Việt:** cả 5 font chính của stack (SF Pro, Segoe UI, Roboto, Helvetica Neue, Noto Sans, Arial) đều có bộ **Latin Extended Additional** đủ cho 134 ký tự dấu tiếng Việt, kể cả các tổ hợp hiếm `ế ộ ữ ẵ ỹ ợ`. Không dùng font "display"/condensed vì nhiều font loại này **thiếu glyph tiếng Việt** (rơi về tofu hoặc bị fallback sai kiểu).
**Không** đặt `font-display: block`, **không** dùng `letter-spacing` quá lớn trên chữ có dấu (dấu sắc/hỏi dễ va vào nhau). Với nhãn IN HOA, giới hạn `letter-spacing: 0.04em`.

### 3.2 Thang cỡ chữ (base 16px, modular ~1.2)

| Token | Cỡ | Line-height | Weight | Letter-spacing | Dùng cho |
|---|---|---|---|---|---|
| `--fs-display` | 40px (mobile 32px) | 1.1 | 700 | `-0.02em` | Điểm số lớn trong màn kết quả |
| `--fs-h1` | 28px (mobile 24px) | 1.2 | 700 | `-0.01em` | Tiêu đề màn hình (menu, kết quả) |
| `--fs-h2` | 20px | 1.3 | 600 | `0` | Tiêu đề modal, tên mục cài đặt |
| `--fs-body` | 16px | 1.5 | 400 | `0` | Nội dung, nhãn nút, mô tả |
| `--fs-body-strong` | 16px | 1.5 | 600 | `0` | Nhãn nút primary, số điểm HUD |
| `--fs-sm` | 14px | 1.45 | 400 | `0` | Nhãn segmented, phụ đề, caption |
| `--fs-xs` | 12px | 1.4 | 500 | `0.01em` | Nhãn trạng thái, badge "Bạn", đồng hồ nhỏ |
| `--fs-caps` | 11px | 1.4 | 600 | `0.04em` | Nhãn IN HOA duy nhất (vd "LƯỢT") |

**Quy tắc:** (1) Không bao giờ dùng chữ < 12px. (2) Chữ đo được ở 200% zoom phải không vỡ layout → dùng `rem` cho font-size, `px` cho viền/bo góc. (3) Số điểm dùng `font-variant-numeric: tabular-nums` để không nhảy width khi 9 → 10. (4) Không quá **3 weight** trong cùng một màn hình (400/600/700).

### 3.3 Khoảng cách chữ

- Body: `line-height: 1.5`. Tiêu đề lớn: `1.1–1.3` (giảm khi cỡ tăng).
- Đoạn văn dài (tutorial): `max-width: 62ch`, `line-height: 1.6`.
- Không dùng `text-align: justify` (tiếng Việt nhiều dấu → khoảng trắng xấu).

---

## 4. Layout & Responsive

### 4.1 Khung màn hình điện thoại 360×640 → 430×932

Cấu trúc dọc, một cột, `100dvh` (không dùng `100vh` để tránh thanh địa chỉ iOS che):

```
┌──────────────────────────────────────┐ ← safe-area-inset-top
│  HEADER  (56px)                      │  logo nhỏ + nút icon ⚙ Cài đặt (44×44)
├──────────────────────────────────────┤
│  HUD  (64px)                         │  [● A  3]  [⏱ 0:14]  [▲ B  5]
│    ┌────┐        ┌───────┐   ┌────┐  │  - người A: tròn + điểm (flex 1)
│    │● 3 │        │ 0:14  │   │▲ 5 │  │  - đồng hồ lượt ở GIỮA, nền chip
│    └────┘        └───────┘   └────┘  │  - người B: tam giác + điểm (flex 1, text-align right)
├──────────────────────────────────────┤
│                                      │
│  BOARD (flex: 1, canvas)             │  max-width: min(100%, 560px)
│  ┌──────────────────────────────┐    │  board = vuông, cạnh = min(width, height) - 2*16
│  │                              │    │  căn giữa, KHÔNG dùng object-fit
│  └──────────────────────────────┘    │
│                                      │
├──────────────────────────────────────┤
│  ACTION BAR (56px)                   │  Nút ghost "Ván mới" + "Gợi ý" + icon "Hoà/Đầu hàng"
├──────────────────────────────────────┤
│  AD RESERVE                          │  LUÔN chiếm --ad-reserve (50px)
│  ┌──────────────────────────────┐    │  → có/không banner đều giữ nguyên chiều cao
│  │  (320×50 hoặc adaptive)      │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘ ← safe-area-inset-bottom
```

**Chi tiết chừa chỗ quảng cáo (chống layout shift — yêu cầu bắt buộc):**
- Khung `#ad-slot` **luôn tồn tại** trong DOM với `height: var(--ad-reserve, 50px)` và **không bao giờ** thay đổi chiều cao khi banner hiện/ẩn.
- Khi không có banner: khung nền trong suốt (Generator `display: none` cho nội dung, **không** `display:none` cho wrapper).
- `--ad-reserve`: `50px` cho anchor banner cố định (320×50 / 320×100 → dùng `56px`); màn hình có `env(safe-area-inset-bottom) > 0` cộng thêm phần inset vào padding **bên trong** khung, không tăng `--ad-reserve`.
- Banner **adhesive** (dính đáy khi cuộn, mobile): cùng khung, `position: sticky; bottom: 0`, `z-index: 20`.
- Quy định CLS: **0** — mọi phần tử co giãn đặt trước kích thước (`aspect-ratio` cho canvas wrapper, `min-height` cho HUD).

### 4.2 Breakpoint

| Tên | Điều kiện | Thay đổi chính |
|---|---|---|
| `xs` | `< 360px` | `.app { padding-inline: 12px }`, `--fs-h1: 22px`, ẩn nhãn chữ của action bar chỉ còn icon (aria-label giữ nguyên) |
| `sm` | 360–479px | Bố cục chuẩn ở trên (mục tiêu chính) |
| `md` | 480–767px | Board max 560px, HUD 72px, action bar có nhãn chữ |
| `md+` | ≥ 768px, dọc | Board căn giữa `max-width: 560px`, thêm khoảng `--space-6` quanh board |
| `lg` | ≥ 1024px, ngang | **Hai cột**: cột trái 360px = HUD + cài đặt + banner; cột phải = board (`max-width: min(64vh, 640px)`); HUD chuyển thành panel dọc |
| `landscape-phone` | `orientation: landscape` và `height < 500px` | Ẩn header (thay bằng nút floating 44×44 góc trên phải), HUD dục ngang `height: 48px`, board `max-height: calc(100dvh - 48px - 56px - var(--ad-reserve))` |

Dùng `@media` theo nội dung (`min-width`) chứ không theo tên thiết bị.

### 4.3 Safe area iPhone (bắt buộc)

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

- Container gốc: `padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right);`
- Nút **cài đặt** và nút **đóng modal**: cách mép thêm **12px** ngoài safe area (`top: calc(env(safe-area-inset-top) + 12px)`).
- Banner ad: nằm **trên** vùng home-indicator, tức `bottom: env(safe-area-inset-bottom)`.
- Tai thỏ / notch ở chế độ landscape: dùng `env(safe-area-inset-left/right)` cho cột nội dung, không cho canvas (canvas vẫn bị giới hạn bởi padding của khung).

### 4.4 Vùng chạm

- Mọi phần tử tương tác: `min-width: 44px; min-height: 44px`. Nút HUD và "Ván mới": 48px.
- Khoảng cách giữa 2 vùng chạm kề nhau: **≥ 8px** (`--space-2`).
- Segmented control: mỗi đoạn cao 44px; nếu 6 lựa chọn kích thước bàn không vừa 1 hàng ở 360px → **wrap 2 hàng 3+3**, mỗi đoạn `flex: 1 1 30%`.
- Trên canvas: vùng "bắt" cạnh = **độ dày tối thiểu 28px** (vượt nét vẽ 2–3px rất nhiều), xem §6.6.
- Trên mobile, bỏ hẳn hover; preview cạnh chỉ kích hoạt khi `pointerup`/`pointerdown` chứ **không** trên `touchmove` (tránh highlight loạn khi cuộn).

---

## 5. Thành phần UI

Bảng trạng thái dùng ký hiệu: **H** hover · **A** active/pressed · **F** focus-visible · **D** disabled.

### 5.1 Nút

| Loại | Kích thước & dáng | Nền / chữ | H | A | F | D |
|---|---|---|---|---|---|---|
| **Primary** | cao 52px (`--control-h-lg`), padding `0 24px`, `--radius-md`, chữ `--fs-body-strong` | `--accent` / `--text-on-accent` | nền `--accent-hover`, `translateY(0)` | nền `--accent-hover`, `scale(.97)`, 90ms | ring 2px `--focus-ring` + halo 2px `--focus-ring-gap` | nền `--surface-2`, chữ `--text-muted`, `cursor: not-allowed`, không shadow |
| **Secondary** | cao 44px, `--radius-md` | `--surface-2` / `--text-primary`, viền 1px `--border` | nền `--surface-2` + `filter: brightness(.97)` | `scale(.97)` | như primary | như primary |
| **Ghost** | cao 44px, `--radius-md`, trong suốt | `transparent` / `--text-secondary` | nền `--surface-2`, chữ `--text-primary` | nền `--surface-2`, `scale(.97)` | như primary | chữ `--text-muted`, `opacity: .6` (bù lại vẫn ≥ 4.5:1 vì muted đã 5.0) |
| **Icon** | 44×44 (HUD: 48×48), `--radius-md`, `padding: 0` | `transparent`/`--text-secondary`, icon 24×24 stroke 2px | nền `--surface-2`, icon `--text-primary` | `scale(.94)` | như primary | icon `--text-muted`, không hover |
| **Danger (ghost)** | như ghost | chữ `--danger` | nền `--danger-soft` | `scale(.97)` | ring `--danger` | `--text-muted` |

Quy tắc focus dùng chung (một chỗ duy nhất, không lặp):

```css
:where(a, button, [role="button"], input, select, textarea, [tabindex]):focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
  box-shadow: 0 0 0 calc(var(--focus-width) + var(--focus-offset)) var(--focus-ring-gap);
}
```

Tất cả transition nút: `background-color var(--dur-fast) var(--ease-out), transform 90ms var(--ease-out)`.

### 5.2 Segmented control (kích thước bàn, độ khó, ai đi trước)

- Track: `background: var(--surface-2)`, `border-radius: var(--radius-md)`, `padding: 3px`, `display: flex; gap: 2px`.
- Đoạn: `flex: 1 1 auto`, cao **38px** bên trong (tổng 44px), `border-radius: calc(var(--radius-md) - 3px)`, chữ `--fs-sm` weight 500.
- **Mặc định:** chữ `--text-secondary`, nền trong suốt. **H:** nền `rgba(255,255,255,.06)` (dark) / `rgba(17,24,39,.05)` (light). **A:** `scale(.97)`.
- **Đang chọn:** nền `--surface-1` + `--shadow-1`, chữ `--text-primary` weight 600; ở light dùng `--accent-soft` nếu version "có sắc" (chọn 1 trong 2, **khuyến nghị `--accent-soft` cho đằm**). `aria-checked="true"` với `role="radio"` trong `role="radiogroup"`.
- **F:** ring trên từng đoạn (không ring cả track). **D:** chữ `--text-muted`, `aria-disabled="true"`.
- Thumb trượt khi đổi giữa 2 đoạn: `transform var(--dur-base) var(--ease-out)`; reduced-motion → không trượt.

### 5.3 Switch (bật/tắt giới hạn thời gian, nhạc, haptic)

- Track **44×26**, thumb **20×20**, `--radius-full`. **Luôn nằm trong một hàng cao ≥ 44px** (vùng chạm thực là cả hàng, bấm chữ cũng đổi).
- Tắt: track `--surface-2`, thumb `--text-muted`, viền 1px `--border`.
- Bật: track `--accent`, thumb `--surface-1` (light) / `--surface-0` (dark).
- H: track sáng/tối thêm 4%. A: thumb `scale(.92)`. F: ring quanh track. D: `opacity: .5` + không phản hồi.
- Thumb di chuyển `transform: translateX(18px)` trong `var(--dur-base) var(--ease-out)`; reduced-motion → đổi trạng thái tức thì (không trượt).
- `role="switch" aria-checked`.

### 5.4 Modal (cài đặt, xác nhận ván mới, kết quả nhỏ)

- Overlay: `--surface-scrim`, có `backdrop-filter: blur(2px)` **chỉ khi** `@media (prefers-reduced-transparency: no-preference)`.
- Panel: nền `--surface-1`, `--radius-lg`, `--shadow-2`, `max-width: 480px` (mobile: `calc(100% - 32px)`), `padding: var(--space-6)`.
- Mobile ≤ 480px: dùng **bottom sheet** (`align-items: flex-end`, bo trên `--radius-lg`, kéo xuống để đóng, tay nắm 36×4px `--border`).
- Vào: overlay fade 120ms + panel `translateY(8px)` → 0 và `opacity 0→1` trong 200ms `--ease-out`. Ra: 160ms đảo chiều.
- F: **focus trap** trong panel, `Esc` đóng, `aria-modal="true"`, `role="dialog"`, `aria-labelledby`. Khi đóng → trả focus về nút đã mở.
- Không cho đóng khi ván đang chạy nếu chưa xác nhận "Huỷ ván?" (dùng confirm modal 2 nút: Danger ghost + Primary).

### 5.5 Toast

- Vị trí: **trên action bar**, `bottom: calc(var(--ad-reserve) + 68px + env(safe-area-inset-bottom))`, căn giữa, `max-width: min(92%, 420px)`.
- Nền `--toast-bg`, chữ `--toast-text` (đo 16.10 / 13.32), `--radius-md`, `padding: 10px 16px`, `--shadow-2`, icon 18px bên trái.
- Vào: `translateY(12px) + opacity 0 → 1` trong 200ms; ra: `opacity → 0` 160ms sau **2400ms**. Xếp chồng tối đa **1** toast cùng lúc (toast mới thay toast cũ).
- `role="status" aria-live="polite"` (không dùng assertive trừ lỗi mất lượt: `role="alert"`).
- Nội dung mẫu: "Đã bật giới hạn 20 giây/lượt" · "Hết giờ — mất lượt" · "Đã lưu cài đặt".

### 5.6 Empty state

3 chỗ dùng: menu khi chưa có ván nào để "Chơi tiếp", danh sách thành tích (nếu có), và màn hình kết quả khi huỷ giữa ván.

- Bố cục giữa: icon stroke 48×48 `--text-muted` (khung lưới vuông 3×3 rỗng) → tiêu đề `--fs-h2` `--text-primary` → mô tả 1 câu `--fs-sm` `--text-secondary` `max-width: 34ch` → 1 nút Primary.
- Không minh hoạ nhiều màu, không hình người.

### 5.7 Màn hình kết quả

```
┌───────────────────────────────┐
│        (kết quả lớn)          │  "Bạn thắng!" / "Hoà" / "Máy thắng"
│                               │  --fs-h1, --text-primary
│   ● Bạn   5      3   ▲ Máy    │  hai khối cột, số dùng --fs-display,
│   ──────────  ──────────      │  ký hiệu tròn/tam giác TRƯỚC số
│   Thắng 5–3 sau 12 lượt       │  --fs-sm --text-secondary
├───────────────────────────────┤
│  [ Ván mới ]  (Primary)       │  full-width 52px
│  [ Xem lại bàn ] (Ghost)      │  44px
├───────────────────────────────┤
│  AD SLOT (cùng --ad-reserve)  │  banner được phép ở đây (theo BRIEF)
└───────────────────────────────┘
```

- Hiệu ứng vào: khối điểm số đếm **từng bước** từ 0 đến điểm thật trong 480ms (`--ease-out`), hai cột **không** dịch chuyển (giữ chỗ bằng `tabular-nums`).
- Nút "Ván mới" tự focus (`autofocus`) để chơi lại bằng Enter.
- Interstitial (nếu AdBridge quyết định hiện) **chỉ sau khi màn hình này đã render xong** và người chơi thấy kết quả ≥ 1.2s.

### 5.8 Màn hình menu

- Trên cùng: tên game `Dots & Boxes` (`--fs-h1`) + phụ đề tiếng Việt "Cờ Ô Vuông" (`--fs-sm --text-secondary`).
- Thẻ "Chơi nhanh" (Primary, 52px, full width) — luôn là hành động đầu tiên.
- Hai nút Secondary: "Chơi với máy" / "2 người".
- Nhóm cài đặt rút gọn ngay trên menu: kích thước bàn (segmented), độ khó (segmented, chỉ hiện khi chế độ máy), ai đi trước (segmented: Bạn / Máy / Oẳn tù tì), switch giới hạn thời gian.
- Icon button ⚙ Cài đặt (44×44) mở modal đầy đủ (âm thanh, haptic, theme, tutorial, giới thiệu).
- Footer: nút Theme (icon mặt trời/trăng/hệ thống, 44×44) + link "Hướng dẫn" + "Âm thanh: Bật/Tắt" (dạng chip).
- Ad slot ở đáy menu (theo BRIEF).
- Nút "Oẳn tù tì" khi chọn: hiệu ứng 3 pha 480ms (kéo → búa → bao thu nhỏ), rồi toast kết quả "Bạn thắng oẳn tù tì — đi trước".

---

## 6. Đặc tả Canvas

### 6.1 Thiết lập tỉ lệ (DPR cap 2x)

```js
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const rect = wrapper.getBoundingClientRect();
canvas.width  = Math.round(rect.width  * dpr);
canvas.height = Math.round(rect.height * dpr);
canvas.style.width  = rect.width + 'px';
canvas.style.height = rect.height + 'px';
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // từ đây vẽ theo đơn vị CSS px
ctx.imageSmoothingEnabled = true;
```

- Mọi toạ độ trong `render.js` tính theo **CSS px**, không tự nhân dpr.
- Pixel snapping để nét 1px không nhoè: với nét lẻ, cộng `0.5 / dpr` vào toạ độ hoặc dùng `ctx.translate(0.5/dpr, 0.5/dpr)` — chỉ áp cho đường **thẳng** (dot tròn không cần).
- `ResizeObserver` trên wrapper → debounce 80ms → resize + vẽ lại toàn bộ (không animate lại cạnh đã có, chỉ hiển thị trạng thái cuối).

### 6.2 Hình học bàn cờ

Với bàn `n × n` ô, lưới điểm `(n+1) × (n+1)`:

```
boardSize = min(wrapperW, wrapperH) - 2 * PAD
step      = boardSize / n                 // khoảng cách tâm 2 dot kề nhau
origin    = (offsetX, offsetY)            // tâm dot (0,0)
dot(i, j) = origin + (i * step, j * step)
```

| Tham số | Giá trị | Ghi chú |
|---|---|---|
| `PAD` (khung chừa mép) | **16px** mobile, **20px** desktop | chừa chỗ cho dot to + nét viền ô |
| `step` (bàn 5×5 @ 360px) | `(328 - 32) / 5 ≈ 59.2px` | bàn 8×8 @ 360px ≈ 37px → vùng bắt cạnh vẫn đủ 28px |
| `step` tối thiểu | **32px** | nếu nhỏ hơn → thu `PAD` trước, rồi giảm `--box-radius` |
| Vùng bắt cạnh | `min(28, step * 0.6)` px mỗi bên | cho cả cạnh ngang và dọc, ưu tiên cạnh gần con trỏ nhất |

### 6.3 Bảng thông số vẽ

| Thành phần | Token JS (`config.js`) | Giá trị (CSS px) | Chi tiết |
|---|---|---|---|
| **Dot** (chưa chạm) | `DOT_R` | **2.5** (bàn ≤ 5×5) / **2** (≥ 6×6) | `arc` đặc, màu `--grid-dot` |
| Dot (một cạnh kề vừa được vẽ) | `DOT_R_ACTIVE` | **4** (x2.5 với hiệu ứng) | màu `--player-*`, viền ring ngoài 1px cùng màu alpha .35 |
| Dot (là giao của vùng chạm cuối) | — | — | không đổi màu để tránh nhiễu; chỉ scale |
| **Cạnh chưa vẽ** | — | không vẽ | khoảng trống giữa các dot chính là "cạnh chưa nối" và người chơi *bấm vào khoảng trống* |
| **Cạnh đã vẽ** | `EDGE_W` | **3** (bàn ≤ 5×5) / **2.5** (≥ 6×6) | `lineCap: round`, màu `--player-*`, co từ tâm dot đến tâm dot |
| Cạnh đã vẽ **giao nhau** với cạnh khác | — | +0.5 | để mối nối tròn liền mạch (lineJoin round tự lo) |
| **Viền ngoài đã tô sẵn** | `BORDER_W` | **4** | màu `--border-strong`, `lineCap: square`, vẽ **trước** mọi thứ, không hover, không click, không tính điểm |
| **Ô đã tô — nền** | — | inset `step * 0.09` | `roundRect(r, --box-radius)` fill `--box-a-bg` / `--box-b-bg` |
| **Ô đã tô — viền** | `BOX_BORDER_W` | **1.5** | stroke `--box-a-border` / `--box-b-border`, cùng `roundRect` |
| **Bo góc ô** | `BOX_RADIUS` | **8** (≤ 400px: **6**) | `ctx.roundRect` có fallback path thủ công cho Safari < 16.4 |
| **Hoa tiết ô A** | `PATTERN_DOT_R` / `PATTERN_DOT_GAP` | **1.2** / **6** | lưới chấm 6×6 trong vùng bo góc, clip theo `roundRect` |
| **Hoa tiết ô B** | `PATTERN_LINE_W` / `PATTERN_LINE_GAP` | **1** / **7** | gạch chéo 45°, clip theo `roundRect` |
| **Nhãn A/B trong ô** | `BOX_LABEL_FS` | **11px** weight 600 | chỉ khi `boxLabels` bật; màu `--box-*-border`, căn giữa ô |
| **Preview cạnh hover** | `PREVIEW_W` | **3** (giống `EDGE_W`) | màu `--player-current` với `alpha 0.45`, `lineCap: round`, dash **không** dùng |
| **Preview ô sẽ bị đóng** (nếu hover hoàn tất 1–2 ô) | `PREVIEW_BOX_ALPHA` | **0.35** | fill tint của người đang đi + viền nét đứt 4/3 |
| **Highlight cạnh vừa tô** | `HIGHLIGHT_W` | `EDGE_W + 3` | ring `--player-*` alpha .50 → 0 trong **320ms** |
| **Focus ring trên canvas** (bàn phím) | `FOCUS_RING_W` / `FOCUS_RING_OFFSET` | **2** / **2** | `--focus-ring`, chỉ vẽ quanh cạnh đang được chọn bằng phím |
| **Text trên canvas** | — | — | chỉ dùng cho nhãn ô A/B; mọi chữ khác là DOM |

### 6.4 Thứ tự vẽ (z-order) — bắt buộc theo đúng thứ tự này

1. Xoá sạch (`clearRect` toàn bộ theo kích thước CSS px, không theo backing store).
2. **Nền bàn** (nếu có nền khác surface: nền luôn là `--surface-1` của card → không vẽ, để CSS lo).
3. **Viền ngoài đã tô sẵn** — `--border-strong`, `BORDER_W`, vẽ 4 đoạn liền mạch (`lineJoin: round`).
4. **Ô đã tô** — fill tint + stroke viền (bo góc) + hoa tiết (clip) + nhãn A/B. Vẽ **trước** dot/cạnh để cạnh nằm trên viền ô (nhìn sạch hơn).
5. **Preview ô sẽ đóng** (alpha thấp).
6. **Cạnh đã vẽ** của cả 2 người (round cap).
7. **Preview cạnh hover** của người đang đi.
8. **Dot** (tất cả; dot active của nước vừa đi có scale).
9. **Highlight cạnh vừa đi** (ring mờ dần) — vẽ cuối để không bị che.
10. **Focus ring bàn phím**.

Lý do **dot vẽ trên cạnh**: dot tròn nhỏ đè lên mối nối làm các nút giao trông gọn và "sạch" hơn (đúng tinh thần lưới), đồng thời che phần anti-alias lệch của 2 cạnh vuông góc.

### 6.5 Màu theo trạng thái (map sang token)

```js
const style = {
  borderStroke: cssVar('--border-strong'),
  dot:          cssVar('--grid-dot'),
  dotOnDark:    cssVar('--surface-2'),      // halo cho dot active
  edge:   { a: cssVar('--player-a'), b: cssVar('--player-b') },
  edgeHover:{ a: cssVar('--player-a-hover'), b: cssVar('--player-b-hover') },
  boxFill:{ a: cssVar('--box-a-bg'), b: cssVar('--box-b-bg') },
  boxStroke:{a: cssVar('--box-a-border'), b: cssVar('--box-b-border') },
  pattern:{ a: cssVar('--player-a-pattern'), b: cssVar('--player-b-pattern') },
  focus:  cssVar('--focus-ring'),
};
// viết 1 lần trong init(), đọc lại khi đổi theme (CustomEvent 'themechange')
```

`cssVar()` = `getComputedStyle(document.documentElement).getPropertyValue(name).trim()`. **Không hardcode hex trong `render.js`** — đổi theme phải vẽ lại bàn mà không reload.

### 6.6 Tương tác: chọn cạnh

- **Chuột:** `pointermove` → tính cạnh gần nhất trong bán kính bắt; nếu không có → xoá preview.
- **Chạm:** `pointerdown` chỉ **highlight**, `pointerup` trên cùng cạnh mới **đi**. Cho phép kéo-huỷ: đi ra khỏi cạnh rồi thả → huỷ nước (giảm bấm nhầm).
- Ngưỡng chống cuộn: `touch-action: none` trên canvas + `touch-action: pan-y` trên wrapper để vẫn cuộn trang được ở mép bàn.
- **Bàn phím:** mỗi cạnh là 1 "ô" logic; mũi tên di chuyển giữa các cạnh (theo lưới cạnh), `Enter`/`Space` chọn. Vẽ focus ring quanh cạnh được chọn (bảng 6.3). Cùng lúc, một `<div role="grid">` ẩn (visually-hidden) cung cấp `aria-label` cho trình đọc màn hình (vd "Cạnh ngang hàng 2 cột 3, chưa vẽ"). Canvas có `aria-hidden="true"`.
- Cạnh đã vẽ / viền ngoài: không nhận focus, không nhận preview.
- Khi đang animate (cạnh đang vẽ dở) vẫn **nhận input** — input được xếp hàng đợi và xử lý ngay sau animation kết thúc (không khoá người chơi).

---

## 7. Hiệu ứng hình ảnh (motion)

### 7.1 Danh sách hiệu ứng & thông số

| # | Tên | Trigger | Thời lượng | Easing / công thức | Chi tiết | Reduced-motion |
|---|---|---|---|---|---|---|
| E1 | **Edge draw** (cạnh vẽ ra) | Người chơi chọn cạnh | **160ms** | `easeOutCubic` `1-(1-t)^3` | Từ tâm dot đầu → tâm dot cuối; đồng thời alpha 0→1 trong 60ms đầu. Hai dot đầu mút scale 1→1.35→1.0 | **TẮT** — hiện cạnh tức thì |
| E2 | **Box close** (ô đóng lại) | Cạnh cuối cùng của ô được vẽ | **260ms** | `easeOutBack` (`c1=1.4`) cho scale; `easeOutQuad` cho alpha | Ô fill scale 0.92→1.0 + opacity 0→1; viền vẽ theo **chu vi** từ góc trên-trái, 260ms; hoa tiết fade 0→1 trong 160ms trễ 100ms | **TẮT** — hiện ô đầy đủ, alpha 1 ngay |
| E3 | **Box pop** (nảy nhẹ) | Ngay sau E2 kết thúc | **180ms** | `cubic-bezier(.34,1.56,.64,1)` | Scale 1.0 → **1.04** → 1.0. Tối đa 1 lần/ô | **TẮT** |
| E4 | **Score tick** (điểm nhảy) | Điểm thay đổi | **320ms** | `easeOutCubic` | Số đếm tăng dần (DOM `textContent`), `translateY(-4px)` lên → về 0, `scale 1 → 1.12 → 1`, màu chữ chuyển **tức thì** sang `--player-*` rồi về `--text-primary` sau 500ms | **TẮT** — nhảy số tức thì |
| E5 | **Combo chain** (tô nhiều ô liên tiếp) | Số ô đóng trong cùng lượt ≥ 2 | Bội số của E2 | `cubic-bezier(.34,1.4,.5,1)` | Ô thứ `k` đóng trễ `k * 90ms` so với E2 gốc (cap tổng 480ms). Ô kế tiếp pop mạnh hơn: scale đỉnh = `1.04 + min(0.06, 0.02*(k-1))`. Mỗi ô thêm 1 vòng ring `--player-*` alpha .35 mở rộng 1.0→1.25 và fade trong 320ms. Badge combo DOM ("Chuỗi ×3") xuất hiện ở giữa trên bàn, `scale 0.8→1 + opacity` 200ms, giữ 1200ms rồi fade 200ms | **GIẢM MẠNH** — không trễ, không ring, chỉ crossfade badge 120ms |
| E6 | **Turn swap** (đổi lượt) | Lượt chuyển người | **240ms** | `easeInOut` | Chỉ báo lượt ở HUD: khối người sắp đi nền `--surface-2` → `--accent-soft`, chữ weight 500→700; khối người vừa đi nền về trong suốt. Đồng hồ reset: thanh/progress bar fill từ 100% → 0 với `linear` trong suốt thời gian lượt | **GIẢM** — chỉ đổi màu tức thì, không transition |
| E7 | **Haptic** (rung — mobile) | Xem bảng dưới | — | — | `navigator.vibrate()`; iOS Safari **không hỗ trợ** `vibrate` → no-op, có thể dùng Cap `Haptics` sau | **TẮT** (ưu tiên: `prefers-reduced-motion` **hoặc** cài đặt Haptic tắt) |
| E8 | **Screen transition** (chuyển cảnh) | Menu ↔ bàn ↔ kết quả | **280ms** vào / **200ms** ra | `easeOutCubic` | Cảnh mới: `opacity 0→1` + `translateY(12px)→0`. Cảnh cũ: `opacity 1→0` + `translateY(0)→-8px`. Khung bàn cờ **giữ nguyên vị trí** (dùng `View Transitions API` nếu có, fallback crossfade) | **GIẢM** — chỉ crossfade 120ms, không dịch chuyển |

### 7.2 Haptic pattern (E7) — chỉ khi bật, không rung liên tục

| Sự kiện | Pattern (ms) | Ghi chú |
|---|---|---|
| Vẽ 1 cạnh | `10` | nhẹ, dưới ngưỡng "ồn" |
| Đóng 1 ô | `18` | rõ hơn |
| Combo k ô | `18, 40, 18` (lặp theo `k-1`, cap 3 nhịp) | cảm giác "máy đang chạy" |
| Hết giờ mất lượt | `30, 60, 30` | cảnh báo |
| Thắng ván | `12, 30, 12, 30, 60` | chuỗi ăn mừng ngắn |

Quy tắc: không rung khi đang có reduced-motion, khi cài đặt Haptic = tắt, hoặc khi tab ẩn (`document.hidden`).

### 7.3 Hành vi bắt buộc khi `prefers-reduced-motion: reduce`

Đây là **yêu cầu QC**, không phải tùy chọn. Dev phải khai báo **một** media query toàn cục (xem §10) và trong `render.js` đọc `motionQuery.matches` để chọn nhánh vẽ:

| Hạng mục | Hành vi |
|---|---|
| E1, E2, E3, E4 | Tắt hoàn toàn → kết quả cuối hiển thị ngay ở frame kế tiếp (~16ms) |
| E5 Combo | Không trễ theo `k`; các ô hiện cùng lúc; badge hiện/fade bằng crossfade 120ms, không scale |
| E6 | Đổi màu tức thì; đồng hồ vẫn **đếm** (đó là thông tin, không phải trang trí) |
| E7 Haptic | Tắt (trừ khi người dùng bật thủ công ở nơi không có reduced-motion) |
| E8 | Crossfade 120ms `opacity` only, không translate |
| CSS transition toàn cục | `0.01ms !important` + `animation-duration: 0.01ms !important` + `scroll-behavior: auto` (chuẩn phổ biến), **trừ** spinner và thanh đồng hồ (đánh dấu bằng `.motion-essential`) |
| Canvas | `render.js` không khởi tạo rAF-loop khi không có animation nào cần vẽ → chỉ vẽ lại khi state đổi (tiết kiệm pin) |
| Nghe thay đổi live | `motionQuery.addEventListener('change', ...)` → cập nhật cờ ngay, không cần reload |

---

## 8. Iconography & âm thanh

### 8.1 Quy định icon

- **SVG inline, stroke 2px, `stroke-linecap: round`, `stroke-linejoin: round`, `fill: none`**, viewBox `0 0 24 24`, màu `currentColor`. Tuyệt đối **không icon font** (không tải được offline, không kiểm soát metric).
- Kích thước: 24×24 trong nút 44×44; 20×20 trong toast/chip; 48×48 trong empty state (stroke vẫn 2px → phóng to bằng viewBox, không tăng stroke).
- Không dùng icon riêng lẻ **không có nhãn** nếu nghĩa không hiển nhiên: mọi icon-only phải có `aria-label` + `title`.

| Icon | Mô tả stroke (dựng tay bằng SVG) | Dùng ở |
|---|---|---|
| `settings` (bánh răng) | 1 vòng tròn r=3 + 8 nan ngắn ở các góc | Header |
| `sun` | Tròn r=5 + 8 tia dài 2px | Chuyển theme → light |
| `moon` | Cung tròn mở (nửa trăng khuyết) đơn giản | → dark |
| `monitor` (hệ thống) | Khung chữ nhật 16×10 bo 2 + chân 6px | → theo hệ thống |
| `timer` | Tròn r=9 + 2 kim (về 12h và 4h) | HUD giới hạn thời gian |
| `refresh` / `new-game` | Cung tròn 270° + mũi tên 2 nét | "Ván mới" |
| `bulb` / `hint` | Bóng đèn: tròn nhỏ + 2 nét chân | "Gợi ý" |
| `play` | Tam giác đặc (fill) — ngoại lệ duy nhất dùng fill | "Chơi nhanh" |
| `pause` | 2 vạch dọc | Tạm dừng |
| `arrow-left` | Chevron 2 nét | Quay lại |
| `close` (×) | 2 nét chéo 14px | Đóng modal/toast |
| `user` | Tròn r=4 + cung vai r=7 | "Bạn" / 2 người |
| `cpu` / `robot` | Chữ nhật bo 4 + 2 chấm mắt + ăng-ten | "Chơi với máy" |
| `volume-on` / `volume-off` | Loa: tam giác + 2 cung; tắt: thêm nét chéo | Âm thanh |
| `trophy` | Cốc có 2 quai nhỏ | Kết quả thắng |
| `equal` (hoà) | 2 vạch ngang | Kết quả hoà |
| `clock-alert` | `timer` + nét nhấn `--danger` ở kim | Hết giờ |
| `grid-plus` | Lưới 3×3 + 1 dấu `+` nét mảnh | Empty state "Chưa có ván" |

Nguồn shape: tự dựng path trong `ui.js` (không copy bộ icon có license). Mỗi icon export functional `icon(name, size)` trả `SVGElement`.

### 8.2 Hình khối người chơi (kí hiệu — phần của hệ thống)

| | SVG |
|---|---|
| **A — Tròn** | `<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/>` + 1 chấm đặc r=2 ở tâm |
| **B — Tam giác** | `<path d="M12 5 L19 18 L5 18 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>` |

Hai ký hiệu này trông rõ khác biệt **cả khi in đen trắng** (test bằng `filter: grayscale(1)`).

### 8.3 Âm thanh (Web Audio — thuộc trải nghiệm, không phải phụ lục)

Nguyên tắc: âm thanh **ngắn, mềm, không chói**; mọi âm SFX ≤ 120ms, tổng gain ≤ 0.25 (map với BGM qua `gainNode` giữ `bgm` ≤ 0.08 để không lấn).

| Sự kiện | Âm | Đặc tả tần số / hình bao |
|---|---|---|
| Vẽ cạnh | "tick" | Sine 660Hz, attack 2ms, decay 80ms, gain 0.12 |
| Đóng ô | "tock" | Triangle 380Hz + sine 760Hz (harmonic nhẹ), decay 140ms |
| Combo ô thứ k | tăng dần | Cùng "tock" nhân cao độ `×2^(k/12)` (mỗi ô lên 1 nửa cung), cap k=6 |
| Đổi lượt | rất nhẹ | Sine 440Hz, 60ms, gain 0.06 |
| Hết giờ | nhắc | Square 220Hz 100ms + sine 165Hz 140ms, gain 0.10 |
| Thắng | chuỗi 3 nốt | Sine arpeggio 523→659→784Hz, mỗi nốt 110ms, gain 0.14 |
| Hoà | 2 nốt | Sine 440→440Hz (giống nhau), gain 0.10 |
| Bấm nút | "blip" | Sine 520Hz, 40ms, gain 0.05 |

- Bật/tắt **riêng** nhạc nền và SFX (2 switch). Mặc định: SFX bật, BGM bật, âm lượng 60%.
- Autoplay policy: `AudioContext` khởi tạo ở **lần chạm đầu tiên**; trước đó hiện chip "Chạm để bật âm thanh" (không phải modal).
- `prefers-reduced-motion` **không** tắt âm thanh (âm thanh là trải nghiệm chính, không phải motion).
- SFX **không** là kênh thông tin duy nhất: mọi sự kiện có âm đều có phản hồi thị giác tương ứng.

---

## 9. Bảng Do / Don't (QC chấm điểm)

| # | ✅ DO | ❌ DON'T | Điểm QC nếu sai |
|---|---|---|---|
| 1 | Mỗi hành động có **một** phản hồi thị giác | Chồng 2–3 hiệu ứng lên 1 sự kiện (scale + glow + confetti) | Major |
| 2 | Ô tô bằng **tint nhạt** + viền đậm + hoa tiết | Tô ô đặc màu bão hòa 100% | Major |
| 3 | Phân biệt người chơi bằng **màu + hình + hoa tiết** | Chỉ dùng màu; chỉ dùng chấm tròn để báo lượt | Critical |
| 4 | Mọi cặp chữ/nền ≥ 4.5:1 (đo bằng helper) | Tin vào cảm giác "trông đủ đậm" | Critical |
| 5 | Viền/ranh giới mang nghĩa dùng `--border`/`--accent` (≥3:1) | Dùng hairline mờ cho viền ô cờ | Major |
| 6 | Vùng chạm ≥ 44×44, cách nhau ≥ 8px | Nút icon 24×24 không padding | Critical |
| 7 | Chừa `--ad-reserve` cố định, banner hiện không đổi layout | Chen banner bằng `position: fixed` đè lên nút, hoặc để layout nhảy (CLS > 0) | Critical |
| 8 | `env(safe-area-inset-*)` cho header/footer/banner | Nút cài đặt chui dưới tai thỏ | Major |
| 9 | Theme theo hệ thống + `data-theme` ghi đè + lưu localStorage | Chỉ có light, hoặc mặc định dark bất chấp hệ thống | Major |
| 10 | `render.js` đọc màu qua CSS var, nghe sự kiện đổi theme | Hardcode hex trong canvas | Major |
| 11 | DPR cap **2x**; nét lẻ snap 0.5px | DPR 3x đầy đủ (mobile tầm trung tụt fps) | Major |
| 12 | `prefers-reduced-motion` → tắt E1–E5, crossfade E8 | "Tắt animation là xong" mà quên canvas rAF loop | Critical |
| 13 | Focus ring 2px + offset 2px + halo, hiện trên **mọi** nền | `outline: none` không thay thế | Critical |
| 14 | Font system stack, tiếng Việt có dấu đầy đủ | Tải webfont, dùng font condensed thiếu glyph | Critical |
| 15 | Icon SVG stroke inline | Icon font / emoji làm icon chức năng | Major |
| 16 | Chữ disabled vẫn đọc được (`--text-muted`) | `opacity: .3` toàn bộ nút | Minor |
| 17 | Toast 1 cái/lúc, 2.4s, `aria-live="polite"` | Toast chồng 5 cái, che bàn cờ | Major |
| 18 | Màn kết quả **giữ đúng chỗ** bàn cờ, CTA đã focus | Bật interstitial che kết quả trước khi người chơi thấy điểm | Critical |
| 19 | Số điểm `tabular-nums` | Số nhảy width làm HUD giật | Minor |
| 20 | 60fps trên máy tầm trung: chỉ vẽ lại khi state đổi | `requestAnimationFrame` chạy vô hạn khi đứng yên | Major |
| 21 | Bàn 8×8 vẫn bấm chuẩn (cạnh ≥ 28px vùng bắt) | Thu bàn để vừa nhưng cạnh chỉ 12px | Major |
| 22 | Màu nhấn = 1 lam (+ cam cho người B) | Thêm màu thứ 3 để "cho sinh động" | Major |
| 23 | Gradient/glow: cấm; shadow ≤ 2 tầng, opacity ≤ .10 | Neon, glassmorphism nặng, vát 3D | Major |
| 24 | Copy tiếng Việt ngắn, có dấu, không kỹ thuật | "P2 turn ended", "Score: 5" | Minor |
| 25 | Âm thanh có công tắc riêng + bắt đầu sau chạm đầu | Tự phát nhạc khi load (bị chặn, lỗi console) | Major |
| 26 | Kiểm tra 360×640, 430×932, 1024×768, zoom 200%, và grayscale | Chỉ test trên MacBook | Critical |

**Thang chấm gợi ý (QC):** Critical = −15, Major = −5, Minor = −1 (khởi điểm 100). Bất kỳ mục Critical nào còn → không duyệt.

---

## 10. Snippet CSS mẫu (copy nguyên khối vào `src/styles.css`)

Đây là khối duy nhất Dev copy trực tiếp. Cấu trúc 5 tầng, **giữ đúng thứ tự**:

1. `:root` — bảng LIGHT dưới dạng nguyên liệu `--l-*` + toàn bộ token kích thước/chữ/motion.
2. Nhóm selector áp bảng LIGHT → `--surface-0`, `--text-primary`… (tên component dùng).
3. `@media (prefers-color-scheme: dark)` — bảng DARK theo hệ thống (loại trừ khi đã ghim light).
4. `:root[data-theme="dark"]` — ghim dark khi hệ thống đang sáng.
5. `:root[data-theme="light"]` — ghim light khi hệ thống đang tối (phải đứng cuối).

Dùng `--l-*` làm nguyên liệu để **hex của LIGHT chỉ xuất hiện một lần**, tránh lệch bảng khi Dev sửa. Base/`body`/focus-ring/reduced-motion nằm ở §5.1, §4.3 và §7.3 để không phình snippet.

```css
/* ==========================================================================
   Dots & Boxes — design tokens. Nguồn: docs/20-DESIGN.md §2 (đã đo WCAG ở §2.5)
   data-theme trên <html>: "light" | "dark" | không set = theo hệ thống
   Thứ tự bắt buộc: :root → @media dark → [data-theme=dark] → [data-theme=light]
   ========================================================================== */

/* 1) LIGHT — bảng gốc. --l-* là "nguyên liệu" thô, --surface-* v.v. là bảng đang áp dụng */
:root {
  color-scheme: light dark;
  --l-surface-0:#F7F8FA; --l-surface-1:#FFFFFF; --l-surface-2:#EEF0F4;
  --l-surface-tint-a:#E8EEFD; --l-surface-tint-b:#FCEFD9; --l-surface-scrim:rgba(17,24,39,.40);
  --l-text-primary:#111827; --l-text-secondary:#475569; --l-text-muted:#5D6779; --l-text-on-accent:#FFFFFF;
  --l-grid-line:#7C879B; --l-grid-dot:#475569; --l-border:#7C879B; --l-border-strong:#475569; --l-hairline:rgba(124,135,155,.40);
  --l-player-a:#2563EB; --l-player-a-hover:#1D4ED8; --l-player-a-pattern:rgba(37,99,235,.16);
  --l-player-b:#A3540A; --l-player-b-hover:#7C3E06; --l-player-b-pattern:rgba(163,84,10,.18);
  --l-box-a-bg:#E8EEFD; --l-box-a-border:#2563EB; --l-box-b-bg:#FCEFD9; --l-box-b-border:#A3540A;
  --l-accent:#1D4ED8; --l-accent-hover:#1E40AF; --l-accent-soft:#DCE6FD; --l-focus-ring:#1D4ED8; --l-focus-ring-gap:#FFFFFF;
  --l-danger:#B42318; --l-danger-soft:rgba(180,35,24,.10); --l-success:#067647; --l-success-soft:rgba(6,118,71,.10);
  --l-toast-bg:#111827; --l-toast-text:#F2F4F7;
  --l-shadow-1:0 1px 2px rgba(17,24,39,.06),0 1px 3px rgba(17,24,39,.08); --l-shadow-2:0 8px 24px rgba(17,24,39,.10);

  /* kích thước/chữ/motion — KHÔNG đổi theo theme */
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:20px;
  --space-6:24px; --space-8:32px; --space-10:40px; --space-12:48px; --space-16:64px;
  --radius-xs:4px; --radius-sm:8px; --radius-md:12px; --radius-lg:16px;
  --radius-full:9999px; --box-radius:8px;
  --tap-min:44px; --tap-lg:48px; --control-h:44px; --control-h-lg:52px;
  --stroke-1:1.5px; --stroke-2:2px; --stroke-3:3px;
  --focus-width:2px; --focus-offset:2px;
  --ad-reserve:50px; /* banner 320x50 · 320x100 dùng 56px · KHÔNG đổi lúc runtime */
  --dur-fast:120ms; --dur-base:200ms; --dur-slow:320ms;
  --ease-out:cubic-bezier(.2,.7,.3,1); --ease-in-out:cubic-bezier(.4,0,.2,1);
  --ease-spring:cubic-bezier(.34,1.4,.5,1);
  --font-sans:"SF Pro Text",-apple-system,BlinkMacSystemFont,"Segoe UI Variable Text",
    "Segoe UI",Roboto,"Helvetica Neue","Noto Sans",Arial,sans-serif;
  --fs-display:40px; --fs-h1:28px; --fs-h2:20px; --fs-body:16px; --fs-body-strong:16px;
  --fs-sm:14px; --fs-xs:12px; --fs-caps:11px;
}

/* 2) Áp bảng LIGHT cho mọi trường hợp không phải dark (ghi đè tay hoặc hệ thống sáng) */
:root, [data-theme="light"], :root:not([data-theme="dark"]) {
  --surface-0:var(--l-surface-0); --surface-1:var(--l-surface-1); --surface-2:var(--l-surface-2);
  --surface-tint-a:var(--l-surface-tint-a); --surface-tint-b:var(--l-surface-tint-b);
  --surface-scrim:var(--l-surface-scrim);
  --text-primary:var(--l-text-primary); --text-secondary:var(--l-text-secondary);
  --text-muted:var(--l-text-muted); --text-on-accent:var(--l-text-on-accent);
  --grid-line:var(--l-grid-line); --grid-dot:var(--l-grid-dot); --border:var(--l-border);
  --border-strong:var(--l-border-strong); --hairline:var(--l-hairline);
  --player-a:var(--l-player-a); --player-a-hover:var(--l-player-a-hover);
  --player-a-pattern:var(--l-player-a-pattern);
  --player-b:var(--l-player-b); --player-b-hover:var(--l-player-b-hover);
  --player-b-pattern:var(--l-player-b-pattern);
  --box-a-bg:var(--l-box-a-bg); --box-a-border:var(--l-box-a-border);
  --box-b-bg:var(--l-box-b-bg); --box-b-border:var(--l-box-b-border);
  --accent:var(--l-accent); --accent-hover:var(--l-accent-hover); --accent-soft:var(--l-accent-soft);
  --focus-ring:var(--l-focus-ring); --focus-ring-gap:var(--l-focus-ring-gap);
  --danger:var(--l-danger); --danger-soft:var(--l-danger-soft);
  --success:var(--l-success); --success-soft:var(--l-success-soft);
  --toast-bg:var(--l-toast-bg); --toast-text:var(--l-toast-text);
  --shadow-1:var(--l-shadow-1); --shadow-2:var(--l-shadow-2);
  color-scheme: light;
}

/* 3) DARK theo HỆ THỐNG (không áp khi người dùng đã ghim "light") */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]), [data-theme="dark"] {
      --surface-0:#0B0E13; --surface-1:#141821; --surface-2:#1C222D;
      --surface-tint-a:#13203A; --surface-tint-b:#2A2114; --surface-scrim:rgba(3,5,9,.64);
      --text-primary:#F2F4F7; --text-secondary:#C3CAD6; --text-muted:#98A2B3; --text-on-accent:#0A1120;
      --grid-line:#636F88; --grid-dot:#C3CAD6; --border:#636F88; --border-strong:#98A2B3; --hairline:rgba(99,111,136,.56);
      --player-a:#7CA6FF; --player-a-hover:#A6C2FF; --player-a-pattern:rgba(124,166,255,.22);
      --player-b:#F5B54D; --player-b-hover:#FFD08A; --player-b-pattern:rgba(245,181,77,.24);
      --box-a-bg:#13203A; --box-a-border:#7CA6FF; --box-b-bg:#2A2114; --box-b-border:#F5B54D;
      --accent:#93B4FF; --accent-hover:#A9C3FF; --accent-soft:#1E2B45; --focus-ring:#93B4FF; --focus-ring-gap:#0B0E13;
      --danger:#FF9C8F; --danger-soft:rgba(255,156,143,.14); --success:#6FD79A; --success-soft:rgba(111,215,154,.14);
      --toast-bg:#1F2937; --toast-text:#F2F4F7;
      --shadow-1:0 1px 2px rgba(0,0,0,.48),0 1px 3px rgba(0,0,0,.40); --shadow-2:0 12px 32px rgba(0,0,0,.56);
    color-scheme: dark;
  }
}
/* 4) Ghi đè tay "dark" — cần riêng vì @media ở trên KHÔNG chạy khi hệ thống đang sáng */
:root[data-theme="dark"] {
  --surface-0:#0B0E13; --surface-1:#141821; --surface-2:#1C222D;
  --surface-tint-a:#13203A; --surface-tint-b:#2A2114; --surface-scrim:rgba(3,5,9,.64);
  --text-primary:#F2F4F7; --text-secondary:#C3CAD6; --text-muted:#98A2B3; --text-on-accent:#0A1120;
  --grid-line:#636F88; --grid-dot:#C3CAD6; --border:#636F88; --border-strong:#98A2B3;
  --hairline:rgba(99,111,136,.56);
  --player-a:#7CA6FF; --player-a-hover:#A6C2FF; --player-a-pattern:rgba(124,166,255,.22);
  --player-b:#F5B54D; --player-b-hover:#FFD08A; --player-b-pattern:rgba(245,181,77,.24);
  --box-a-bg:#13203A; --box-a-border:#7CA6FF; --box-b-bg:#2A2114; --box-b-border:#F5B54D;
  --accent:#93B4FF; --accent-hover:#A9C3FF; --accent-soft:#1E2B45;
  --focus-ring:#93B4FF; --focus-ring-gap:#0B0E13;
  --danger:#FF9C8F; --danger-soft:rgba(255,156,143,.14);
  --success:#6FD79A; --success-soft:rgba(111,215,154,.14);
  --toast-bg:#1F2937; --toast-text:#F2F4F7;
  --shadow-1:0 1px 2px rgba(0,0,0,.48),0 1px 3px rgba(0,0,0,.40);
  --shadow-2:0 12px 32px rgba(0,0,0,.56);
  color-scheme: dark;
}

/* 5) Ghi đè tay đã chọn "light" khi hệ thống đang TỐI (đứng sau để thắng bảng dark) */
:root[data-theme="light"] {
  --surface-0:#F7F8FA; --surface-1:#FFFFFF; --surface-2:#EEF0F4;
  --surface-tint-a:#E8EEFD; --surface-tint-b:#FCEFD9; --surface-scrim:rgba(17,24,39,.40);
  --text-primary:#111827; --text-secondary:#475569; --text-muted:#5D6779; --text-on-accent:#FFFFFF;
  --grid-line:#7C879B; --grid-dot:#475569; --border:#7C879B; --border-strong:#475569;
  --hairline:rgba(124,135,155,.40);
  --player-a:#2563EB; --player-a-hover:#1D4ED8; --player-a-pattern:rgba(37,99,235,.16);
  --player-b:#A3540A; --player-b-hover:#7C3E06; --player-b-pattern:rgba(163,84,10,.18);
  --box-a-bg:#E8EEFD; --box-a-border:#2563EB; --box-b-bg:#FCEFD9; --box-b-border:#A3540A;
  --accent:#1D4ED8; --accent-hover:#1E40AF; --accent-soft:#DCE6FD;
  --focus-ring:#1D4ED8; --focus-ring-gap:#FFFFFF;
  --danger:#B42318; --danger-soft:rgba(180,35,24,.10);
  --success:#067647; --success-soft:rgba(6,118,71,.10);
  --toast-bg:#111827; --toast-text:#F2F4F7;
  --shadow-1:0 1px 2px rgba(17,24,39,.06),0 1px 3px rgba(17,24,39,.08);
  --shadow-2:0 8px 24px rgba(17,24,39,.10);
  color-scheme: light;
}
```


> **Ghi chú cài đặt (quan trọng):**
> 1. Component **chỉ dùng tên không tiền tố** (`var(--text-primary)`), không bao giờ `var(--l-text-primary)`.
> 2. `:root` luôn chứa bảng LIGHT → `data-theme="system"` (hoặc không có attribute) **không cần selector riêng**.
> 3. Nhóm (2) cố ý **không** khớp `[data-theme="dark"]` để không cướp theme dark.
> 4. **Đã kiểm chứng thật** thứ tự này bằng Chrome headless (`--headless=new`, 2 chế độ `prefers-color-scheme` sáng/tối, 3 trạng thái `data-theme` = dark/light/không set). Kết quả 6/6 đúng:
>    - `data-theme="dark"` → nền `rgb(20, 24, 33)`, chữ `rgb(242, 244, 247)` (ở cả 2 chế độ hệ thống);
>    - `data-theme="light"` → nền `rgb(255, 255, 255)`, chữ `rgb(17, 24, 39)` (ở cả 2 chế độ hệ thống);
>    - không set → hệ thống sáng: `rgb(255,255,255)`; hệ thống tối: `rgb(20,24,33)`.
> 5. `#ad-slot { min-height: var(--ad-reserve) }` đặt ở §4.1 — bắt buộc có để chống nhảy layout.
> 6. Bảng light có hex **hai nơi** (`--l-*` và khối 5). Khi đổi màu light, sửa **cả hai** hoặc thay khối 5 bằng `@layer`-free alias ngắn — lint bằng cách chạy lại bước kiểm tra §11.

---

## 11. Checklist bàn giao cho Dev (đối chiếu nhanh)

- [ ] `src/styles.css` chứa khối §10 nguyên vẹn, không sửa hex.
- [ ] `src/config.js` khai báo toàn bộ hằng số §6.3 dạng `export const`.
- [ ] `render.js` đọc màu bằng `getComputedStyle` + nghe `themechange` để vẽ lại.
- [ ] Nút đổi theme ghi `data-theme` vào `<html>` và `localStorage['theme']`; giá trị `system` → xoá attribute.
- [ ] `#ad-slot` có sẵn trong DOM ở menu + kết quả, cao đúng `--ad-reserve` khi banner chưa tải.
- [ ] Đo lại **toàn bộ** cặp màu của §2.5 bằng `python3 designer_helper.py wcag` sau khi Dev chỉnh bất kỳ hex nào.
- [ ] Test `prefers-reduced-motion` bằng DevTools Rendering → "Emulate CSS media feature prefers-reduced-motion".
- [ ] Test grayscale (DevTools Rendering → Emulate vision deficiency → Deuteranopia) trên bàn đang tô xen kẽ.
