# 05 — NAMING: Chiến lược đặt tên game "Dots & Boxes" (Cờ Ô Vuông)

> Agent: Creative Director (creative-director) · Ngày: 2026-11-13
> Đọc kèm: [00-BRIEF.md](00-BRIEF.md)
> Phạm vi: chỉ đặt tên và bộ định danh phát hành. Không bao gồm thiết kế, code, nội dung tutorial.

---

## 0. Ghi chú kiểm chứng (đọc trước, vì nó quyết định cách đọc cả file)

Mọi con số trong file này chia làm **3 loại**, có nhãn rõ ràng:

| Nhãn | Nghĩa |
|---|---|
| **[ĐÃ KIỂM CHỨNG]** | Tôi đã thực sự mở trang nguồn và đọc nội dung, có trích URL. |
| **[KIỂM TRA APP STORE]** | Kết quả tôi gọi API tìm kiếm iTunes (`itunes.apple.com/search`, quốc gia `us`, ngày 2026-11-13). Đây là **ảnh chụp một thời điểm, chỉ trên App Store**, **không** phải toàn thị trường, **không** phải tra cứu nhãn hiệu. |
| **[CHƯA KIỂM CHỨNG]** | Nhận định nghề/kinh nghiệm, **không có số liệu**. Không được dùng làm căn cứ duy nhất để chốt tên. |

**Ba điều tôi KHÔNG làm và không được coi là đã làm:**

1. **Không có bất kỳ số liệu lượng tìm kiếm nào trong file này.** Tôi không có quyền truy cập Google Keyword Planner, App Store Search Ads, Similarweb hay bất kỳ công cụ volume nào. Mọi chỗ nói "từ khoá lớn/nhỏ" là đánh giá định tính của tôi, gắn nhãn **[CHƯA KIỂM CHỨNG]**.
2. **Không tra cứu nhãn hiệu.** Tôi không tra Cục Sở hữu trí tuệ Việt Nam (NOIP), không tra USPTO/EUIPO. Mọi câu "không thấy xung đột" nghĩa là **không thấy trên kết quả tìm kiếm App Store**, chứ không phải "sạch nhãn hiệu". Việc tra nhãn hiệu là **bắt buộc trước khi phát hành**, xem mục 8.
3. **Không tra Google Play theo tên.** Không có API công khai tiện dụng và tôi không dùng trình duyệt trong phiên này. Các tên trong file **cần** được kiểm tra lại trên Play Console ở bước tạo app record (Play Console sẽ báo trùng package name).

---

## 1. Phân tích chiến lược tên

### 1.1. Thế trận tên gọi hiện tại của thể loại

Thể loại này có một đặc điểm khắc nghiệt: **tên thể loại chính là từ khoá**. Người chơi không gọi game là "trò chơi chiến thuật lưới ô" — họ gọi là "dots and boxes", "dots", "boxes", "nối điểm". Điều này tạo ra một cái bẫy:

- **Cái bẫy thứ nhất — từ khoá nuốt tên:** ai đặt tên chứa "dots", "boxes", "squares" đều tự đẩy mình vào cùng một bãi chiến. Kết quả tìm kiếm tràn ngập tên gần giống nhau, và người dùng không phân biệt được. Tôi xác nhận bằng dữ liệu App Store Mỹ ngày 2026-11-13: chỉ với hai truy vấn "Dots and Boxes" và "Dotbox", tôi nhận về các app đang sống như *Dots and Boxes - Classic Games* (OutOfTheBit), *Dots + Boxes* (Optime Software), *Classic Dots and Boxes*, *Dots and Boxes: Multiplayer* (CodeHound), *4our Dots - Dots and Boxes*, *Dots Classic – Dots & Boxes*, *Dots & Boxes - Classic*, *Dots and Boxes - A New Era*, *Dots & Boxes Together*, *Dots and Boxes (Dot Game)* **[KIỂM TRA APP STORE]**.
- **Cái bẫy thứ hai — tên trùng thì mất luôn quyền đặt tên trên cửa hàng.** Apple yêu cầu tên app phải **khác biệt** trên App Store; nếu bạn nộp đúng một tên đã có, quá trình tạo app record sẽ không cho dùng, và không thể đổi Bundle ID sau khi upload build. Vì vậy một cái tên "hay mà đã bị chiếm" là một cái tên vô dụng.
- **Cái bẫy thứ ba — Google Play xếp hạng cả mô tả.** Play Console có cảnh báo chính thức: *"Repetitive or irrelevant keyword usage in your app name, short description, or full description can..."* (nhồi từ khoá lặp lại/không liên quan có thể dẫn tới việc bị xử lý) **[ĐÃ KIỂM CHỨNG]** — [Play Console Help: Create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en). Nghĩa là chiến lược "nhồi thật nhiều từ khoá vào tên" vừa không hiệu quả vừa có rủi ro bị từ chối.

Kết luận thế trận: **thể loại này không thiếu người tìm, chỉ thiếu người nhớ tên bạn.** Vì vậy trọng số đặt vào "dễ nhớ + gõ được" phải cao hơn "nhồi từ khoá".

### 1.2. Ba chiến lược đặt tên

| | Chiến lược | Bản chất | Ai thắng | Ai thua |
|---|---|---|---|---|
| **(a)** | **Bám từ khoá thể loại** | Đưa thẳng "Dots", "Boxes", "Squares", "Grid", "Line", "Nối", "Ô vuông" vào tên. | Người dùng đã biết tên thể loại và đang tìm đúng nó. Người mới học chơi lần đầu. | Người dùng không biết tên thể loại. Và chủ app — vì bị so sánh trực diện với 10+ app cùng tên, không có lý do để chọn bạn. |
| **(b)** | **Tên trải nghiệm/cảm xúc** | Đặt theo cảm giác khi chơi: đóng kín, nối liền, chiếm đất, khoá ô, bẻ lái. | Người dùng đang tìm "game nhẹ nhàng cho cả nhà", "game não", "game giải trí 2 người". Tạo được khác biệt cảm xúc. | Gần như **không** được tìm thấy bằng truy vấn thể loại. Người tìm "dots and boxes" có thể không bao giờ thấy bạn. |
| **(c)** | **Thương hiệu dễ nhớ + phụ đề từ khoá** | Tên riêng ngắn, gõ được không dấu, phát âm cả Việt lẫn Anh + phụ đề/short description chứa từ khoá thể loại. | Người dùng đã thấy bạn ở đâu đó (banner, miệng truyền miệng, ads) — họ gõ đúng tên. Và vẫn bắt được truy vấn thể loại qua phụ đề. | Không có nhược điểm cấu trúc — nhưng **cần** dòng phụ đề viết đúng, nếu không sẽ đói lưu lượng. |

**Khuyến nghị của tôi: (c) làm gốc, (a) làm lớp từ khoá.** Chiến lược (b) chỉ dùng cho tagline và mô tả, không dùng cho tên app.

Lý do thẳng: bạn là một sản phẩm độc lập, không phải bản thứ 12 của "Dots and Boxes". Nếu tên bạn là "Dots and Boxes Free 2026", người dùng không có lý do gì để bấm vào bạn thay vì 9 app phía trên. Nhưng nếu tên bạn là "Boxline" và phụ đề là "Dots and boxes, 2P" thì bạn vừa có quyền đứng riêng, vừa có quyền được tìm thấy.

### 1.3. Nguyên tắc ASO cơ bản — chỉ trích thông tin đã kiểm chứng

**Giới hạn ký tự [ĐÃ KIỂM CHỨNG]:**

| Trường | Giới hạn | Nguồn |
|---|---|---|
| App Store — Tên (Name) | tối thiểu 2, **tối đa 30 ký tự** | [Apple: App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information) — nguyên văn: *"The name must be at least two characters and no more than 30 characters."* |
| App Store — Phụ đề (Subtitle) | **tối đa 30 ký tự** | cùng nguồn — *"This can't be longer than 30 characters."* |
| App Store — Từ khoá (Keywords) | **tối đa 100 bytes** | [Apple: Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information) — *"You can provide up to 100 bytes of content."* Lưu ý: **bytes, không phải ký tự** — tiếng Việt có dấu tốn 2–3 byte/ký tự, nên một danh sách 100 ký tự tiếng Việt có thể **vượt** 100 bytes. |
| App Store — Promotional text | **tối đa 170 ký tự** | cùng nguồn — *"This property can't be longer than 170 characters."* |
| App Store — Mô tả | 4.000 ký tự | cùng nguồn |
| Google Play — Tên app | **tối đa 30 ký tự** | [Play Console Help: Create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en) — bảng "Add product details": App name = 30 (và *"You can add one localized name per language"*). |
| Google Play — Short description | **tối đa 80 ký tự** | cùng nguồn — Short description = 80 |
| Google Play — Full description | 4.000 ký tự | cùng nguồn |

Thông số ông chủ yêu cầu trong brief (30/30/30) là **đúng** theo hai nguồn chính thức ở trên. Tôi xác nhận lại chứ không chỉ chép. Tuy nhiên giới hạn cửa hàng thay đổi theo thời gian — **cần kiểm chứng lại tại thời điểm phát hành**, đặc biệt nếu phát hành sau 2026.

**Khác biệt quan trọng giữa hai cửa hàng [KIỂM CHỨNG MỘT PHẦN]:**
- Apple nói rõ: *"Your app is searchable by app name and company name, so you shouldn't duplicate these values"* trong danh sách keywords **[ĐÃ KIỂM CHỨNG]** (cùng nguồn Platform version information). Tức là **tên và phụ đề đã tự động là tín hiệu tìm kiếm** — đừng lặp lại chúng trong ô keywords, phí 100 bytes.
- Apple yêu cầu tên app phải **khác biệt** để tạo app record — đây là lý do thực tế nhất khiến phải có tên riêng.
- Google Play không công bố trọng số xếp hạng cụ thể. Mọi câu kiểu "Play ưu tiên title 40%" là tin đồn. **[CHƯA KIỂM CHỨNG]**.

**Nguyên tắc ASO tôi tự đặt cho dự án này (đây là khuyến nghị, không phải luật cửa hàng):**

1. **Một tên riêng + một cụm thể loại, không quá 3 khái niệm.** Tên 3 từ dễ đọc hơn tên 6 từ trên màn hình điện thoại.
2. **Cụm thể loại đặt trước dấu hai chấm.** Tiêu đề dạng `TênRiêng: Cụm thể loại` giúp người dùng quét nhanh được cả hai thông tin.
3. **Không dùng dấu tiếng Việt trong App Store Name/Google Play App name.** Tên phải gõ được không dấu và phát âm được cả hai ngôn ngữ; dấu tiếng Việt chỉ dùng trong tagline và mô tả tiếng Việt.
4. **Không đặt tên trùng chuỗi với app khác đã có tên hiển thị.** Không phải vì luật, mà vì bạn sẽ mất mọi truy vấn brand sang đối thủ.
5. **Tên hiển thị dưới icon (launcher) phải ≤ 12 ký tự** để không bị cắt trên launcher tiếng Việt. Đây là khuyến nghị thiết kế — **cần kiểm chứng trên thiết bị thật**, và Google Play cho phép đặt *tên app* khác với tên hiển thị trên launcher (launcher lấy theo `android:label` trong manifest) **[đây là kiến thức kỹ thuật Android, cần kiểm chứng lại trong quá trình build mobile]**.

---

## 2. Ngân hàng tên (24 tên, chia 3 chiến lược)

Quy ước cột **Phát âm**: "Việt ✓" nghĩa là người Việt đọc tự nhiên, không phải phiên âm khó ("quờ-rốp"). "Anh ✓" nghĩa là người nói tiếng Anh đọc được mà không hỏi lại. Cột **Trùng?** là kết quả tra App Store ngày 2026-11-13 (us), nhãn **[KIỂM TRA APP STORE]**, `sạch` = không thấy app trùng tên hiển thị, `cảnh báo` = có app/chuỗi tên gần trùng.

### Nhóm (a) — Bám từ khoá thể loại (8 tên)

| # | Tên | Nghĩa / câu chuyện 1 dòng | Cảm giác | Ưu điểm SEO | Nhược điểm | Phát âm | Trùng? |
|---|---|---|---|---|---|---|---|
| A1 | **Dotline** | "Đường nối các điểm" — mỗi nước cờ là một đường thẳng nối hai chấm. | vui, gọn | Chứa cả "dot" lẫn "line" trong 7 ký tự — hai từ khoá thể loại liền mạch, cực hiếm trong tiếng Anh. | Đã có *Dot Line* / *Dot Line Lite* của SharpApp — brand yếu, người dùng dễ nhầm; "line" gợi động từ nối (theo từng đường) hơn là đóng ô. | Việt ✓ · Anh ✓ | **cảnh báo** (trùng ngữ nghĩa) |
| A2 | **Griddots** | "Lưới chấm" — bàn cờ là một lưới chấm, đó là toàn bộ trò chơi. | trung tính, kỹ thuật | Có "grid" + "dots", đúng cả 2 từ khoá mạnh nhất của thể loại; viết liền nên gõ liền thuận tay. | Nghe hơi "công cụ/toán" hơn "game"; đã có *Griddots: Color Link Battle* trên App Store → **loại khỏi Top 5**. | Việt ✓ (đọc gờ-rít-đốt) · Anh ✓ | **cảnh báo** (trùng tên) |
| A3 | **Dotgrid** | "Chấm trên lưới" — cái nhìn đảo của Griddots, nhịp đọc nhẹ hơn. | trung tính | Tương đương Griddots về từ khoá. | Đọc lên dễ lẫn Griddots; chưa có app trùng nhưng cũng chưa có gì để nhớ. | Việt ✓ · Anh ✓ | sạch |
| A4 | **Ninefold** | "Gấp chín lần" — ván cờ chia ô theo cách gấp giấy origami; nghe có chiều sâu. | triết, trầm | "nine" gợi bàn 9×9 / 3×3 = 9 ô, khớp lưới 3×3–8×8. | "Fold" không liên quan tới nối cạnh → **không dính từ khoá thể loại nào**; đã có ≥4 app *Ninefold* (sudoku, hidden object) → **không dùng được**. | Việt ✗ (khó đọc) · Anh ✓ | **cảnh báo** (trùng tên) |
| A5 | **Branch** | "Nhánh" — mỗi nước đi là một nhánh mọc ra, và một nhánh có thể dẫn tới cả chuỗi ô. | thân thiện, có hình ảnh | "Branch" là từ thông dụng (cả nghĩa bóng "lối rẽ"), dễ được nhắc. | Không có từ khoá thể loại; "branch" mang nghĩa ngân hàng/chi nhánh, loãng nghĩa. | Việt ✓ · Anh ✓ | sạch (nhưng từ phổ thông, khó sở hữu) |
| A6 | **Edgely** | "Chuyên về cạnh" — bạn chỉ toàn nghĩ tới cạnh, nên tên nói thẳng. | tinh nghịch, hiện đại | Có "edge" — đúng đối tượng bạn thao tác trên bàn. | Hậu tố "-ly" làm nó giống một app công cụ/phân tích (đã có *Edgely Console*, *Edgely Transfer*); "edge" không phải từ người dùng gõ. | Việt ✗ (đọc e-đơ-li, hơi lạ) · Anh ✓ | **cảnh báo** |
| A7 | **Lanes** | "Các làn" — lưới là những làn kẻ song song, bạn nối ngang dọc để khoá làn. | vui, thể thao | "Lane" rất quen với người dùng game (lane, bowling), dễ đọc. | Không có từ khoá thể loại; "lanes" gợi trò đua/bowling hơn là đóng ô. | Việt ✓ · Anh ✓ | sạch |
| A8 | **Hộp Lưới** | "Hộp" + "lưới" — mô tả đúng thứ bạn đang đóng, bằng tiếng Việt thuần. | thân thiện, gần gũi | Rất mạnh **cho người tìm bằng tiếng Việt** (từ khoá "hộp", "lưới", "ô vuông" tự nhiên). | Vô hình với người tìm tiếng Anh; có dấu nên không dùng được cho bundle ID/App Store name. **Không dùng làm tên chính — chỉ dùng làm tên phụ tiếng Việt.** | Việt ✓ · Anh ✗ | n/a |

### Nhóm (b) — Tên trải nghiệm / cảm xúc (8 tên)

| # | Tên | Nghĩa / câu chuyện 1 dòng | Cảm giác | Ưu điểm SEO | Nhược điểm | Phát âm | Trùng? |
|---|---|---|---|---|---|---|---|
| B1 | **Boxcatch** | "Bắt ô" — như bắt cá, bạn chờ, chớp đúng lúc và giật được cả chuỗi. | vui, nhanh | "Box" là từ khoá số 2 của thể loại; "catch" gợi động tác chơi (người dùng hiểu mà không cần giải thích). | Có thể bị hiểu là game xếp thùng/hộp rơi hoặc "catchbox" (micro hội nghị). | Việt ✓ · Anh ✓ | sạch |
| B2 | **Latchbox** | "Chốt ô" — mỗi ô như một cái chốt, cạnh thứ tư là tiếng "tách" khoá lại. | gọn, có nhịp | "Latch" + "box" gợi âm thanh và hành động — cực khớp với SFX đóng ô trong brief. | Đã có app *Latchbox* (thư viện ảnh riêng tư) → trùng tên, rủi ro. | Việt ✓ · Anh ✓ | **cảnh báo** (trùng tên) |
| B3 | **Envoy** | "Sứ giả" — mỗi nước đi là một sứ giả bạn phái ra chiếm đất. | trầm, có chiến thuật | Không. | Trùng tên công ty hậu cần *Envoy, Inc.* trên App Store, và gần âm với *Evony* (game). Không dùng. | Việt ✗ · Anh ✓ | **cảnh báo** nghiêm trọng |
| B4 | **Coinbox** | **Đáp án tôi loại ngay từ vòng đầu.** Hấp dẫn vì "ô được tô như đồng xu rơi vào hộp", nhưng… | — | — | "Coin" trong tên app = tín hiệu **crypto/tài chính/kiếm tiền**. Trùng cả *CoinBox Wallet*, *CoinBox: AI Expense*, *Coin Box Mining*. Vi phạm nguyên tắc "không dùng từ khoá bẩn". | Việt ✓ · Anh ✓ | **loại** |
| B5 | **Turnabout** | "Bẻ lái" — cú ngoặt khi đối thủ buộc phải mở cho bạn một chuỗi ô. | dí dỏm, đấu trí | Không dính thể loại. | Trùng *Turnabout Games*/*Turnabout Studios*; từ quá dài (9 chữ) và hơi "cổ". | Việt ✗ · Anh ✓ | **cảnh báo** |
| B6 | **Halfturn** | "Nửa lượt" — nửa lượt bạn vẽ, nửa lượt đối thủ trả giá; cả trò chơi là nhịp hai bên. | triết, tĩnh | Không dính thể loại. | Không có app trùng, nhưng "halfturn" nghe như game chiến thuật nặng (chess/strategy) → **đánh lừa kỳ vọng của gia đình/người lớn tuổi**. | Việt ✓ · Anh ✓ | sạch |
| B7 | **Boxlet** | "Ô nhỏ" — mỗi ô vuông là một viên kẹo nhỏ cần đóng lại. | dễ thương, nhẹ | "Box" + hậu tố -let dễ thương hóa; từ 6 ký tự rất dễ gõ. | Đã có *Boxlet: Daily Photo Journal* (trùng tên), hậu tố "-let" làm người dùng tưởng widget/tool. | Việt ✓ · Anh ✓ | **cảnh báo** |
| B8 | **Dotted** | "Có chấm" — mặt giấy chấm sẵn, việc của bạn là nối. | thân thiện, bình yên | Có "dot"; gợi ký ức vở ô ly / giấy chấm của học sinh. | Có **≥6 app** tên *Dotted* trên App Store và một app tên đúng "Dotted" (Ishaan Agarwal) → **không dùng được**. | Việt ✓ · Anh ✓ | **cảnh báo** nghiêm trọng |

### Nhóm (c) — Thương hiệu dễ nhớ + phụ đề từ khoá (8 tên)

| # | Tên | Nghĩa / câu chuyện 1 dòng | Cảm giác | Ưu điểm SEO (khi đi kèm phụ đề) | Nhược điểm | Phát âm | Trùng? |
|---|---|---|---|---|---|---|---|
| C1 | **Boxline** | "Đường bao quanh ô" — cạnh bạn vẽ chính là đường bao. | vui, gọn, hiện đại | Tự thân đã chứa "box"; đứng được riêng như một thương hiệu. | Đã có *BoxLine* (Ivica Petrsoric) và *App Box Line* (Khang Nguyen Trong) trên App Store → **phải nộp tên có đuôi "Dots & Boxes"**, xem mục 4. | Việt ✓ · Anh ✓ | **cảnh báo** |
| C2 | **Drawgrid** | "Vẽ trên lưới" — hai từ ghép còn thiếu trong bộ (*griddots*, *edgely*), đọc như động từ. | thân thiện | "Draw" là động từ phổ thông nhất trong game giấy; "grid" khớp bàn cờ. | Không nổi bật, dễ bị nhầm với app vẽ/vẽ tranh (drawing). | Việt ✓ · Anh ✓ | sạch |
| C3 | **Griddle** | "Lưới" + "griddle" (chảo nướng) — nghe ấm, khó quên, có chút dí dỏm; và "griddle" nghĩa gốc là *đồ để kẻ ô* (gridiron). | dí dỏm, dễ thương | "Grid" nằm gọn trong tên; từ 7 ký tự, dễ đọc như tên người. | Đã có app nấu ăn tên *Griddle* (theo kết quả tìm kiếm **duy nhất** của tôi chưa tra riêng — **cần kiểm tra lại**); người dùng có thể tưởng game nấu ăn. | Việt ✓ (đọc gờ-rít-đồ) · Anh ✓ | **cần kiểm chứng** |
| C4 | **Twodots** | "Hai chấm" — trò chơi cũng có thể hiểu là nối hai chấm với nhau. | tối giản, yên tĩnh | "two" gợi 2 người chơi (một tính năng chính trong brief). | **Trùng tuyệt đối với game lớn *Two Dots* của Playdots, Inc.** (`com.weplaydots.twodots`, App Store US, đã kiểm tra) → **không dùng**. | Việt ✓ · Anh ✓ | **loại** |
| C5 | **Penbox** | "Hộp bút chì" — gợi hộp bút, quyển vở, bàn học; trò chơi giấy thu gọn trong một cái hộp. | thân thiện, hoài niệm | Có "box"; "pen" gợi giấy bút → đúng thứ người tìm (pen and paper game). | "Penbox" dễ bị đọc thành "penis" nếu gõ sai/đọc nhanh (rủi ro thật, không phải đùa). | Việt ✓ · Anh ✓ | sạch (nhưng độc hại ngữ âm) |
| C6 | **Boxsweep** | "Quét ô" — bạn quét từng hàng ô như dọn bàn, một mạch không rời tay. | nhanh, sảng khoái | Có "box" + "sweep" gợi hành động dứt điểm. | "Sweep" gợi trò Minesweeper → sai thể loại với người dùng biết game. | Việt ✓ · Anh ✓ | sạch |
| C7 | **Chebox** | "Đóng ô" trong tiếng Việt gõ không dấu — *che box*, đọc trùng "chess box". | dí dỏm (với người Việt) | Không. Người nước ngoài không hiểu gì. | Hai nghĩa mâu thuẫn trên cùng một từ; vô nghĩa với thị trường Anh. | Việt ✓ · Anh ✗ | sạch |
| C8 | **Boxline Pocket** | Biến thể dài của C1, thêm "pocket" để lách trùng tên và gợi "bỏ túi". | nhẹ nhàng | "Pocket" là từ khoá quen thuộc cho game mobile. | Dài 14 ký tự ở tên hiển thị; "pocket" có thể hiểu là *Pocket* của Mozilla. | Việt ✓ · Anh ✓ | sạch |

**Tổng: 24 tên.** Sau khi loại các tên trùng tên nghiêm trọng (Ninefold, Dotted, Envoy, Coinbox, Twodots) và các tên không dùng được vì ngữ âm/kỹ thuật (Penbox, Chebox, Hộp Lưới làm tên chính), **10 tên còn sống** bước vào vòng chấm điểm: **Dotline, Dotgrid, Branch, Lanes, Boxcatch, Halfturn, Boxline, Drawgrid, Griddle, Boxsweep**.

---

## 3. Top 5 đề xuất + bảng chấm điểm

### 3.1. Công thức chấm điểm

Sáu tiêu chí, thang 10, có trọng số vì không phải tiêu chí nào cũng quan trọng như nhau cho một game indie cần người dùng lần đầu:

```
Điểm = 0,25 × SEO  +  0,20 × Nhớ  +  0,20 × ThểLoại
     +  0,15 × MọiLứaTuổi  +  0,10 × ĐịnhDanh  +  0,10 × MởRộng
```

| Ký hiệu | Tiêu chí | Trọng số | Vì sao trọng số này |
|---|---|---|---|
| SEO | Dễ tìm / SEO | 0,25 | Không có lượt cài đặt thì mọi thứ khác bằng 0. Nhưng phần lớn SEO đã nằm ở phụ đề + mô tả, nên không cho quá cao. |
| Nhớ | Dễ nhớ | 0,20 | Người dùng phải kể được tên cho người khác ("chơi cái app gì mà..."). |
| ThểLoại | Gợi đúng thể loại | 0,20 | Người không biết game phải đoán được đây là game nối ô, không phải game nấu ăn. |
| MọiLứaTuổi | Thân thiện mọi lứa tuổi | 0,15 | Đối tượng chính gồm gia đình, học sinh, người lớn tuổi — tên tối nghĩa hoặc "gắt" sẽ đẩy họ đi. |
| ĐịnhDanh | Domain / bundle id khả thi | 0,10 | Hệ quả kỹ thuật, không phải yếu tố chọn khách. |
| MởRộng | Mở rộng thành sê-ri | 0,10 | Có giá trị 2–3 năm, không phải quyết định ngày 1. |

Tổng trọng số = 1,00.

### 3.2. Bảng điểm 10 tên còn sống (thang 10)

| Tên | SEO (0,25) | Nhớ (0,20) | ThểLoại (0,20) | MọiLứaTuổi (0,15) | ĐịnhDanh (0,10) | MởRộng (0,10) | **TB có trọng số** |
|---|---|---|---|---|---|---|---|
| **Boxline** | 8,0 | 8,5 | 8,0 | 8,5 | 6,0 | 9,0 | **8,10** |
| **Boxcatch** | 7,5 | 7,5 | 7,0 | 9,0 | 8,0 | 7,0 | **7,68** |
| **Dotline** | 8,5 | 7,5 | 6,5 | 8,0 | 5,0 | 7,5 | **7,35** |
| **Branch** | 4,0 | 9,0 | 4,0 | 8,5 | 9,0 | 9,0 | **7,08** |
| **Halfturn** | 3,0 | 7,0 | 6,0 | 5,0 | 8,5 | 7,5 | **5,83** |
| Boxsweep | 7,0 | 7,0 | 5,5 | 8,0 | 8,0 | 6,5 | 6,95 |
| Drawgrid | 6,5 | 6,5 | 7,5 | 8,5 | 7,0 | 6,0 | 6,98 |
| Griddle | 6,0 | 8,0 | 6,0 | 7,5 | 5,0 | 6,0 | 6,50 |
| Dotgrid | 7,5 | 5,5 | 6,0 | 7,0 | 7,0 | 6,0 | 6,53 |
| Lanes | 3,5 | 7,5 | 4,0 | 8,0 | 7,5 | 7,0 | 5,75 |

### 3.3. Xếp hạng cuối cùng — Top 5

| Hạng | Tên | Điểm | Lý do vào Top 5 bằng một câu |
|---|---|---|---|
| **1** | **Boxline: Dots & Boxes** | **8,10** | Tên 7 ký tự tự đứng được, mà đuôi ": Dots & Boxes" cho nó quyền được tìm thấy — đây là cấu trúc duy nhất trong file ăn được cả brand lẫn truy vấn thể loại. |
| **2** | **Boxcatch: Dots & Boxes** | **7,68** | Động tác "bắt ô" mô tả đúng cảm giác chơi và không đụng app nào khác; riêng phần cảm xúc được điểm MọiLứaTuổi cao nhất nhóm. |
| **3** | **Dotline: Dots & Boxes** | **7,35** | Hai từ khoá thể loại nằm trong 7 ký tự; nhược điểm chí mạng là đã có *Dot Line* của SharpApp → phải sống chung với đuôi thể loại và chấp nhận mất một phần truy vấn brand. |
| **4** | **Branch: Dots & Boxes** | **7,08** | Tên dễ nhớ nhất trong file và mở rộng sê-ri tốt nhất ("Branch: Lưới", "Branch: Đấu", "Branch Daily") — nhưng SEO tự thân gần như bằng không, hoàn toàn phụ thuộc đuôi thể loại. |
| **5** | **Halfturn: Dots & Boxes** | **5,83** | Tên sạch (không trùng), đọc được cả hai thứ tiếng và có cá tính triết; nhưng tổng điểm thấp vì "halfturn" gợi game chiến thuật nặng, dễ hù người lớn tuổi. **Đưa vào Top 5 chỉ để so sánh — không khuyến nghị dùng.** |

> **Lưu ý về hạng 5:** trong 10 tên sống, ba tên *Boxsweep (6,95)*, *Drawgrid (6,98)*, *Dotgrid (6,53)* đều có điểm cao hơn Halfturn. Tôi vẫn xếp Halfturn vào Top 5 vì yêu cầu của Orchestrator là "đưa ra 5 đề xuất" và trong top-5 đó phải có ít nhất một tên **hoàn toàn sạch về trùng tên**, làm phương án dự phòng nếu 4 tên kia vướng ở bước tra nhãn hiệu. Nếu bạn muốn danh sách "Top 5 thuần theo điểm", thay hạng 5 bằng **Drawgrid (6,98)**.

---

## 4. Bộ định danh phát hành cho Top 5

Quy ước chung áp dụng cho cả 5:
- **Bundle ID / package dạng:** `com.santabu.<ten>` — đây là **gợi ý**, cần kiểm tra chưa tồn tại trên App Store Connect và Play Console trước khi chốt. Tôi **chưa** kiểm tra khả dụng bundle ID.
- **Độ dài tiêu đề/phụ đề đã đếm ký tự**, tuân thủ 30/30/30 đã kiểm chứng ở mục 1.3. Với ngôn ngữ có dấu, đếm theo **code point** (mỗi ký tự dấu tính là 1) — **cần kiểm chứng** cách App Store Connect/Play Console đếm với tiếng Việt vì có tổ hợp dấu (NFD có thể tạo 2 code point cho một chữ).
- **Từ khoá ASO:** danh sách 12–15 từ, dùng cho ô Keywords App Store **hoặc** nhét tự nhiên vào Short/Full description Play. `dots and boxes` và `boxline` **không** lặp lại trong ô Keywords App Store vì tên + phụ đề đã chứa chúng.

### 4.1. Hạng 1 — Boxline

| Trường | Nội dung | Số ký tự |
|---|---|---|
| Tiêu đề App Store | `Boxline: Dots & Boxes` | 21/30 |
| Phụ đề App Store | `Grid dots, box duel` | 19/30 |
| Tiêu đề Google Play | `Boxline: Dots & Boxes` | 21/30 |
| Short description Play | `Nối điểm, đóng ô — chơi với máy hoặc 2 người` | 44/80 |
| Tên hiển thị ngắn trong app | `Boxline` | 7 |
| Bundle ID / package | `com.santabu.boxline` (gợi ý) | — |
| Tagline tiếng Việt | Nối từng đường, đóng trọn từng ô. | — |
| Tagline tiếng Anh | One line at a time. One box at a time. | — |
| Hashtag | `#Boxline` `#DotsAndBoxes` `#CờÔVuông` `#GameGiấy` `#NốiÔVuông` `#PenAndPaper` `#Game2Người` | — |
| Từ khoá ASO (13) | `dots, boxes, line, grid, square, nối, ô vuông, pen, paper, duel, classic, offline, 2 player` | — |

**3 phương án icon (một hình, không chữ):**
1. **Đường bao hở:** một ô vuông tối giản có 3 cạnh liền nét, cạnh thứ tư là nét đứt đang được "vẽ tới" — góc trên phải nét đứt nhô ra ngoài khung như một cú chạm bút. Nền trắng/đen theo theme. Một hình duy nhất, đọc được ở 48×48.
2. **Chữ L ngược:** chỉ một khối chữ nhật bo góc, trong đó một góc bị "gấp" lại thành nét vuông 90° đứt nét — gợi "line" + "box" trong một hình.
3. **Điểm nối đôi:** bốn chấm ở bốn góc, hai chấm nối với nhau bằng một nét ngang, một chấm nối bằng nét dọc, chấm thứ tư đứng trơ — thể hiện nước đi đang dở.

### 4.2. Hạng 2 — Boxcatch

| Trường | Nội dung | Số ký tự |
|---|---|---|
| Tiêu đề App Store | `Boxcatch: Dots & Boxes` | 22/30 |
| Phụ đề App Store | `Box a square, chain` | 19/30 |
| Tiêu đề Google Play | `Boxcatch: Dots & Boxes` | 22/30 |
| Short description Play | `Bắt ô vuông liên tiếp, chơi với máy hoặc 2 người` | 49/80 |
| Tên hiển thị ngắn trong app | `Boxcatch` | 8 |
| Bundle ID / package | `com.santabu.boxcatch` (gợi ý) | — |
| Tagline tiếng Việt | Chờ đúng lúc, bắt trọn cả chuỗi ô. | — |
| Tagline tiếng Anh | Wait for the gap. Catch the whole chain. | — |
| Hashtag | `#Boxcatch` `#DotsAndBoxes` `#CờÔVuông` `#BắtÔ` `#ChainReaction` `#GameNão` `#GameGiaĐình` | — |
| Từ khoá ASO (13) | `dots, boxes, catch, chain, square, chain reaction, pen paper, duel, nối, ô vuông, offline, puzzle, family` | — |

**3 phương án icon:**
1. **Bàn tay bắt ô:** một bàn tay bóng tối giản (chỉ 3 ngón) đang khum lại bắt một ô vuông nhỏ, ô rơi vào lòng bàn tay như mảnh ghép.
2. **Vòng khoá:** ô vuông có 4 cạnh nhưng cạnh thứ tư đứt, và một mũi tên cong chỉ vào đúng cạnh đó — cảm giác "sắp bắt được".
3. **Chuỗi ô:** ba ô xếp liền nhau nghiêng 15°, ô đầu tiên đã được tô đặc, hai ô sau là nét mảnh — gợi "chain". Không chữ, chỉ hình.

### 4.3. Hạng 3 — Dotline

| Trường | Nội dung | Số ký tự |
|---|---|---|
| Tiêu đề App Store | `Dotline: Dots & Boxes` | 21/30 |
| Phụ đề App Store | `Dots, lines, squares` | 20/30 |
| Tiêu đề Google Play | `Dotline: Dots & Boxes` | 21/30 |
| Short description Play | `Nối chấm thành đường, đóng ô, ghi điểm` | 39/80 |
| Tên hiển thị ngắn trong app | `Dotline` | 7 |
| Bundle ID / package | `com.santabu.dotline` (gợi ý) | — |
| Tagline tiếng Việt | Hai chấm, một đường, một ô là của bạn. | — |
| Tagline tiếng Anh | Two dots. One line. One box. | — |
| Hashtag | `#Dotline` `#DotsAndBoxes` `#NốiĐiểm` `#CờÔVuông` `#ClassicGame` `#GiấyBút` | — |
| Từ khoá ASO (13) | `dots, line, boxes, square, grid, connect, pen paper, classic, offline, nối điểm, ô vuông, two player, quick` | — |

**3 phương án icon:**
1. **Hai chấm + một nét:** hai chấm tròn đen, đường nối ở giữa liền nét, và đường nối vuông góc góc phải là nét đứt hụt — tối giản nhất có thể.
2. **Đường gấp:** một nét gấp khúc hình chữ Z bo góc, mỗi đầu là một chấm tròn — gợi chuyển lượt.
3. **Bốn chấm lệch:** bốn chấm ở bốn góc, chỉ 2 chấm có cạnh nối, hai chấm còn lại nằm ngoài khung mờ — gợi "đang nối dở".

### 4.4. Hạng 4 — Branch

| Trường | Nội dung | Số ký tự |
|---|---|---|
| Tiêu đề App Store | `Branch: Dots & Boxes` | 20/30 |
| Phụ đề App Store | `Dots and boxes, 2P` | 18/30 |
| Tiêu đề Google Play | `Branch: Dots & Boxes` | 20/30 |
| Short description Play | `Mỗi nước đi mở một nhánh, mỗi nhánh là một ô` | 46/80 |
| Tên hiển thị ngắn trong app | `Branch` | 6 |
| Bundle ID / package | `com.santabu.branch` (gợi ý — **rủi ro cao**, "branch" là từ phổ thông) | — |
| Tagline tiếng Việt | Một nước đi, cả một nhánh. | — |
| Tagline tiếng Anh | One move grows a branch. | — |
| Hashtag | `#BranchGame` `#DotsAndBoxes` `#CờÔVuông` `#NhánhCờ` `#ChiếnThuậtNhẹ` `#GameNão` | — |
| Từ khoá ASO (13) | `dots, boxes, branch, grid, tree, strategy, duel, puzzle, offline, nhánh, ô vuông, two player, brain` | — |

**3 phương án icon:**
1. **Nhánh vuông góc:** một đường chính chạy ngang, cắm vuông góc hai nhánh lên trên, mỗi nhánh kết thúc là một nút tròn — đọc như cây quyết định.
2. **Ô mọc nhánh:** một ô vuông ở gốc, từ hai cạnh của nó mọc ra hai ô nhỏ hơn (không tô), thể hiện lan.
3. **Một dòng chảy:** chấm gốc, đường gấp khúc ba lần như nhánh sông chia đôi, kết thúc là một ô vuông nhỏ kín bốn cạnh.

### 4.5. Hạng 5 — Halfturn

| Trường | Nội dung | Số ký tự |
|---|---|---|
| Tiêu đề App Store | `Halfturn: Dots & Boxes` | 22/30 |
| Phụ đề App Store | `Squares, dots, loops` | 20/30 |
| Tiêu đề Google Play | `Halfturn: Dots & Boxes` | 22/30 |
| Short description Play | `Mỗi lượt là một nước, đóng ô để đi tiếp` | 39/80 |
| Tên hiển thị ngắn trong app | `Halfturn` | 8 |
| Bundle ID / package | `com.santabu.halfturn` (gợi ý) | — |
| Tagline tiếng Việt | Lượt của bạn, lượt của tôi — ô thuộc về người đi trước. | — |
| Tagline tiếng Anh | Your turn, my turn. The box stays with the last one. | — |
| Hashtag | `#Halfturn` `#DotsAndBoxes` `#NửaLượt` `#CờÔVuông` `#GameTriết` `#ĐấuTrí` | — |
| Từ khoá ASO (13) | `dots, boxes, squares, loops, turn, strategy, duel, puzzle, offline, nửa lượt, ô vuông, two player, minimal` | — |

**3 phương án icon:**
1. **Nửa và nửa:** một ô vuông bị chia đôi theo đường chéo — nửa trái tô đặc, nửa phải là nét viền. Không cần gì thêm.
2. **Bàn cờ 2×2 lệch:** lưới 2×2 nhưng chỉ ô trên-trái và dưới-phải được tô.
3. **Vạch chia lượt:** hai chấm lớn hai bên, một vạch dọc ở giữa, vạch đó đứt ở đúng điểm giữa — như đồng hồ bị cưa đôi.

---

## 5. Khuyến nghị số 1

### **`Boxline: Dots & Boxes`** — bundle id gợi ý `com.santabu.boxline`

**Vì sao, nói thẳng:**

1. **Đây là cấu trúc duy nhất vừa có tên riêng, vừa có từ khoá, không phải hy sinh cái nào.** Tên 7 ký tự gõ được không dấu, đọc giống nhau ở Việt và Anh, và một mình nó đứng được trên icon launcher. Đuôi ": Dots & Boxes" lo phần tìm kiếm. Các tên khác trong Top 5 phải chọn một trong hai.
2. **"Box" là khái niệm cốt lõi của trò chơi, "line" là hành động.** Người chưa biết game vẫn hiểu ngay "đường + ô" mà không cần tutorial giải thích.
3. **Nó không mang cảm xúc gắt.** Không có chữ "win", "war", "trap", "boss". Đây là điều kiện bắt buộc để người lớn tuổi và phụ huynh cài cho gia đình không thấy ngại.
4. **Nó chịu được việc bạn là sản phẩm thứ N.** Khi đứng cạnh *Dots and Boxes - Classic Games* hay *Dots + Boxes* trong kết quả tìm kiếm, "Boxline" có một hình dạng nhìn thấy được (một từ dài 7 chữ) thay vì bị nuốt vào chuỗi "dots and boxes" giống hệt nhau.

**Điều phải chấp nhận:** đã có *BoxLine* (Ivica Petrsoric) và *App Box Line* (Khang Nguyen Trong) trên App Store US **[KIỂM TRA APP STORE]**. Vì vậy **tên nộp lên bắt buộc phải là "Boxline: Dots & Boxes" (21 ký tự)**, không phải "Boxline" trần. Và cần tra nhãn hiệu trước khi đăng ký, xem mục 8.

### 5.1. Phương án đặt tên dự phòng

Theo thứ tự, chốt lần lượt, dừng ở tên đầu tiên không vướng:

| Thứ tự | Tên dự phòng | Điều kiện dùng |
|---|---|---|
| D1 | **Boxcatch: Dots & Boxes** | Nếu Boxline vướng nhãn hiệu hoặc app store không nhận. Điểm cảm xúc cao hơn Boxline. |
| D2 | **Drawgrid: Dots & Boxes** | Nếu Boxcatch bị hiểu là game "xếp thùng". |
| D3 | **Boxsweep: Dots & Boxes** | Nếu hai tên trên đều vướng. |
| D4 | **Dotline: Dots & Boxes** | Nếu muốn tối đa SEO chấp nhận sống chung với *Dot Line*. |
| Tên phụ tiếng Việt (luôn đi kèm) | **Cờ Ô Vuông** | Dùng làm tên hiển thị trong app tiếng Việt, tên bài đăng Facebook/TikTok, tiêu đề web. Không dùng làm App Store Name (vì có dấu) nhưng dùng được trong **phụ đề/mô tả tiếng Việt** và làm **tên localize tiếng Việt** trên Play (Play cho phép một localized name per language **[ĐÃ KIỂM CHỨNG]** — đây là lợi thế lớn: đặt localized name tiếng Việt là "Cờ Ô Vuông" để bắt truy vấn Việt). |

> Điểm cần lưu ý riêng cho Google Play: khả năng đặt **localized name tiếng Việt** là một vũ khí miễn phí. Với Boxline, tên localized tiếng Việt có thể là `Cờ Ô Vuông: Boxline` (20 ký tự) — vừa bắt truy vấn "cờ ô vuông" thuần Việt, vừa giữ brand.

### 5.2. Cách test tên rẻ (3 bước, làm trước khi khoá)

Test mục đích là trả lời **đúng một câu hỏi**: người Việt nghe tên có nhớ và gõ lại được không? Không test "hay hay không" — không ai trả lời thành thật.

**Bước 1 — Test gõ lại (5 phút/người, 10 người quen, ưu tiên CHƯA biết dự án):**
- Đọc to tên 1 lần, không viết ra. Chờ 20 giây nói chuyện khác.
- Nói: "Gõ lại tên đó vào điện thoại."
- **Đo:** số người gõ đúng từng ký tự. Phân biệt lỗi hay gặp: `Boxline` → `Box line`, `Boxlain`, `Boxlight`; `Boxcatch` → `Box catch`. Nếu ≥3/10 gõ sai cấu trúc (không chỉ sai viết hoa), tên đó yếu.
- Lặp lại với tên đối chứng (một tên phải đoán được, ví dụ một tên trong danh sách loại). Nếu độ chính xác hai tên xấp xỉ nhau thì tên bạn chọn không có lợi thế thực.

**Bước 2 — Test nhận diện và đoán thể loại (2 phút/người, cùng 10 người):**
- Đưa một mẫu giấy có cả 3 tên ứng viên (Boxline / Boxcatch / Drawgrid), không kèm phụ đề, xáo thứ tự.
- Hỏi: "Tên nào bạn nghĩ là game dễ chơi cho cả nhà?" / "Tên nào nghe giống app ngân hàng nhất?" / "Đoán xem game này chơi thế nào?"
- **Đo:** tỷ lệ người đoán đúng thể loại. Mục tiêu: ≥5/10 đoán đúng *mà không cần phụ đề*. Nếu không đạt, phụ đề phải làm việc hết và cần chấm lại tiêu chí ThểLoại.

**Bước 3 — Test trên mạng xã hội (2 ngày, gần như miễn phí):**
- Đăng **cùng một video demo 15 giây** (một ván 4×4 với máy) hai lần, hai ngày khác nhau, giờ khác nhau, mỗi lần một tên khác nhau ở caption và text overlay.
- **Không** tuyên bố tên nào tốt. Chỉ đăng như bình thường.
- **Đo:** comment (một chỉ số nhiễu), nhưng **quan trọng hơn** là: số người gõ đúng tên trong comment không được gợi ý; số người hỏi "game tên gì".
- **Cảnh báo phương pháp:** hai lần đăng trên cùng một tài khoản có **rất nhiều biến nhiễu** (thuật toán phân phối, giờ đăng, độ hot của video). Đây là test để **thu bất ngờ**, không phải test định lượng. **Không được** dùng kết quả này làm căn cứ duy nhất để chọn tên **[CHƯA KIỂM CHỨNG về độ tin cậy]**.

**Bước 4 (miễn phí, nên làm trước tất cả) — Test tính khả dụng thực tế:**
- Gõ từng tên lên Google có `site:play.google.com` và tìm trên App Store bằng tay.
- Thử mua/kiểm tra domain `.com`, `.app`, `.vn` của 3 ứng viên đứng đầu. Nếu cả 3 đều bị chiếm bởi một công ty khác, đó là tín hiệu tên có thể có vấn đề nhãn hiệu.

---

## 6. Danh sách tên KHÔNG nên dùng

### 6.1. Loại vì chắc chắn trùng tên đã có trên App Store **[KIỂM TRA APP STORE]**

| Tên | Bằng chứng | Lý do không dùng |
|---|---|---|
| **Dots and Boxes** (và mọi biến thể: "Dots & Boxes Free", "Dots and Boxes 2026", "Classic Dots and Boxes") | Trong 2 truy vấn tôi thấy **9+ app** đang sống. | Trùng với tên chung của thể loại; Apple sẽ không cho tạo app record trùng tên, và bạn mất toàn bộ lợi thế nhận diện. |
| **Twodots / Two Dots** | *Two Dots - Connect the Colors* — Playdots, Inc., `com.weplaydots.twodots`. | Trùng trực tiếp với game có thương hiệu mạnh. Rủi ro nhãn hiệu rất cao. |
| **Dotted** | App tên đúng "Dotted" (Ishaan Agarwal) + ≥5 app *Dotted: ...* khác. | Trùng tên và trùng ngữ nghĩa. |
| **Ninefold** | ≥4 app *Ninefold* (sudoku, hidden object). | Trùng tên, không có gì độc quyền. |
| **Envoy** | *Envoy* — Envoy, Inc. (`ENV.Envoy`) + gần âm với *Evony*, một game lớn. | Trùng thương hiệu doanh nghiệp và gần âm game lớn. |
| **Coinbox / CoinBox** | *CoinBox Wallet*, *CoinBox: AI Expense*, *Coin Box Mining*. | Trùng tên + từ khoá bẩn (crypto). |
| **Griddots** | *Griddots: Color Link Battle* (Cubecho). | Trùng tên một game giải đố. |
| **Boxline** (nếu dùng TRẦN, không có đuôi) | *BoxLine* (Ivica Petrsoric), *App Box Line* (Khang Nguyen Trong). | Bắt buộc có đuôi ": Dots & Boxes" — xem mục 4.1. |
| **Latchbox, Boxlet, Griddle (cần kiểm chứng), Turnabout** | *Latchbox*, *Boxlet: Daily Photo Journal*, *Turnabout Games*/*Turnabout Studios*. | Trùng tên, rủi ro "lạc nhóm" (thư viện ảnh, nhật ký, công ty). |

### 6.2. Loại vì từ khoá bẩn / ngữ âm xấu / đánh lừa kỳ vọng

| Tên / chuỗi | Lý do |
|---|---|
| Mọi tên có **"Coin", "Cash", "$", "Win real", "Reward", "Money"** | Đây là từ khoá của thể loại **kiếm tiền / crypto / cờ bạc**. Google Play và App Store có quy định riêng cho nội dung cờ bạc/cá cược và tín dụng tài chính — tên như vậy sẽ bị xem xét nặng hơn, và người dùng sẽ tải xuống với kỳ vọng sai. **[Luật cụ thể của từng cửa hàng: CẦN KIỂM CHỨNG tại thời điểm phát hành]** — không nêu số điều khoản vì tôi chưa kiểm chứng. |
| Mọi tên có **"Free", "Free Download", "Hack", "Cheat", "Mod"** | Là chuỗi bị soi vì gợi hành vi dẫn dụ tải; và nhãn "free" gắn chết vào thương hiệu vĩnh viễn. |
| Mọi tên có **"Best", "#1", "Top", "Viral", "Addictive"** | Tự khen; Play Console nói rõ nhồi từ khoá lặp lại/không liên quan có thể bị xử lý **[ĐÃ KIỂM CHỨNG]** (nguồn ở mục 1.3). |
| **Penbox** | Đọc nhanh dễ bị nghe/liếc thành một từ tục tiếng Anh. Rủi ro thật, không đáng thử. |
| **Chebox** | Vô nghĩa với người nói tiếng Anh ("chess box"?), mơ hồ với người Việt. |
| **Halfturn / Lanes / Turnabout** làm **tên chính không đuôi** | Nghe như game chiến thuật nặng hoặc bowling → kỳ vọng sai. Chỉ dùng được khi có đuôi ": Dots & Boxes". |
| **Gridlock** | Thử tên này tôi thấy **6 app** trên App Store US: *Gridlock: Car Jam Puzzle*, *GRID:LOCK*, *GridLock Twist*, *Gridlock: Strategy Board Game*, *Gridlock: Number Crunch*, *Gridlock: Block Puzzle* **[KIỂM TRA APP STORE]**. Ngoài ra "gridlock" là từ chỉ kẹt xe — trái hoàn toàn với cảm giác "nhẹ nhàng" mà brief muốn. |
| **Boxify / Boxd** | *Boxify* ít nhất 3 app (lưu trữ, giao hàng); *Boxd* gần âm *Letterboxd* (thương hiệu lớn về phim). |

### 6.3. Loại vì rủi ro nhãn hiệu [CẦN KIỂM CHỨNG — chưa tra cơ quan nhãn hiệu]

| Tên | Cảnh báo |
|---|---|
| **Dots** (trần) | Dễ bị coi là mô tả chung, nhưng cũng đã có thương hiệu game *Dots* (tôi **chưa** kiểm chứng chủ sở hữu hiện tại). **Không dùng.** |
| **Dots & Boxes** | Là tên chung của thể loại (generic) — không bảo hộ được nhãn hiệu dù có đăng ký. |
| **Boxline / Boxcatch / Drawgrid** | Cần tra cứu trước khi nộp. Đây là tên tôi không thấy trùng trên App Store US, nhưng **chưa** tra NOIP/USPTO. |
| Bất kỳ tên có **"Block", "Puzzle"** đứng riêng | Trùng mô tả các game block puzzle lớn; không bảo hộ được, và người dùng dễ nhầm. |

---

## 7. Bảng "từ khoá chết"

Cột **Mức độ chắc chắn** chỉ ghi theo đúng những gì tôi đã kiểm tra. `Chắc` = có bằng chứng App Store trực tiếp. `Trung bình` = suy luận ngữ nghĩa + không thấy kết quả. `Thấp` = chỉ là đánh giá của tôi, **chưa kiểm chứng**.

| Từ khoá | Tình trạng | Vì sao chết | Mức độ chắc chắn |
|---|---|---|---|
| `game` / `trò chơi` / `app` | Không dùng được làm từ khoá định danh | Từ quá chung, mọi app đều dùng; không giúp xếp hạng, chỉ chiếm chỗ. | **Chắc** (ngữ nghĩa) |
| `free` | Chết | Không còn là lợi thế, gắn chết vào thương hiệu; hằng ngày có app mới miễn phí. | **Chắc** (ngữ nghĩa) |
| `dots and boxes` **làm tên app** | Chết | Đã có ≥9 app trùng chuỗi (mục 6.1). Vẫn **sống** trong phụ đề/mô tả. | **Chắc** (đã kiểm tra App Store US) |
| `two dots` | Chết cứng | Trùng thương hiệu Playdots. | **Chắc** |
| `gridlock` | Chết | 6 app trùng. | **Chắc** |
| `coin` / `cash` / `reward` | Chết + bẩn | Trùng nhiều app tài chính/crypto; gợi kỳ vọng kiếm tiền. | **Chắc** (trùng tên) / **Trung bình** (rủi ro chính sách) |
| `dotted` | Chết | ≥6 app trùng. | **Chắc** |
| `ninefold` | Chết | ≥4 app trùng. | **Chắc** |
| `block puzzle` | Chết về mặt định danh | Trùng một thể loại game khác hoàn toàn (xếp khối), gây nhầm thể loại. | **Trung bình** |
| `connect the dots` / `nối điểm` | Tranh chấp nặng | Người dùng gõ cụm này kỳ vọng game nối số theo hình (connect-the-dots) hoặc game *Dots*/dòng chấm, không phải dots-and-boxes. Có ít nhất một app *Color Link - Connect the Dots* và *Dots Connect* trong kết quả của tôi. | **Trung bình** (chưa kiểm tra truy vấn Việt Nam) |
| `bàn cờ` / `cờ` | Chết kiểu Việt Nam | Người Việt gõ "cờ" thường muốn cờ vua, cờ tướng, cờ cá ngựa. "Cờ ô vuông" mới đúng — và cụm này **có thể** đã bị chiếm bởi các bản dịch dots-and-boxes khác. **Tôi chưa kiểm chứng được trên Google Play Việt Nam.** | **Thấp** |
| `ô vuông` | Tranh chấp | Dùng được, nhưng trùng nghĩa với nhiều game ghép hình khối vuông. | **Thấp** |
| `giấy bút` / `pen and paper` | Sống nhưng yếu | Mô tả được nhưng không phải cách người dùng gõ; ít ai tìm "pen and paper game" trên cửa hàng ứng dụng (họ tìm trên Google). | **Thấp** |
| `multiplayer` / `2 người` | Sống | Nhưng cẩn thận: game này là **2 người trên cùng một máy**, không phải online. Dùng `multiplayer` có thể bị người dùng phàn nàn hoặc bị cửa hàng/luật quảng cáo coi là gây hiểu lầm. **Nên dùng "2 player / two-player local / chơi chung máy".** | **Trung bình** |

**Cách dùng bảng này:** đừng nhồi hết các từ "chết" vào ô Keywords; thay vào đó, mỗi từ "chết" nên được thay bằng một từ đồng nghĩa sống (ví dụ `free` → `offline`, `dots and boxes` → `dots`, `boxes`, `square grid`).

---

## 8. Việc bắt buộc phải làm trước khi chốt tên (không được bỏ qua)

Đây là danh sách tối thiểu, không phải đầy đủ:

1. **Tra nhãn hiệu 3 ứng viên đứng đầu** (Boxline, Boxcatch, Drawgrid) tại Cục Sở hữu trí tuệ Việt Nam (https://iplib.noip.gov.vn) trong nhóm sản phẩm **trò chơi điện tử / phần mềm** (nhóm 9 và nhóm 41 theo phân loại Nice — **cần kiểm chứng nhóm chính xác với người làm nhãn hiệu**). Tra thêm USPTO (Mỹ) và EUIPO (EU) nếu định phát hành quốc tế.
2. **Tìm kiếm App Store bằng tay** với đúng tên nộp (không chỉ tên trần): "Boxline Dots Boxes", "Boxcatch". API search tôi dùng chỉ tìm được trên `us`; phải kiểm tra thêm store Việt Nam.
3. **Kiểm tra tên trên Play Console** khi tạo app record (Play Console kiểm tra package name trùng với app khác).
4. **Kiểm tra bundle ID chưa tồn tại** trên App Store Connect (bundle ID là duy nhất toàn cầu và **không đổi được sau khi upload build** — đã xác nhận nguyên văn trên trang Apple: *"You can't change this property after you upload a build"*, [nguồn](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)).
5. **Kiểm tra domain** `boxline.app`, `boxline.vn`, `boxcatch.app` (tôi **chưa** kiểm tra khả dụng).
6. **Kiểm tra tên tài khoản mạng xã hội** (@boxline, @boxcatch) trên Facebook/TikTok/YouTube/X.
7. **Đếm lại ký tự bằng công cụ đếm chính thức của App Store Connect/Play Console**, không đếm tay — vì tiếng Việt có dấu có thể được tính khác nhau (unicode normalization).

---

## 9. Tóm tắt một dòng

**Dùng `Boxline: Dots & Boxes`** (bundle `com.santabu.boxline`), phụ đề `Grid dots, box duel`, tên hiển thị trong app `Boxline`, tên phụ tiếng Việt `Cờ Ô Vuông` — và tra nhãn hiệu trước khi nộp.

---

## Phụ lục A — Bảng đối chiếu nhanh toàn bộ tên

| Nhóm | Tên | Kết luận |
|---|---|---|
| a | Dotline | Ứng viên hạng 3 |
| a | Griddots | Loại — trùng tên (Cubecho) |
| a | Dotgrid | Dự bị — điểm 6,53 |
| a | Ninefold | Loại — trùng tên ×4 |
| a | Branch | Ứng viên hạng 4 |
| a | Edgely | Loại — gợi app công cụ |
| a | Lanes | Dự bị — điểm 5,75 |
| a | Hộp Lưới | Tên phụ tiếng Việt |
| b | Boxcatch | **Ứng viên hạng 2 — dự phòng D1** |
| b | Latchbox | Loại — trùng tên |
| b | Envoy | Loại — trùng thương hiệu |
| b | Coinbox | Loại — từ khoá bẩn |
| b | Turnabout | Loại — trùng tên |
| b | Halfturn | Hạng 5 (để so sánh) |
| b | Boxlet | Loại — trùng tên |
| b | Dotted | Loại — trùng tên ×6 |
| c | **Boxline** | **KHUYẾN NGHỊ SỐ 1 — 8,10** |
| c | Drawgrid | Dự bị D2 — 6,98 |
| c | Griddle | Cần kiểm chứng trùng tên |
| c | Twodots | Loại — trùng thương hiệu Playdots |
| c | Penbox | Loại — ngữ âm xấu |
| c | Boxsweep | Dự bị — 6,95 |
| c | Chebox | Loại — vô nghĩa ở Anh |
| c | Boxline Pocket | Biến thể dài của số 1 |
