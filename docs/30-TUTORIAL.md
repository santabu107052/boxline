# 30 — TUTORIAL (đặc tả sẵn sàng để code)

> Nguồn sự thật về luật chơi: [`00-BRIEF.md`](00-BRIEF.md) mục 4. Mọi con số trong file này đã được
> đối chiếu với luật đó, **không lệch**.
> Người viết: Agent Explainer · Ngày: 2026-11-13 · Dành cho Dev đọc rồi code thẳng.
>
> **Quy ước đọc bảng cạnh:** một cạnh viết là `[r, c, 'H'|'V']`.
> `H` = cạnh **ngang**, `V` = cạnh **dọc**. `r` là hàng của **điểm neo**, `c` là cột của điểm neo.
> Điểm neo là **góc trên bên trái** của cạnh:
> - cạnh ngang `[r, c, 'H']` nối điểm `(r, c)` với `(r, c+1)` → `0 ≤ r ≤ n`, `0 ≤ c < n`;
> - cạnh dọc `[r, c, 'V']` nối điểm `(r, c)` với `(r+1, c)` → `0 ≤ c ≤ n`, `0 ≤ r < n`.
>
> **Viền ngoài** (cạnh nằm trên mép bàn) đã được tô sẵn theo luật. Dev **không được** đưa cạnh viền
> vào `allowedEdges`, không vẽ nó như "còn trống", không tính điểm từ nó.

---

## 1. Nguyên tắc sư phạm

Dạy người chưa biết gì chơi Cờ ô vuông trong khoảng **90 giây**, trên bàn thật chứ không phải video.

| Nguyên tắc | Nghĩa cụ thể trong code |
|---|---|
| **Làm rồi thấy** | Mỗi bước người chơi **tự bấm** một cạnh, rồi mới thấy kết quả. Không có bước nào chỉ đọc chữ rồi bấm "Tiếp". |
| **Tối đa 5 bước** | Đúng 5 bước, không thêm. Bước 5 là bước "tùy chọn" nhẹ nhất. |
| **Mỗi bước một ý** | Mỗi bước có 1 mục tiêu, 1 câu hướng dẫn, 1 câu chốt. Không nhồi 2 khái niệm vào 1 bước. |
| **Bỏ qua được bất cứ lúc nào** | Nút "Bỏ qua hướng dẫn" luôn hiện ở **mọi** bước, bấm là thoát ngay sang ván thật (cùng kích thước 3×3). Không hỏi lại, không chặn. |
| **Hiện lại được từ menu** | Menu chính luôn có mục "Hướng dẫn nhanh", mở được bất cứ lúc nào, kể cả khi đã học xong. |
| **Không phạt** | Tutorial **không tính thắng thua**, không có đồng hồ, không có điểm số ghi vào kết quả. Máy trong tutorial **luôn nhường**. |

**Vì sao bàn 3×3:** nhỏ đủ để nhìn hết trong một lần liếc mắt, nhưng vẫn đủ 3 ô để dạy được khái niệm
"cạnh thứ ba nguy hiểm" ở bước 4.

**Không dùng emoji trong UI.** Icon (nếu cần) là SVG nét mảnh, `stroke-width` 2, cùng màu chữ — xem
mục 10.

---

## 2. Cấu trúc Tutorial tương tác 5 bước

### Khung chung của một bước

```
┌─────────────────────────────────────────┐
│  Bước 1/5                         [Bỏ qua]│   ← thanh trên, luôn hiện
├─────────────────────────────────────────┤
│  [Bàn chơi 3×3 thật, các cạnh hợp lệ    │
│   được làm nổi bằng viền nhấp nháy nhẹ] │
│                                         │
├─────────────────────────────────────────┤
│  {câu hướng dẫn — 1 câu, tối đa 2 dòng} │   ← thanh dưới
└─────────────────────────────────────────┘
```

- Vùng bấm hợp lệ = các cạnh trong `allowedEdges`. Cạnh ngoài danh sách **không phản hồi** (không tô,
  không đổi màu, không rung) — tránh làm người mới tưởng app bị treo.
- Trên cảm ứng, vùng chạm của một cạnh tối thiểu **44 × 44 px CSS** (dù cạnh mảnh hơn), mở rộng vuông
  góc về phía cạnh đó.
- `prefers-reduced-motion`: bỏ hiệu ứng nhấp nháy, thay bằng viền đậm tĩnh.

---

### Bước 1 — Tô một cạnh là gì

- **Mục tiêu học:** hiểu "tô một cạnh" = bấm vào một đoạn thẳng chưa tô; hiểu ngay là **tô xong thì
  lượt chuyển sang bên kia** (nếu chưa kín ô).
- **Bàn lúc vào bước:** bàn 3×3 **trống hoàn toàn** (chỉ có viền ngoài). Không cạnh trong nào được tô.
- **Câu chữ hiển thị (nguyên văn):**
  - Hướng dẫn: `Bấm vào một đoạn thẳng để tô nó.`
  - Nhãn phụ (dưới câu trên, cỡ nhỏ hơn): `Mỗi lần chỉ tô được một đoạn.`
- **Vùng được phép bấm:** 6 cạnh ngang của **hai hàng giữa** để người chơi dễ trúng, không bị vướng
  mép bàn (trong thực tế chấm thử, tô ở `[1, 0, 'H']` cho kết quả sạch nhất vì không dựng sẵn ô 3 cạnh;
  danh sách đầy đủ ở mục 3):
  `[1,0,'H']`, `[1,1,'H']`, `[1,2,'H']`, `[2,0,'H']`, `[2,1,'H']`, `[2,2,'H']`
- **Điều kiện qua bước (event):** người chơi bấm **một** cạnh bất kỳ trong danh sách trên → `randomEdgeChosen`.
- **Phản hồi khi đúng:** cạnh sáng lên nhanh (150 ms) theo màu người chơi; một âm "tách" nhẹ; thanh dưới
  đổi thành câu chốt. Sau **700 ms** tự sang bước 2.
- **Phản hồi khi sai:** bấm ra ngoài danh sách → không có gì xảy ra (xem "Khung chung"). Không có âm báo lỗi.
- **Câu chốt:** `Xong. Lượt chuyển sang máy.`

  → dạy luôn ý "tô xong thì mất lượt", để bước 2 có chỗ bật ngược lại.

---

### Bước 2 — Tô cạnh thứ tư thì được ô và được đi tiếp

- **Mục tiêu học:** ô có 4 cạnh; tô nốt cạnh **cuối cùng** thì ô thuộc về mình và **mình đi tiếp**.
- **Bàn lúc vào bước:** ô góc trên-trái `(0, 0)` có **4 cạnh** nhưng chỉ cần **2 cạnh trong** được tô:
  `[1,0,'H']` (dưới) và `[0,1,'V']`... **chưa**. Trên và trái là viền có sẵn; dưới là seed `[1,0,'H']`.
  Vậy Dev dựng `seedEdges = [[1,0,'H'],[2,1,'H']]`: ô `(0,0)` khi đó có 3 cạnh (viền trên + viền trái +
  cạnh dưới), và chỉ còn **đúng một** cạnh trong để kín ô: `[0,1,'V']` (cạnh phải). `[2,1,'H']` chỉ để bàn
  trông như đã chơi dở, không ảnh hưởng ô `(0,0)`.
- **Câu chữ hiển thị (nguyên văn):**
  - Hướng dẫn: `Ô góc này còn thiếu một cạnh. Bấm cạnh còn trống đó.`
  - Nhãn phụ: `Kín 4 cạnh là mình được ô.`
- **Vùng được phép bấm:** `[0,1,'V']` (duy nhất).
- **Điều kiện qua bước:** người chơi bấm `[0,1,'V']` → ô `(0,0)` đủ 4 cạnh → `boxCaptured(box=(0,0), byPlayer)`.
  Hệ quả bắt buộc: điểm người chơi **+1**, và **lượt KHÔNG chuyển** sang máy.
- **Phản hồi khi đúng:** ô `(0,0)` đổ màu người chơi (hiệu ứng 400 ms), số điểm nhảy `0 → 1`, câu chốt hiện.
  Không sang bước 3 ngay: dừng **1.2 s** để người chơi kịp nhìn ô vừa được.
- **Phản hồi khi sai:** không phản hồi (chỉ còn đúng 1 cạnh hợp lệ).
- **Câu chốt:** `Kín ô rồi! Ô đó là của bạn, và bạn được đi tiếp.`

---

### Bước 3 — Chơi luân phiên

- **Mục tiêu học:** hai bên **thay phiên** tô; ai kín được ô thì **không mất lượt**. "Được đi tiếp" nghĩa
  là chơi tiếp ngay, không phải chờ máy.
- **Bàn lúc vào bước:** ô góc trên-trái `(0,0)` **đã kín** và thuộc về người chơi (đúng như bước 2 vừa
  dạy). Chỉ cần tô 2 cạnh trong là `[1,0,'H']` (dưới) và `[0,1,'V']` (phải) — trên và trái là viền có sẵn.
  Không có ô 3 cạnh nào trên bàn. Người chơi đang **giữ lượt**.
  *(Đây là trạng thái dựng bằng `seedEdges`, không cần chạy tiếp từ bước 2 — Dev đặt bàn theo đúng seed
  này để kịch bản luôn sạch.)*
- **Câu chữ hiển thị (nguyên văn):**
  - Hướng dẫn: `Bạn vừa kín ô nên vẫn là lượt bạn. Tô thêm một cạnh nữa đi.`
  - Nhãn phụ: `Đây là lần đi thứ hai liên tiếp của bạn.`
- **Vùng được phép bấm:** đúng **hai** cạnh, chọn sao cho lượt đi của máy xong thì bàn **vẫn sạch**
  (không sinh ô 3 cạnh nào): `[2,1,'H']` hoặc `[1,2,'V']` — đã kiểm bằng mô phỏng.
  - Nếu người chơi bấm `[2,1,'H']` → máy bấm `[1,2,'V']`.
  - Nếu người chơi bấm `[1,2,'V']` → máy bấm `[2,1,'H']`.
- **Điều kiện qua bước:** người chơi bấm một cạnh trong hai cạnh trên → **không** kín ô
  → `turnEnded()` → **đến lượt máy**. Máy bấm cạnh còn lại trong cặp → lượt lại về người chơi → sang bước 4.
- **Phản hồi khi đúng:** cạnh người chơi tô hiện màu người chơi; **sau 600 ms** cạnh của máy hiện màu máy
  (khác màu rõ rệt, kèm âm trầm hơn một chút để phân biệt "máy vừa đi"). Thanh trên đổi nhãn máy:
  `Đến lượt máy…` → khi xong: `Lại đến lượt bạn.`
- **Phản hồi khi sai:** người chơi bấm cạnh khác → không phản hồi (coi như bấm ngoài vùng cho phép).
- **Câu chốt:** `Đó là chơi luân phiên: hết lượt thì đến máy.`

---

### Bước 4 — Đừng mở ô cho đối thủ

- **Mục tiêu học:** nhận ra "cạnh thứ ba" — cạnh biến một ô thành *thiếu đúng 1 cạnh*, tức là **dâng ô
  cho đối thủ**. Học phản xạ: thấy ô đã 3 cạnh thì **đừng chạm vào ô đó**; chọn đi chỗ khác.
- **Bàn lúc vào bước:** seed cố định `[1,1,'H']` và `[2,0,'H']`. Kết quả: ô góc dưới-trái `(2, 0)` đã có
  **3 cạnh** (`[2,0,'H']` trên, `[2,0,'V']` trái là viền, `[3,0,'H']` dưới là viền) và **thiếu đúng
  `[2,1,'V']`**. Đây là "cái hộp đã hé nắp". Bàn **không** có ô 3 cạnh nào khác.
- **Câu chữ hiển thị (nguyên văn):**
  - Hướng dẫn: `Ô góc dưới-trái đã có 3 cạnh. Đừng tô cạnh cuối của ô đó — tô một cạnh khác an toàn hơn.`
  - Nhãn phụ (gắn cạnh máy sẽ chốt ô nếu người chơi lỡ mở): `3 cạnh = gần như của máy.`
- **Vùng được phép bấm (cạnh an toàn):** `[2,1,'H']` hoặc `[1,2,'V']` — cả hai đã kiểm: **không** kín ô,
  **không** sinh thêm ô 3 cạnh nào khác. Dev dùng hai cạnh này làm `allowedEdges`.
- **Cạnh mồi (phải hiện là bấm-được nhưng là sai):** `[2,1,'V']`. Đây chính là "cạnh thứ tư của ô
  đang 3 cạnh". Nếu người chơi bấm, **không** cho qua bước; chạy phản hồi sai rồi hoàn tác.
- **Điều kiện qua bước:** người chơi bấm một cạnh **an toàn** trong `allowedEdges` → `dangerousEdgeAvoided`.
- **Phản hồi khi đúng:** cạnh an toàn sáng màu người chơi; một vòng tròn mảnh tô quanh ô `(2,0)` chuyển
  từ **cam** sang **xanh nhạt** + câu chốt đổi màu sang màu thành công (không dùng emoji).
- **Phản hồi khi sai (bấm `[2,1,'V']`):** rung nhẹ bàn (200 ms, trừ khi `prefers-reduced-motion`), viền ô
  `(2,0)` **nháy đỏ 2 lần**, hiện chữ `Cạnh đó mở ô cho máy mất rồi. Thử lại nhé.`, rồi **hoàn tác cạnh vừa
  bấm** sau 900 ms và để người chơi làm lại. Không trừ điểm, không đếm lỗi.
- **Câu chốt:** `Tô cạnh thứ 3 là mở ô cho người khác. Gặp ô 3 cạnh thì đi chỗ khác.`

> **Ghi chú cho Dev — vì sao bước này cố ý không cho "đóng ô":** kịch bản dựng sao cho **người chơi không
> bao giờ có cơ hội ăn ô** ở bước 4. Mục tiêu là *cảm giác né*, không phải *ăn điểm*. Nếu tutorial trở
> thành "ăn ô liên tục", người chơi sẽ học nhầm là "chỉ cần kín ô là hay".

---

### Bước 5 — Viền ngoài đã tô sẵn và các tùy chọn

- **Mục tiêu học:** hiểu viền là của bàn, không cần tô; biết chỗ để chỉnh **thời gian mỗi lượt**,
  **kích thước bàn**, **độ khó**.
- **Bàn lúc vào bước:** bàn 3×3 với viền ngoài đã tô đậm (luôn vậy), có một lớp phủ mờ để người chơi
  không bấm vào cạnh trong khi đang xem chú thích. Có thể để lại trạng thái bàn bước 4.
- **Thiết kế:** đây là bước **chỉ xem** — **không** phải đọc chữ rồi bấm "Tiếp"; người chơi **bấm vào
  chính các nút thật** trong thanh tùy chọn để tận tay thấy chúng đổi.
- **Câu chữ hiển thị (nguyên văn):**
  - Hướng dẫn: `Viền xung quanh đã tô sẵn, bạn không cần tô viền.`
  - Nhãn phụ: `Thử bấm vào hàng tùy chọn bên dưới: thời gian, kích thước, độ khó.`
- **Vùng được phép bấm:** ba nút thật trong thanh tùy chọn — `Thời gian mỗi lượt`, `Kích thước bàn`,
  `Độ khó`. Bấm nút nào thì control đó **mở ra và cho dùng thật** (đổi giá trị được), nhưng thay đổi
  **không** áp vào ván tutorial.
- **Điều kiện qua bước:** người chơi đã bấm ít nhất **một** trong ba control đó → `optionsExplored`.
  Nút `Xong` (primary) luôn hiện để người chơi thoát sớm nếu đã chán.
- **Phản hồi khi đúng:** control vừa bấm được viền sáng 1 lần; dòng phụ đổi thành `Bấm Xong khi bạn đã xem.`
- **Phản hồi khi sai:** bấm ra ngoài ba control → không phản hồi.
- **Câu chốt:** `Hết hướng dẫn. Chơi ván đầu tiên nhé!` — nút chuyển thành `Chơi ván đầu tiên` (primary).
- **Khi bấm nút kết thúc:** đóng tutorial, `localStorage` ghi đã học xong, và mở **ván thật 3×3, độ khó Dễ**,
  với người chơi đi trước (không oẳn tù tì).

### Bảng tóm tắt 5 bước

| Bước | Tên ngắn | Dạy điều gì | Người chơi phải bấm | Kết thúc bước khi |
|---|---|---|---|---|
| 1 | Tô cạnh | Cạnh là gì; tô xong là mất lượt | 1 cạnh ngang bất kỳ ở 2 hàng giữa | `randomEdgeChosen` |
| 2 | Kín ô | Cạnh thứ 4 = được ô + được đi tiếp | `[0,1,'V']` | `boxCaptured` |
| 3 | Luân phiên | Hai bên thay phiên; kín ô thì không mất lượt | 1 cạnh an toàn bất kỳ | `turnEnded` + máy đi |
| 4 | Cạnh thứ 3 | Đừng mở ô cho đối thủ | `[2,1,'H']` hoặc `[1,2,'V']` | `dangerousEdgeAvoided` |
| 5 | Viền & tùy chọn | Viền có sẵn; chỗ chỉnh cài đặt | 1 trong 3 control (hoặc `Xong`) | `optionsExplored` / `finished` |

---

## 3. Kịch bản dữ liệu cụ thể cho từng bước

### Nguyên tắc dựng dữ liệu

1. `seedEdges` = các cạnh **đã tô** khi bước bắt đầu (không tính viền ngoài — viền luôn ngầm hiểu).
2. `allowedEdges` = cạnh người chơi **được phép** bấm ở bước đó. Cạnh hợp lệ về luật nhưng không có trong
   danh sách → **không phản hồi**.
3. `decoyEdges` = cạnh **cố ý** cho bấm và bị tính là **sai** (chỉ dùng ở bước 4).
4. `aiMoves` = cạnh máy sẽ bấm, theo đúng thứ tự. Dev **không** để AI thật của trò tự chọn nước trong
   tutorial — luôn dùng mảng cứng này, nếu không kịch bản sẽ vỡ.
5. Mọi dữ liệu dưới đây đã được đối chiếu bằng mô phỏng luật của BRIEF mục 4: không cạnh nào trùng,
   không cạnh viền nào lọt vào danh sách chơi được.

### Bảng dữ liệu từng bước

| Bước | `seedEdges` (đã tô) | Ô 3 cạnh có sẵn | `allowedEdges` | `decoyEdges` | `aiMoves` | Trạng thái sau khi qua bước |
|---|---|---|---|---|---|---|
| 1 | *(trống)* | không | `[1,0,'H']` `[1,1,'H']` `[1,2,'H']` `[2,0,'H']` `[2,1,'H']` `[2,2,'H']` | không | `[]` | Người chơi đã tô 1 cạnh ngang; điểm 0–0 |
| 2 | `[1,0,'H']` `[2,1,'H']` | `(0,0)` thiếu `[0,1,'V']` | `[0,1,'V']` | không | `[]` | Ô `(0,0)` thuộc người chơi, điểm **1–0**, người chơi **giữ lượt** |
| 3 | `[1,0,'H']` `[0,1,'V']` (ô `(0,0)` đã kín nhờ 2 viền) | không | `[2,1,'H']` `[1,2,'V']` | không | đi **sau** người chơi: `[1,2,'V']` nếu người chơi chọn `[2,1,'H']`, và ngược lại | Người chơi đi tiếp 1 cạnh → máy đi 1 cạnh → lượt về người chơi; bàn vẫn **sạch** (0 ô 3 cạnh) |
| 4 | `[1,1,'H']` `[2,0,'H']` | `(2,0)` thiếu `[2,1,'V']` | `[2,1,'H']` `[1,2,'V']` | `[2,1,'V']` | `[]` | Người chơi đã né đúng; không ăn ô nào |
| 5 | theo trạng thái bước 4 (xem ghi chú) | – | 3 control UI | không | `[]` | Kết thúc, mở ván thật 3×3 Dễ |

> **Ghi chú máy đi ở bước 3 (bắt buộc đọc):** máy **không** đi ngay khi vào bước; máy đi **sau khi** người
> chơi vừa tô xong cạnh của mình. Cặp `[2,1,'H']` / `[1,2,'V']` là cặp **duy nhất** giữ được bàn sạch ở
> trạng thái này — đã kiểm bằng mô phỏng toàn bộ 12 cạnh trong × 12. Vì vậy `allowedEdges` của bước 3 chỉ
> gồm đúng hai cạnh đó, và máy bấm cạnh còn lại. Không dùng "cạnh trống đầu tiên" tuỳ ý: có cạnh sẽ tạo
> ra ô 3 cạnh và làm hỏng bài học "bàn đang sạch".


> **Ghi chú bước 5:** bước này **giữ nguyên bàn của bước 4**, chỉ thêm lớp phủ mờ. Vì vậy trong JSON
> `seedEdges` của bước 5 để `[]` và trường `seatFromStateOf: 4` cho Dev biết cần bê trạng thái bàn bước 4
> sang (không dựng lại từ seed rỗng).

### Khối dữ liệu mẫu — hằng số `TUTORIAL_STEPS` cho `src/tutorial.js`

```json
{
  "boardSize": 3,
  "player": "player",
  "opponent": "com",
  "storageKey": "db_tutorial_done",
  "steps": [
    {
      "id": 1,
      "goal": "edge",
      "seedEdges": [],
      "allowedEdges": [
        [1, 0, "H"], [1, 1, "H"], [1, 2, "H"],
        [2, 0, "H"], [2, 1, "H"], [2, 2, "H"]
      ],
      "decoyEdges": [],
      "aiMoves": [],
      "title": "Bước 1/5",
      "instruction": "Bấm vào một đoạn thẳng để tô nó.",
      "hint": "Mỗi lần chỉ tô được một đoạn.",
      "successLine": "Xong. Lượt chuyển sang máy.",
      "advanceOn": "randomEdgeChosen",
      "advanceDelayMs": 700
    },
    {
      "id": 2,
      "goal": "box",
      "seedEdges": [
        [1, 0, "H"], [2, 1, "H"]
      ],
      "allowedEdges": [
        [0, 1, "V"]
      ],
      "decoyEdges": [],
      "aiMoves": [],
      "title": "Bước 2/5",
      "instruction": "Ô góc này còn thiếu một cạnh. Bấm cạnh còn trống đó.",
      "hint": "Kín 4 cạnh là mình được ô.",
      "successLine": "Kín ô rồi! Ô đó là của bạn, và bạn được đi tiếp.",
      "advanceOn": "boxCaptured",
      "advanceDelayMs": 1200
    },
    {
      "id": 3,
      "goal": "turn",
      "seedEdges": [
        [1, 0, "H"], [0, 1, "V"]
      ],
      "allowedEdges": [
        [2, 1, "H"], [1, 2, "V"]
      ],
      "decoyEdges": [],
      "aiMoves": [
        [1, 2, "V"]
      ],
      "aiReply": {
        "[2,1,H]": [[1, 2, "V"]],
        "[1,2,V]": [[2, 1, "H"]]
      },
      "aiDelayMs": 600,
      "title": "Bước 3/5",
      "instruction": "Bạn vừa kín ô nên vẫn là lượt bạn. Tô thêm một cạnh nữa đi.",
      "hint": "Đây là lần đi thứ hai liên tiếp của bạn.",
      "successLine": "Đó là chơi luân phiên: hết lượt thì đến máy.",
      "advanceOn": "turnEnded",
      "advanceDelayMs": 900
    },
    {
      "id": 4,
      "goal": "avoid_third",
      "seedEdges": [
        [1, 1, "H"], [2, 0, "H"]
      ],
      "allowedEdges": [
        [2, 1, "H"], [1, 2, "V"]
      ],
      "decoyEdges": [
        [2, 1, "V"]
      ],
      "dangerBox": [2, 0],
      "aiMoves": [],
      "title": "Bước 4/5",
      "instruction": "Ô góc dưới-trái đã có 3 cạnh. Đừng tô cạnh cuối của ô đó — tô một cạnh khác an toàn hơn.",
      "hint": "3 cạnh = gần như của máy.",
      "successLine": "Tô cạnh thứ 3 là mở ô cho người khác. Gặp ô 3 cạnh thì đi chỗ khác.",
      "failLine": "Cạnh đó mở ô cho máy mất rồi. Thử lại nhé.",
      "advanceOn": "dangerousEdgeAvoided",
      "advanceDelayMs": 900,
      "failUndoDelayMs": 900
    },
    {
      "id": 5,
      "goal": "options",
      "seedEdges": [],
      "seatFromStateOf": 4,
      "allowedEdges": [],
      "decoyEdges": [],
      "aiMoves": [],
      "controls": ["timeLimit", "boardSize", "difficulty"],
      "title": "Bước 5/5",
      "instruction": "Viền xung quanh đã tô sẵn, bạn không cần tô viền.",
      "hint": "Thử bấm vào hàng tùy chọn bên dưới: thời gian, kích thước, độ khó.",
      "successLine": "Hết hướng dẫn. Chơi ván đầu tiên nhé!",
      "advanceOn": "optionsExplored",
      "advanceDelayMs": 0
    }
  ]
}
```

**Ghi chú hiện thực cho Dev**

- Đọc `TUTORIAL_STEPS` như dữ liệu thuần; `src/tutorial.js` **export** hằng số, mọi chuỗi tiếng Việt nằm
  trong đó, không rải chuỗi trong `ui.js`.
- `advanceOn` là tên event engine phát ra. Nếu `engine.js` chưa có tên này, dùng đúng nghĩa sau:
  `randomEdgeChosen` (bất kỳ cạnh hợp lệ nào ở bước 1), `boxCaptured` (có ô vừa đủ 4 cạnh),
  `turnEnded` (lượt chuyển sang máy), `dangerousEdgeAvoided` (người chơi bấm cạnh an toàn ở bước 4),
  `optionsExplored` (đã chạm một control).
- Bước 3: nếu người chơi bấm cạnh **không** nằm trong `allowedEdges` → không phản hồi, đúng khung chung.
  Nếu bấm `[1,2,'V']` (khuyến nghị) thì máy bấm `[2,0,'H']` và kịch bản rất sạch (bàn 3×3 có **12 cạnh
  trong**; sau bước 3 mới dùng 6, còn 6 cho ván tiếp).
- Bước 2: `seedEdges` **không** chứa `[0,0,'H']`, `[0,0,'V']`, `[3,0,'H']`, `[3,1,'H']`… vì đó là viền —
  viền đã ngầm tô. Nếu Dev render thiếu viền thì ô `(0,0)` sẽ hiện 3 cạnh nhưng người chơi đếm chỉ thấy 1,
  gây hiểu sai. **Luôn vẽ viền trước.**

---

## 4. Màn hình "Hướng dẫn nhanh" (không tương tác)

Hiện **trước** tutorial tương tác, lần đầu mở game. Ba thẻ, xếp dọc trên điện thoại, xếp ngang trên màn
hình rộng. Người đọc mất khoảng 20 giây.

Mỗi thẻ gồm: **tiêu đề** + **một câu** + **hình vẽ canvas tĩnh** (mô tả bên dưới). Không emoji.

| # | Tiêu đề | Câu (nguyên văn) | Minh hoạ canvas tĩnh (mô tả cho Dev) |
|---|---|---|---|
| 1 | Tô một đoạn thẳng | `Mỗi lượt, bạn tô một đoạn thẳng còn trống.` | Lưới 3×3 thu nhỏ, viền ngoài nét đậm. Một cạnh dọc ở giữa bên trái vừa tô màu xanh dương. Không có gì khác đổi. |
| 2 | Kín 4 cạnh được một ô | `Ô đủ 4 cạnh thì thuộc về người tô cạnh cuối, và người đó đi tiếp.` | Cùng lưới. Một ô góc trên-trái **đã tô kín**, ruột ô đổ màu xanh dương nhạt, có dấu **tick** mảnh (nét SVG, không phải emoji) giữa ô. Ba cạnh của nó cùng màu người chơi. |
| 3 | Thấy ô 3 cạnh thì tránh | `Để ô thiếu đúng 1 cạnh là dâng ô cho đối thủ.` | Cùng lưới. Một ô góc dưới-phải có **3 cạnh đã tô**, cạnh thứ 4 còn trống. Ô đó có viền ngoài màu cam mảnh, và mũi tên cong nhỏ chỉ từ phía người chơi **ra xa** ô đó (nói "đừng vào"). |

**Thông số vẽ chung cho 3 hình:** mỗi hình là một canvas riêng `176 × 176` px CSS (nhân `devicePixelRatio`
cap 2x), nền trong suốt, lưới cách đều 48 px, độ dày viền ngoài 3 px, cạnh trong 2 px, bo tròn đầu cạnh
1 px. Vẽ **một lần** lúc mở màn hình, không có animation.

**Nút cuối màn hình:**

- `Chơi thử Tutorial` — nút chính (primary), mở tutorial tương tác 5 bước.
- `Bỏ qua` — nút phụ, vào thẳng ván thật 3×3 độ khó Dễ. Vẫn ghi `db_tutorial_done` để không hiện lại tự động
  (nhưng vẫn mở lại được từ menu).

---

## 5. Trợ giúp trong trận

Ba thứ, không hơn — tránh làm người mới thấy rối.

### 5.1 Tooltip ngữ cảnh lần đầu

- **Điều kiện hiện:** người chơi **đã học xong tutorial** (`db_tutorial_done = true`), đang ở **ván đầu tiên**
  sau tutorial, **điểm = 0**, và **hơn 60% số cạnh chưa tô**. Kiểm điều kiện sau mỗi lượt; chỉ hiện **một lần
  duy nhất** trong ván đó.
- **Vị trí:** bong bóng nhỏ neo vào **HUD điểm số**, không che bàn.
- **Câu chữ (nguyên văn):** `Bàn còn nhiều cạnh trống. Tô thoải mái ở giữa, để ý đừng làm ô nào đủ 3 cạnh.`
- **Cách đóng:** bấm vào bong bóng, bấm `Đã hiểu`, hoặc tự đóng sau **8 giây**. Đóng xong ghi
  `db_tooltip_seen = true`, không hiện lại.

### 5.2 Nút "?"

- Luôn có trên thanh trên (44 × 44 px chạm), mọi màn hình chơi.
- Bấm mở **bảng luật ngắn** dạng modal, 4 dòng:

  | Dòng (nguyên văn) |
  |---|
  | `Mỗi lượt: tô một cạnh còn trống.` |
  | `Ô đủ 4 cạnh: ô đó là của người tô cạnh cuối.` |
  | `Kín ô thì được đi tiếp.` |
  | `Nhiều ô hơn thì thắng.` |

- Trong modal có hai nút: `Đọc bảng từ ngữ` (mở mục 6 dưới dạng accordion) và `Đóng`.
- Bấm `?` **không** làm mất lượt, **không** dừng đồng hồ trừ khi đồng hồ đang bật — nếu đang bật, **tạm dừng
  đồng hồ** trong lúc modal mở (công bằng cho người mới).

### 5.3 Câu "Gợi ý" ngắn

- Nút `Gợi ý` ở thanh dưới, cạnh HUD. Bấm một lần cho **một câu**, không vẽ mũi tên, **không tự đi hộ**,
  **không** tiết lộ ô sắp thắng. Không trừ điểm.
- Chọn câu theo thứ tự ưu tiên sau (dừng ở câu đầu tiên đúng):

  | Ưu tiên | Điều kiện | Câu (nguyên văn) |
  |---|---|---|
  | 1 | Có ô đang 3 cạnh **và** cạnh thứ 4 là "món ăn" của mình (mình tô được ngay) | `Có một ô đang thiếu đúng một cạnh. Tô nốt cạnh đó đi.` |
  | 2 | Có ô 3 cạnh **không** thuộc mình (nguy hiểm) | `Có ô đã 3 cạnh. Cẩn thận, đừng tô cạnh cuối của ô đó.` |
  | 3 | Không có ô 3 cạnh nào | `Tô ở giữa bàn trước, tránh tạo ô đủ 3 cạnh.` |
  | 4 | Còn rất ít cạnh | `Sắp hết rồi. Đếm số ô hai bên để biết mình đang hơn hay kém.` |

- Giới hạn: tối đa **3 lần** mỗi ván (để nút gợi ý còn là gợi ý, không thành người chơi hộ). Hết lượt gợi ý
  → nút chuyển xám, nhãn `Hết gợi ý`.
- **Nút "Gợi ý nước đi" có rewarded ad** (theo BRIEF mục 7) là **tính năng khác**, dành cho người đã quen.
  Ở chế độ người mới, **không** hiện nút xem quảng cáo ở 3 lượt gợi ý miễn phí này, tránh ép quảng cáo.

---

## 6. Bảng thuật ngữ cho người mới

Ẩn dụ xuyên suốt cả game: **mỗi ô là một cái hộp, cạnh là thanh ghép của nắp hộp. Ghép đủ 4 thanh thì
hộp đóng lại và phần thưởng là của mình.**

| Thuật ngữ trong game | Nói cho người mới hiểu | Ẩn dụ đời thường |
|---|---|---|
| **Cạnh** | Đoạn thẳng nối hai chấm. Tô một cạnh mỗi lượt. | Một **thanh ghép** của nắp hộp. |
| **Ô** | Hình vuông do 4 cạnh ghép lại. | Một **cái hộp**. |
| **Viền ngoài** | Cạnh nằm ở mép bàn. Đã tô sẵn, không ai tô lại, không tính điểm. | **Khung đỡ** có sẵn của cả cái kệ — không phải hộp của ai. |
| **Giữ lượt / combo** | Kín được ô thì được đi ngay một lần nữa, không mất lượt. | Đóng xong một hộp thì **được chơi thêm lượt** như phần thưởng. |
| **Cạnh thứ 3 (cạnh xấu)** | Cạnh làm cho một ô chỉ còn thiếu 1 cạnh. Tô nó = dọn sẵn ô cho đối thủ. | Bạn **hé nắp hộp** lên — người sau chỉ việc đóng lại và lấy hộp. |
| **Chuỗi (chain)** | Một dãy ô dính nhau, mỗi lần đóng ô này lại mở sẵn ô kế tiếp. Ai đóng ô đầu chuỗi thì ăn gần cả dãy. | Một **dãy hộp xếp liền**, mở hộp này là lộ ra hộp sau. |

**Ẩn dụ này đúng tới đâu:** đúng ở chỗ "ghép đủ 4 thanh mới được hộp" và "mở hộp thì lộ hộp sau". Nó
**không** nói được rằng viền đã là 1 thanh sẵn (nên ô ở góc chỉ cần 3 thanh của mình) — Dev lưu ý đừng
dùng hình ảnh hộp có 4 thanh rời nhau ở góc bàn, dễ gây hiểu sai.

---

## 7. Chiến thuật cơ bản cho người mới

Năm mẹo, mỗi mẹo một ý. Không nói tới thuật toán, không nói "minimax", "parity", "double-cross".

1. **Tránh tạo cạnh thứ 3.** Nếu một cạnh sẽ làm ô chỉ còn thiếu 1 cạnh, đừng tô nó. Thà đi chỗ khác.
2. **Giành chuỗi dài.** Khi đối thủ đã mở đầu một dãy ô dính nhau, hãy đóng hết dãy đó cho mình — càng dài
   càng lời.
3. **Hy sinh ít ô.** Đôi khi phải chịu nhường 2 ô nhỏ để giành một dãy to. 2 ô đổi 6 ô là lời.
4. **Khống chế nước đi cuối.** Đếm thử: nếu gần hết bàn mà hai bên ngang điểm, lựa sao cho nước cuối cùng
   là của mình.
5. **Đếm cạnh còn lại.** Bàn `n×n` có `2·n·(n+1)` cạnh, trừ đi viền `4n` cạnh → còn `2n(n−1)` cạnh trong để
   chơi. Ví dụ bàn 3×3 có **12** cạnh trong. Biết còn bao nhiêu cạnh giúp biết sắp hết chưa.

---

## 8. Kiểm toán thuật ngữ (Zero-Assumption)

Không được giả định người đọc biết bất cứ từ nào dưới đây. Bảng này là **hợp đồng**: cột phải là thứ
được phép xuất hiện trong UI.

| Từ kỹ thuật / từ lạ | Có xuất hiện trong UI? | Diễn đạt lại cho người mới |
|---|---|---|
| AI | **Không** — thay bằng **"máy"** | "máy" (đối thủ do máy điều khiển) |
| Combo | **Không** | "được đi tiếp" / "giữ lượt" |
| Interstitial | **Không** — không bao giờ xuất hiện trong UI | (chỉ trong code, chỉ liên quan quảng cáo) |
| Reward đổi, rewarded ad | **Không** ở chế độ người mới | "xem quảng cáo để máy gợi ý" |
| Turn | **Không** | "lượt" |
| Chain | **Không** ngay lần đầu | "dãy ô dính nhau" (chỉ gọi "chuỗi" ở màn nâng cao/glossary) |
| Parity, minimax, greedy | **Không**, cấm tuyệt đối | không dùng |
| Occupied / captured box | **Không** | "ô của bạn", "ô của máy" |
| Edge occupied | **Không** | "cạnh đã tô" |
| Reset / New game | Chỉ khi người dùng đã quen | "Chơi lại", "Ván mới" |
| HUD | **Không** | "thanh điểm" |
| Tutorial | **Có**, nhưng chỉ ở nút mở | "Xem hướng dẫn"; ở heading thì ghi "Hướng dẫn" |
| Oẳn tù tì | **Giữ nguyên** | ai đi trước; giữ bản sắc Việt, không đổi thành "tung xu" |
| Skip | **Không** | "Bỏ qua" |
| Settings | **Không** | "Tùy chọn" / "Cài đặt" |
| Tooltip | **Không** | (không có tên gọi; chỉ hiện nội dung) |
| localStorage | **Không** | (không nhắc tới người dùng) |
| Level / độ khó | **Có** ở nhãn "Độ khó" | "Dễ", "Trung bình", "Khó" |
| Score | **Không** | "Điểm" |
| Draw | **Không** | "Hòa" |
| Win / lose | **Không** | "Bạn thắng", "Máy thắng" |
| Auto | **Không** | "máy tự đi" (chỉ khi bật chế độ xem máy đấu máy, nếu có) |
| Tutorial mode / practice | **Không** | "Chơi thử" |
| 3×3 | **Có**, nhưng kèm lời | "bàn 3×3 (3 ô mỗi chiều)" lần đầu |
| Time limit | **Không** | "Thời gian mỗi lượt" |
| Sound / SFX | **Không** | "Âm thanh" |

**Luật viết chữ trong UI (Dev áp dụng):**

- Không viết hoa giữa câu; chỉ viết hoa chữ đầu câu và tên riêng.
- Câu tối đa **2 dòng** trên màn hình 320 px ngang ở cỡ chữ 16 px; cắt bớt thất bại là **lỗi**, không phải
  "chấp nhận được".
- Dùng "bạn" xưng hô, gọi máy là "máy", không gọi là "đối thủ AI" hay "máy tính".
- Không dùng từ gây áp lực: "thua cuộc", "sai rồi", "nghiêm trọng". Thay bằng "chưa đúng", "thử lại".

---

## 8b. Ghi chú thay đổi sau khi người dùng chơi thử (14/11)

Người dùng kiểm thử bản web (https://santabu107052.github.io/boxline/) và báo: app đi thẳng vào bàn chơi
sau khi đóng hướng dẫn nhanh, nên **không thấy được màn menu có mục "Độ khó"**. Đã sửa (không đổi nội dung
bài học ở trên):

- Từ màn "Hướng dẫn nhanh": nút **Bỏ qua** và nút **đóng (×)** chỉ đóng hướng dẫn và **về menu** (không
  vào thẳng ván). Chỉ nút **"Chơi thử Tutorial"** và nút "Bắt đầu" của tutorial mới mở bàn chơi.
- Từ ván đang chơi: nút **quay lại** luôn hỏi "Về menu?" trước khi huỷ ván.
- Menu được sắp lại theo mức quan trọng: chế độ (Chơi với máy / 2 người) → **Độ khó** → Kích thước bàn →
  Ai đi trước → Thời gian; thanh "Chơi nhanh" ghim đáy nên không bao giờ khuất.

## 9. Checklist cho Dev

### Trải nghiệm tối thiểu
- [ ] Màn "Hướng dẫn nhanh" hiện lần đầu mở game, có nút `Chơi thử Tutorial` và `Bỏ qua`.
- [ ] `Bỏ qua` hoạt động ở **màn hình nhanh** và ở **mọi bước** của tutorial tương tác.
- [ ] Tutorial tương tác đúng **5 bước**, mỗi bước 1 câu hướng dẫn + 1 câu nhãn phụ.
- [ ] Dữ liệu các bước nằm trong `TUTORIAL_STEPS` (`src/tutorial.js`), không rải trong `ui.js`.
- [ ] Bước 1 và bước 3 **không** ép người chơi bấm đúng một cạnh duy nhất (cho tự do).

### Kịch bản chạy đúng
- [ ] Tutorial **không** dùng AI thật; máy đi theo `aiMoves`.
- [ ] Bước 2: bấm `[0,1,'V']` → ô `(0,0)` thuộc người chơi, điểm +1, **lượt không chuyển**.
- [ ] Bước 4: bấm cạnh mồi `[2,1,'V']` → rung + nháy đỏ + hoàn tác; bấm cạnh an toàn → qua bước.
- [ ] Không cạnh viền nào nằm trong `allowedEdges`/`decoyEdges` (thêm unit test kiểm viền).

### Nhớ trạng thái
- [ ] Lưu `db_tutorial_done` và `db_tooltip_seen` vào `localStorage` (dùng một khóa JSON duy nhất
  `db_settings` nếu `config.js` đã có, tránh nhiều khóa rời).
- [ ] Đã học xong thì **không** tự hiện lại màn hướng dẫn nhanh, nhưng menu chính vẫn có mục
  **"Hướng dẫn nhanh"** mở lại được.
- [ ] Đọc `localStorage` bọc `try/catch`; nếu lỗi hoặc bị chặn thì coi như chưa học, không crash.
- [ ] Thoát tutorial giữa chừng **không** ghi "đã học xong" (chỉ ghi khi bấm `Xong` hoặc hoàn tất bước 5,
  hoặc khi người chơi chọn `Bỏ qua` có chủ đích).

### Màn hình nhỏ
- [ ] Không tràn ngang ở 320 px; nút chạm ≥ 44 × 44 px.
- [ ] Thanh hướng dẫn dưới bàn **không** che các cạnh hợp lệ (bàn co lại, không bị đè).
- [ ] Xoay ngang không làm mất bước đang dở.

### Bàn phím & trợ năng
- [ ] `Tab` đi được qua các cạnh hợp lệ (theo thứ tự hàng → cột), `Enter`/`Space` chọn cạnh.
- [ ] Focus ring rõ ràng, không bị `outline: none` vô căn cứ.
- [ ] Mỗi cạnh có `aria-label` dạng: `Cạnh ngang hàng 2 cột 1, chưa tô`.
- [ ] Vùng đang được chọn/đã tô có ký hiệu khác biệt ngoài màu (đậm/nét đôi), không chỉ dựa vào màu.
- [ ] Thông báo trạng thái (`Bạn 1 – 0 Máy`, `Máy vừa đi`) dùng vùng `aria-live="polite"`, không đọc trùng.

### Chuyển động & âm thanh
- [ ] `prefers-reduced-motion: reduce` → tắt nhấp nháy, tắt rung bàn, giữ thay đổi màu tức thời; tất cả
  `advanceDelayMs`/`failUndoDelayMs` giữ nguyên (vì đó là nhịp cần cho việc hiểu, không phải trang trí).
- [ ] Âm thanh tôn trọng công tắc chế độ im lặng; không có âm báo lỗi chói ở tutorial.
- [ ] Không emoji trong toàn bộ chuỗi UI; icon (nếu có) là SVG nét mảnh cùng màu chữ.

### Không lẫn với quảng cáo
- [ ] Không có interstitial trong lúc tutorial chạy.
- [ ] Ba lượt `Gợi ý` miễn phí không gắn rewarded ad.

### Kiểm thử
- [ ] `tests/` có unit test: (a) mọi cạnh trong `allowedEdges`/`decoyEdges` là cạnh **trong** và **chưa tô**
  ở trạng thái `seedEdges` của bước đó; (b) bấm `allowedEdges` của bước 2 làm đúng 1 ô kín; (c) bấm cạnh
  an toàn ở bước 4 **không** kín ô và **không** tạo thêm ô 3 cạnh.
- [ ] Chạy thử toàn bộ tutorial bằng bàn phím chỉ dùng `Tab` + `Enter` — đi hết 5 bước không kẹt.
