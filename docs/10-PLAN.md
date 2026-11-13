# 10-PLAN — Kế hoạch tổng thể Dự án "Dots & Boxes" (Cờ Ô Vuông)

> **Bản quyền tài liệu:** `master-planner` soạn theo `docs/00-BRIEF.md`. Đây là **chuẩn nghiệm thu** cho Dev, Designer, Explainer, Maintenance và QC.
> **Ngày lập:** 2026-11-13 · **Đơn vị ước lượng:** người-ngày (1 người × 1 ngày ~6 giờ tập trung).
> **Cách đọc độ dài:** phần văn xuôi ~1.900 từ (đúng khung 1.200–2.000); phần WBS/rủi ro là **bảng markdown** — Dev/QC dùng bảng làm checklist nghiệm thu.

---

## 1. Mục tiêu & phạm vi

**Mục tiêu tối thượng (North Star):** một người chưa biết game mở `index.html` là chơi được ngay trong **< 60 giây**, không cần cài đặt, không cần mạng — và cùng một mã nguồn đó đóng gói được lên Android/iOS kèm AdMob **mà không phải sửa logic game**.

| | **Giai đoạn 1 — Demo web (P0)** | **Giai đoạn 2 — Mobile & Monetization** |
|---|---|---|
| Mục tiêu | Chơi hoàn chỉnh, mượt, đẹp, offline 100%, có hướng dẫn cho người mới | Đóng gói Capacitor, AdMob thật, tuân thủ chính sách store |
| Công nghệ | HTML/CSS/JS ES module + Canvas 2D, không thư viện ngoài | Capacitor 8.x + `@capacitor-community/admob` |
| Đo lường "xong" | QC ≥ 95/100, `node --test` xanh 100%, 0 TODO | App cài được trên máy thật, ads chạy, qua policy review |
| Ước lượng | **48 người-ngày** + dự phòng 15% → **≈ 55** | **40,5 người-ngày** + dự phòng 15% → **≈ 47** |

### In-scope Giai đoạn 1
Engine luật chơi (thuần logic, test được), AI 3 mức, render Canvas (DPR cap 2×, 60fps), UI menu/HUD/modal, giới hạn thời gian mỗi lượt (mặc định 20s, bật/tắt), 6 kích thước 3×3…8×8, chọn ai đi trước + oẳn tù tì, Light/Dark theo hệ thống + nút chuyển tay, nhạc nền + SFX bằng Web Audio API, Tutorial tương tác, `AdBridge` **mock**, lưu cài đặt `localStorage`, PWA cơ bản (`manifest.webmanifest`, `sw.js`), unit test `node --test`, tài liệu `20-DESIGN`, `30-TUTORIAL`, `40-MAINTENANCE`, `50-QC`.

### In-scope Giai đoạn 2
Scaffold Capacitor, cấu hình Android/iOS, plug-in AdMob thật sau `window.AdBridge`, consent UMP/GDPR + ATT iOS, quy ước tần suất interstitial, icon/splash, store listing, kiểm thử máy thật, gửi duyệt.

### Out-of-scope (KHÔNG làm, tránh phình phạm vi)
Chơi online nhiều người / tài khoản / leaderboard server; hệ thống level hay chế độ campaign; IAP (mua bỏ quảng cáo); đa ngôn ngữ ngoài tiếng Việt; analytics thu thập dữ liệu người dùng (brief §6 cấm); nhạc nền dạng file mp3; framework (React/Vue); các mức bàn ngoài 3…8; AI mức "bất khả chiến bại" (xem R-01).

---

## 2. WBS — Phân rã theo Epic (MECE)

Quy ước: **ID** không trùng; mỗi task có **một** deliverable kiểm chứng được; *phụ thuộc* chỉ ra task phải xong trước. Ký hiệu phụ trách: `Dev` = Principal Dev Engineer, `Des` = Visual Designer, `Exp` = Master Explainer, `Mnt` = System Maintenance, `QC` = Omni-QC Lead.

### Giai đoạn 1 — Demo web

| ID | Task | Deliverable | Phụ trách | Ngày | Phụ thuộc |
|---|---|---|---|---|---|
| **E1 — Nền dự án** | | | | | |
| P0-01 | Khung dự án + quy ước code | Cây thư mục đúng Brief §5; `src/config.js` (hằng số, schema cài đặt, version); `README` chạy `python3 -m http.server`; ESLint-free quy ước viết tay (JSDoc) | Dev | 2 | — |
| P0-02 | Cổng tương thích `file://` | `index.html` + `main.js` phát hiện `location.protocol === 'file:'`: nếu module nạp lỗi → hiện banner hướng dẫn mở `http://localhost` (xem R-08) | Dev | 1 | P0-01 |
| **E2 — Design System** | | | | | |
| D-01 | Design token Light/Dark | `src/styles.css` (token: màu, spacing 4/8, radius, font scale, motion); chạy `designer_helper.py` cho bảng màu 60-30-10 + WCAG | Des | 2 | P0-01 |
| D-02 | Wireframe 5 màn hình | Ảnh/wireframe: Menu → Cài đặt ván → Bàn chơi → Oẳn tù tì → Kết quả; `docs/20-DESIGN.md` (phần layout) | Des | 1,5 | D-01 |
| D-03 | Spec hiệu ứng & chuyển động | Spec: vẽ cạnh (easing, 120–160ms), tô ô (pop 1.15→1.0), rung/pulse khi hết giờ, chuyển màn; bản `prefers-reduced-motion` tắt hết | Des | 1 | D-02 |
| D-04 | Bộ icon + cách phân biệt người chơi | Bộ icon SVG inline (điều khiển, âm thanh, theme, gợi ý); quy ước ô của P1/P2 khác nhau **không chỉ bằng màu** (ký hiệu ○ vs ✕) | Des | 1 | D-01 |
| **E3 — Engine luật chơi** | | | | | |
| X-01 | Mô hình dữ liệu + nước đi hợp lệ | `engine.js` phần 1: `createGame(n)`, biểu diễn cạnh (ngang `H[y][x]`, dọc `V[y][x]`), viền ngoài đã tô sẵn, `isLegal`, `applyMove` trả `{closedBoxes, keepsTurn}` | Dev | 2 | P0-01 |
| X-02 | Kết thúc ván & điểm | `engine.js` phần 2: đếm ô, phát hiện "hết cạnh trong", `getScore` (bất biến tổng = n²), `getWinner` (thắng/hòa) | Dev | 1,5 | X-01 |
| X-03 | API sự kiện cho UI | `engine.js` phần 3: `getState()` bất biến (immutable snapshot), `undo`-free, danh sách cạnh còn lại, hàm `serialize/deserialize` (để test và replay) | Dev | 1,5 | X-02 |
| X-04 | Unit test engine | `tests/engine.test.mjs`: bất biến (tổng điểm = n², đường chéo, không tô lại cạnh, viền ngoài miễn nhiễm), kịch bản thắng/hòa, mọi n 3…8 | Dev | 1,5 | X-03 |
| **E4 — Điều khiển ván & lượt** | | | | | |
| C-01 | Vòng đời ván & chuyển lượt | `main.js`/controller: state machine Menu→Setup→Toss→Playing→Result; giữ lượt khi đóng ô; khóa input khi AI nghĩ | Dev | 2 | X-03 |
| C-02 | Giới hạn thời gian mỗi lượt | Module timer dùng **một** `requestAnimationFrame`+`performance.now()` làm nguồn sự thật, `clearTimeout` + cờ `turnSeq` chống double-turn (xem R-02); toggle bật/tắt, mặc định 20s | Dev | 1 | C-01 |
| C-03 | Oẳn tù tì & chọn ai đi trước | Màn hình oẳn tù tì (kéo–búa–bao, animation ngắn); chế độ "chọn trước"; kết quả lưu vào state ván | Dev | 1,5 | C-01, D-03 |
| C-04 | Tạm dừng / chơi lại / quay lại menu | Modal tạm dừng (đồng hồ đóng băng), "Chơi lại", "Về menu", xác nhận khi đang giữa ván | Dev | 1 | C-01 |
| **E5 — AI 3 mức độ** | | | | | |
| A-01 | Mức Dễ | `ai.js`: chọn cạnh ngẫu nhiên hợp lệ, nhưng **không** biết né đóng ô (khiến người mới thắng được) | Dev | 2,5 | X-03 |
| A-02 | Mức Trung bình | Greedy: đóng ô nếu đóng được; nếu không → tránh cạnh tạo "cạnh thứ 3" của ô (né mở ô cho đối thủ); nếu bị bắt buộc → chọn thiệt hại nhỏ nhất | Dev | 1,5 | A-01 |
| A-03 | Mức Khó + test | Lookahead 2 ply + chain heuristic (đếm chuỗi ô sẽ bị đối thủ ăn); chạy trong **Web Worker** hoặc ngân sách thời gian ≤ 50ms/lượt để không đóng băng UI; `tests/ai.test.mjs` (không tự sát, thắng mức Dễ ≥ 85%); **cấm quảng cáo "không thể đánh bại"** (R-01) | Dev | 2 | A-02 |
| **E5 — Render Canvas & hiệu ứng** | | | | | |
| N-01 | Renderer bàn chơi | `render.js`: vẽ lưới/điểm/cạnh/ô; `devicePixelRatio` **cap 2×**; chữ trong ô dùng ký hiệu ○/✕; dựng lại khi resize/orientation | Dev | 1,5 | D-01, X-03 |
| N-02 | Hit-testing + input | Chuyển toạ độ con trỏ/touch → cạnh gần nhất (vùng bấm ≥ 24px), hover preview, chặn double-tap zoom | Dev | 1,5 | N-01 |
| N-03 | Hiệu ứng & vòng render | Render theo nhu cầu (dirty flag), animation vẽ cạnh/tô ô, shake khi hết giờ, tôn trọng `prefers-reduced-motion` | Dev | 2 | N-01, D-03 |
| N-04 | Hiệu năng trên máy yếu | Profile, hạ cấp (tắt glow/shadow, giảm DPR về 1,5) khi fps < 45; ghi số liệu vào `40-MAINTENANCE.md` | Dev | 1 | N-03 |
| **E6 — Âm thanh** | | | | | |
| S-01 | Nhạc nền tổng hợp | `audio.js`: BGM bằng oscillators/arpeggio, loop nhẹ, crossfade; **chỉ khởi động sau thao tác đầu tiên** của người dùng (R-04) | Dev | 1 | P0-01 |
| S-02 | SFX + trộn âm | SFX: vẽ cạnh, đóng ô, hết giờ, thắng/thua, bấm nút; master gain, ducking BGM khi có SFX | Dev | 1 | S-01 |
| S-03 | Điều khiển âm thanh & lưu lựa chọn | Toggle nhạc/SFX riêng, lưu `localStorage`; dừng toàn bộ khi tab ẩn (`visibilitychange`) | Dev | 1 | S-02 |
| **E7 — UI, đa nền, truy cập, lưu cài đặt** | | | | | |
| Q-01 | Màn hình Menu & Cài đặt ván | `ui.js` + `index.html`: chọn chế độ (Máy/2 người), kích thước 3×3…8×8, độ khó, ai đi trước/oẳn tù tì, thời gian mỗi lượt, nút Tutorial | Dev | 1,5 | D-02, C-03 |
| Q-02 | HUD trong ván & màn kết quả | Điểm trực tiếp, chỉ báo lượt, đồng hồ đếm ngược, nút Gợi ý (gọi `showRewarded`); tổng kết thắng/hòa + "Chơi lại"/"Về menu" | Dev | 1,5 | N-02 |
| Q-03 | Light/Dark theo hệ thống + chuyển tay | Đọc `prefers-color-scheme`, nút chuyển 3 trạng thái (Hệ thống/Sáng/Tối), lưu lựa chọn, không nháy màu khi tải (FOUC) | Dev | 1,5 | D-01 |
| Q-04 | Truy cập & i18n chuỗi tiếng Việt | Bàn phím Tab + Enter/Space chọn cạnh, `aria-live` thông báo lượt/điểm, `aria-label` đầy đủ, focus ring rõ, tổng hợp toàn bộ chuỗi UI tiếng Việt có dấu | Dev | 1,5 | Q-01, Q-02 |
| **E8 — Tutorial (Explainer → Dev)** | | | | | |
| T-01 | Nội dung Tutorial 5 bước | `docs/30-TUTORIAL.md`: giải thích từ số 0 (nối cạnh → tô ô → được đi tiếp → chuỗi ô → ai thắng), ẩn dụ đời thường, kiểm toán thuật ngữ | Exp | 1 | P0-01 |
| T-02 | Hiện thực Tutorial tương tác | `src/tutorial.js`: bàn 3×3 dạy từng bước (highlight cạnh nên bấm), bỏ qua được, nhớ đã xem; chạy lại từ menu | Dev | 2 | T-01, N-02, Q-01 |
| T-03 | Kịch bản Onboarding lần đầu | Lần mở đầu tiên: mời "Xem hướng dẫn 60 giây" (không chặn chơi); lưu cờ `onboarded` | Dev | 1 | T-02 |
| **E9 — PWA & `AdBridge` mock** | | | | | |
| R-01 | `window.AdBridge` mock | `main.js`: API `showBanner()/showInterstitial()/showRewarded()` (hợp đồng: `Promise<{completed:boolean}>`), mock bằng modal mô phỏng; quy ước: interstitial **sau khi kết thúc ván**, tối đa 1 lần/2 ván; rewarded chỉ khi bấm "Gợi ý" | Dev | 1 | Q-02 |
| R-02 | Manifest + Service Worker | `manifest.webmanifest` (icon, theme-color light/dark, display standalone), `sw.js` cache-versioned, hoạt động offline sau lần tải đầu | Dev | 1 | P0-01, D-04 |
| R-03 | Hook quảng cáo ở 3 chỗ | Banner ở Menu + Kết quả; interstitial sau ván; rewarded→gợi ý nước đi (**nút gợi ý không nằm dưới banner**) | Dev | 1 | R-01, C-01 |
| **E10 — QC & nghiệm thu web** | | | | | |
| V-01 | Checklist nghiệm thu web | `docs/50-QC.md`: ma trận 12 hạng mục (luật, AI, timer, a11y, theme, audio, tutorial, hiệu năng, offline, ads mock) + điểm /100 | QC | 1,5 | tất cả GĐ1 |
| V-02 | Audit & báo lỗi Critical/Major/Minor | Báo cáo QC đầy đủ, tái hiện lỗi bằng bước cụ thể, mức chấm ≥ 95/100 mới được qua | QC | 1,5 | V-01 |
| V-03 | Regression sau khi sửa | Chạy lại toàn bộ checklist + `node --test`; xác nhận 0 lỗi Critical/Major còn mở | QC | 1,5 | V-02 |
| V-04 | Sign-off M4/M5 | Biên bản nghiệm thu ký số (markdown) cho Orchestrator | QC | 1,5 | V-03 |
| **E11 — Vận hành & tài liệu (Maintenance)** | | | | | |
| M-01 | `40-MAINTENANCE.md` | Hướng dẫn: chạy local, cách test, cấu trúc file, nơi sửa luật, bảng mã lỗi thường gặp; **viết cho người không chuyên** | Mnt | 1,5 | N-04 |
| M-02 | RCA các lỗi sau QC | Mỗi lỗi Critical/Major: nguyên nhân gốc, bản vá, cách phòng ngừa tái diễn | Mnt | 1 | V-02 |

**Tổng Giai đoạn 1: 48 người-ngày** = E1 3 · E2 5,5 · E3 6,5 · E4 5,5 · E5 6 · E6 3 · E7 6 · E8 4 · E9 3 · E10 6 · E11 2,5.

### Giai đoạn 2 — Mobile & Monetization

| ID | Task | Deliverable | Phụ trách | Ngày | Phụ thuộc |
|---|---|---|---|---|---|
| **E12 — Kiến trúc Ads** | | | | | |
| G-01 | Chốt hợp đồng `AdBridge` | `docs/21-ADBRIDGE.md`: 3 hàm async, trạng thái (idle/loading/showing), mã lỗi, timeout 5s → fallback no-op; **game không bao giờ bị chặn** nếu ad lỗi | Dev | 1 | R-01 |
| G-02 | Bọc adapter nền tảng | `src/adbridge.native.js`: import động `@capacitor-community/admob` khi `Capacitor.isNativePlatform()`, ngược lại dùng mock | Dev | 1,5 | G-01, MB-01 |
| G-03 | Quy ước tần suất (frequency cap) | Bộ đếm ván trong `localStorage`: interstitial ≤ 1 lần/2 ván, không bao giờ giữa ván, không che nút, giãn cách tối thiểu giữa 2 ad **cần kiểm chứng** theo hướng dẫn AdMob hiện hành | Dev | 1,5 | G-02 |
| G-04 | An toàn âm thanh khi có ad | Tắt BGM/SFX khi ad mở (`AdMob.setApplicationMuted`), khôi phục sau `Dismissed` | Dev | 1,5 | G-02, S-03 |
| **E13 — Đóng gói Capacitor** | | | | | |
| MB-01 | Scaffold Capacitor | `npm i @capacitor/core@8 @capacitor/cli@8` (Node ≥ 22), `npx cap init`, `webDir` trỏ thư mục chứa `index.html`; commit `capacitor.config.json` | Dev | 1 | P0-01 |
| MB-02 | Thêm nền tảng Android | `npx cap add android`, `npx cap sync`; `variables.gradle`: `minSdkVersion 24`, `compileSdkVersion 36`, `targetSdkVersion 36` (đã kiểm chứng theo tài liệu Capacitor 8 / Google Play) | Dev | 1,5 | MB-01 |
| MB-03 | Thêm nền tảng iOS | `npx cap add ios` (Capacitor 8 mặc định SPM), deployment target **iOS 15.0**, mở bằng Xcode 26+ | Dev | 2 | MB-01 |
| MB-04 | Vá định hướng & vùng an toàn | Khóa dọc (hoặc cho xoay — xem câu hỏi mở Q2), `env(safe-area-inset-*)` cho tai thỏ, chặn pinch-zoom trong WebView | Dev | 1,5 | MB-02, MB-03 |
| MB-05 | Vòng lặp build & cài máy thật | Script `npm run sync:android|ios`, cài trên ≥ 2 máy Android + 1 iPhone thật; ghi log vấn đề WebView | Dev | 2 | MB-04 |
| MB-06 | Icon, splash, ký ứng dụng | Icon launcher (từ D-04), splash screen, Android keystore (lưu ngoài repo), iOS provisioning/certificate | Dev | 2 | D-04, MB-03 |
| **E14 — Policy & WebView** | | | | | |
| PO-01 | Rà soát rủi ro "app chỉ là website" | Đối chiếu hướng dẫn Google Play về "WebViews và app cỡ website" / Apple 4.2 Minimum Functionality; liệt kê điểm tối thiểu khác biệt (offline, ads native, splash, không thanh địa chỉ) | Dev | 1,5 | MB-05 |
| PO-02 | Bổ sung tính năng native tối thiểu | Ít nhất: dùng plugin Capacitor (App/StatusBar/Haptics rung khi đóng ô), lưu trữ cục bộ qua Preferences | Dev | 1,5 | PO-01 |
| PO-03 | Khai báo Target Audience trên store | Chọn tuổi (mặc định **không nhắm trẻ em** — xem Q1), chuẩn bị trả lời Data Safety + Content Rating | Dev | 1 | PO-01 |
| PO-04 | Privacy policy + store listing | Trang privacy policy tĩnh (không thu thập dữ liệu, có ads), ảnh chụp, mô tả, màn hình (dùng bộ thiết kế D-02) | Dev | 1,5 | PO-03, MB-06 |
| **E15 — Tích hợp AdMob** | | | | | |
| AD-01 | Tài khoản AdMob & đơn vị quảng cáo | Khai báo app ID Android/iOS, 3 ad unit (banner/interstitial/rewarded) cho **mỗi** nền tảng; lưu ID vào `src/config.ads.js` (không commit test ID) | Dev | 1 | — |
| AD-02 | Gắn AdMob cho Android | `npm i @capacitor-community/admob` (bản v8.2.0 dùng Capacitor 8.5+), `AndroidManifest.xml` khai `com.google.android.gms.ads.APPLICATION_ID`, `AdMob.initialize()` sau consent | Dev | 2 | MB-02, AD-01 |
| AD-03 | Gắn AdMob cho iOS | `Info.plist`: `GADApplicationIdentifier`, `GADIsAdManagerApp`, `NSUserTrackingUsageDescription`, `SKAdNetworkItems` (đủ ID theo hướng dẫn Google) | Dev | 1,5 | MB-03, AD-01 |
| AD-04 | Banner: làm cho không che nút | Banner `ADAPTIVE_BANNER` ở đáy, chỉ bật ở Menu + Kết quả, **ẩn trong ván**; dùng sự kiện `bannerAdSizeChanged` để đẩy layout (CSS var padding-bottom) | Dev | 1 | AD-02, AD-03, G-03 |
| AD-05 | Interstitial + Rewarded | Interstitial: `prepareInterstitial` trước 1 ván, chỉ `showInterstitial` khi đã tới màn Kết quả; Rewarded: chỉ cấp gợi ý khi nhận sự kiện `Rewarded` (không dựa vào `Dismissed`) | Dev | 1,5 | AD-04, G-03, G-04 |
| **E16 — Consent UMP & ATT** | | | | | |
| RL-01 | Luồng consent (chỉ EEA/UK/CH) | `requestConsentInfo()` → nếu `REQUIRED` → `showConsentForm()`; khi `canRequestAds === false` thì **không khởi tạo SDK, không hiện banner**; test bằng `AdmobConsentDebugGeography.EEA` trên máy test | Dev | 2,5 | AD-02, AD-03 |
| RL-02 | ATT trên iOS (14+) | Gọi `requestTrackingAuthorization()` **sau** khi người dùng vào qua màn chơi** (không ngay lúc mở app); mô tả `NSUserTrackingUsageDescription` để hiểu và trung thực | Dev | 1,5 | RL-01 |
| RL-03 | Lối vào "Tùy chọn quyền riêng tư" | Nút trong Cài đặt gọi `showPrivacyOptionsForm()`; test khi `privacyOptionsRequirementStatus = REQUIRED` | Dev | 1,5 | RL-01 |
| **E17 — Kiểm thử mobile & nộp store** | | | | | |
| AF-01 | Ma trận thiết bị thật | ≥ 6 thiết bị (Android 8/10/12/14…, iPhone màn nhỏ + màn to) × 3 loại ad × 2 theme; lập bảng kết quả pass/fail | Dev | 1,5 | AD-05, RL-02 |
| AF-02 | Gói nộp duyệt | AAB ký release, IPA, mô tả, ảnh store, chuẩn bị trả lời reviewer; gửi Play Console (internal testing trước) | Dev | 1,5 | AF-01, PO-04 |
| AF-03 | Theo dõi kết quả duyệt | Ghi rõ lý do nếu bị từ chối, RCA và nộp lại | Dev | 1 | AF-02 |
| **E18 — QC mobile & vận hành** | | | | | |
| GD-01 | Checklist QC mobile | Bổ sung `50-QC.md`: ads đúng chỗ/tần suất, consent flow, ATT, không treo app khi ad lỗi, hiệu năng 60fps trên máy yếu | QC | 1,5 | AD-05 |
| GD-02 | Sign-off Giai đoạn 2 | Biên bản nghiệm thu + xác nhận đã bật app trên store (hoặc ghi rõ lý do chưa) | QC | 1 | AF-03, GD-01 |
| **E19 — Runbook mobile** | | | | | |
| MT-01 | Runbook build & sự cố | `40-MAINTENANCE.md` (mục mobile): nâng cấp Capacitor, target SDK hằng năm, ad không hiện, consent sai | Mnt | 1,5 | AF-02 |
| MT-02 | RCA lỗi mobile | Nguyên nhân gốc cho mọi lỗi Critical/Major phát hiện ở AF-01/GD-01 | Mnt | 1 | GD-01 |

**Tổng Giai đoạn 2: 40,5 người-ngày** = E12 5,5 · E13 8 · E14 5,5 · E15 7 · E16 5,5 · E17 4 · E18 2,5 · E19 2,5 → +15% dự phòng ≈ **47 người-ngày**.

---

## 3. Critical Path & Milestone M0→M5

### Đường găng Giai đoạn 1 (~12,5–38 ngày tuỳ năng suất dùng chung)
`P0-01 → P0-02 → D-01 → C-01 → X-03 → A-01 → N-03 → Q-04 → V-04`
*(Các nhánh Designer/Explainer/AI chạy song song, không làm dài đường găng — nhưng nếu D-01 trễ ≥ 2 ngày thì "thiết kế" thành đường găng mới.)*

### Đường găng Giai đoạn 2 (~10,5 ngày lịch tối thiểu)
`G-02 → MB-02 → MB-05 → AD-02 → RL-01 → AF-01 → GD-02 → MT-02` — lưu ý **thời gian chờ duyệt store nằm ngoài năng lực kiểm soát**: thời gian review app "cần kiểm chứng" tại thời điểm nộp (không cam kết con số).

### Milestone & định nghĩa "Done" (kiểm chứng được)

| Mốc | Tên | Điều kiện Done (kiểm chứng được) |
|---|---|---|
| **M0** | Khung chạy được | `python3 -m http.server` → mở trang thấy bàn trống 3×3 vẽ bằng Canvas; `node --test tests/` chạy được (dù fail); `src/config.js` có schema cài đặt |
| **M1** | Engine + AI đạt | `node --test` **100% pass**, gồm test bất biến "tổng điểm = n²" cho n = 3…8 và đối xứng hình học (quay 90° / lật không đổi số cạnh hợp lệ); AI Khó thắng AI Dễ ≥ 85% qua 200 ván tự động (script local) |
| **M2** | Ván chơi hoàn chỉnh | Chơi trọn 1 ván 2 người **và** 1 ván với máy trên desktop: điểm đúng, giữ lượt khi đóng ô, hết giờ mất lượt, màn kết quả đúng người thắng/hòa; không lỗi console |
| **M3** | Trải nghiệm đầy đủ | Có Light + Dark (tự theo hệ thống + nút chuyển); nhạc/SFX bật-tắt và **chỉ phát sau thao tác đầu**; Tutorial chạy hết 5 bước; `prefers-reduced-motion` tắt hiệu ứng; bàn phím chơi được (Tab + Enter) |
| **M4** | Demo sẵn sàng (web) | QC ≥ 95/100, 0 lỗi Critical/Major mở; chạy offline sau lần tải đầu (SW); mở bằng `file://` hiện hướng dẫn thay vì trắng trang; `AdBridge` mock gọi đúng 3 chỗ, tối đa 1 interstitial/2 ván |
| **M5** | Phát hành mobile | Build AAB/IPA cài được trên máy thật; banner hiện đúng Menu/Kết quả và **không che nút**; interstitial chỉ sau ván; rewarded chỉ cấp gợi ý khi xem xong; consent UMP chặn SDK đúng luật; bảng test thiết bị pass 100%, đã nộp store |

---

## 4. Ma trận rủi ro

Thang điểm: Xác suất (P) và Ảnh hưởng (I) 1–5; Điểm = P × I. Vùng: **Cao ≥ 15**, **Trung bình 8–14**, **Thấp ≤ 7**.

| ID | Rủi ro | P | I | Điểm | Giảm thiểu / phương án B | Chịu trách nhiệm |
|---|---|---|---|---|---|---|
| R-01 | **AI "Khó" không thực sự mạnh** — Dots & Boxes có lời giải chặt; người chơi giỏi sẽ bắt bài và thấy "Khó" quá dễ | 4 | 4 | **16 (Cao)** | Không hứa "bất khả chiến bại"; A-03 dùng lookahead + chain heuristic và có test đối kháng; nếu vẫn yếu → nâng lookahead (đo thời gian, ≤ 50ms) hoặc thêm nhiễu có chủ đích cho mức Dễ/Trung bình để khoảng cách mức rõ hơn | Dev (+ QC test) |
| R-02 | **Vòng lặp thời gian gây lỗi double-turn** (hết giờ + bấm cạnh cùng lúc; AI chậm; tab ẩn rồi quay lại) | 4 | 5 | **20 (Cao)** | Một nguồn thời gian duy nhất (`performance.now`), mỗi lượt có `turnSeq` tăng dần — mọi callback cũ tự bỏ; `applyMove` idempotent (cạnh đã tô → bỏ qua); tạm dừng khi `visibilitychange`; test riêng cho timer | Dev |
| R-03 | **Canvas lag/giật trên máy yếu** (màn 8×8, nhiều hiệu ứng, DPR cao trên điện thoại giá rẻ) | 4 | 3 | **12 (TB)** | Render theo dirty flag, không vẽ full frame; DPR cap 2× (hạ 1,5 khi fps < 45); tắt glow/shadow; đo fps trên máy thật tại MB-05/N-04 | Dev |
| R-04 | **Web Audio bị chặn autoplay (đặc biệt iOS Safari)** — BGM im lặng hoặc lỗi | 5 | 3 | **15 (Cao)** | Chỉ `AudioContext.resume()` trong handler thao tác đầu tiên; nếu `state === 'suspended'` thì chờ; UI có nút bật nhạc thay thế; test trên iPhone thật | Dev |
| R-05 | **Chính sách AdMob/Google Play cho trẻ em (Families policy)** — nếu app bị coi là nhắm trẻ em: bắt buộc SDK quảng cáo đã chứng nhận, **cấm quảng cáo cá nhân hoá**, có màn hình tuổi trung lập | 3 | 5 | **15 (Cao)** | Mặc định **không khai Target Audience là trẻ em**, nội dung/ảnh store trung tính người lớn; nếu chọn nhắm trẻ em → bật tag "child-directed" (`MaxAdContentRating.General`, `tagForChildDirectedTreatment`) và tắt cá nhân hoá — **cần kiểm chứng lại** quy định hiện hành khi làm | Dev |
| R-06 | **Bị từ chối duyệt vì WebView chỉ là website** (Google Play "WebViews / website-like app"; Apple 4.2 Minimum Functionality) | 3 | 5 | **15 (Cao)** | Bổ sung chức năng native tối thiểu (splash, plugin native, rung, offline, không thanh địa chỉ); trả lời reviewer rõ ràng; nộp internal testing trước; chuẩn bị kịch bản kháng nghị | Dev |
| R-07 | **Cấu hình AdMob sai** (thiếu App ID, đặt ID app vào chỗ ad unit, thiếu SKAdNetwork) → ad không hiện hoặc app crash | 3 | 4 | **12 (TB)** | Checklist cấu hình trong `40-MAINTENANCE.md`; luôn thử bằng test ad unit trước; cài đặt độ trễ khởi tạo SDK sau consent | Dev |
| R-08 | **`file://` chặn ES module** — người dùng bấm `index.html` thấy trang trắng | 5 | 2 | **10 (TB)** | P0-02: phát hiện và hiện hướng dẫn rõ ràng thay vì màn hình trắng; README + `40-MAINTENANCE.md` có lệnh `python3 -m http.server` | Dev (+ Mnt viết hướng dẫn) |
| R-09 | **Timer/UX gây ức chế** (20s quá ngắn khi bàn 8×8, người mới thua liên tục) | 3 | 3 | **9 (TB)** | Timer mặc định bật nhưng tắt được, cho chọn 10/20/30s; Tutorial trước ván đầu; AI Dễ thực sự dễ | Des + Exp |
| R-10 | **Lạm dụng quảng cáo làm người dùng bỏ** (interstitial chen giữa ván, che nút ở màn hẹp) | 2 | 4 | **8 (TB)** | G-03/G-04 chặn cứng ở tầng code; banner ẩn trong ván; QC GD-01 test riêng "không che nút" | QC |
| R-11 | **Phình phạm vi** (thêm online, level, mua bỏ ads) | 3 | 3 | **9 (TB)** | Mọi yêu cầu mới ghi vào mục 8 (câu hỏi mở), không tự thêm; chỉ Orchestrator duyệt đổi phạm vi | Orchestrator |
| R-12 | **Thiếu thiết bị test iOS** (không có iPhone/Mac để build) | 3 | 4 | **12 (TB)** | Dùng macOS + Xcode + 1 iPhone thật tối thiểu; nếu không có → Giai đoạn 2 chỉ phát hành Android trước, iOS lùi milesteon (ghi rõ khi đó) | Dev |
| R-13 | **Target API level lỗi thời** — Google Play buộc nâng mỗi năm, app cũ không cập nhật được nữa | 3 | 3 | **9 (TB)** | Ghi quy trình nâng target SDK hằng năm trong `40-MAINTENANCE.md`; **kiểm chứng lại con số tại thời điểm phát hành** | Mnt |
| R-14 | **Regressions khi sửa sau QC** (sửa A vỡ B) | 3 | 3 | **9 (TB)** | `node --test` bắt buộc chạy lại sau mọi thay đổi engine/AI; QC V-03 regression trước khi sign-off | QC |

---

## 5. Lộ trình Giai đoạn 2 — Mobile & Monetization (từng bước thực thi được)

> ⚠️ **Nguyên tắc số liệu:** mọi con số version dưới đây **đã đối chiếu tài liệu chính thức tại 2026-11-13**, nhưng hệ sinh thái này thay đổi nhanh — **bắt buộc kiểm chứng lại tại thời điểm làm**. Con số nào không chắc sẽ ghi rõ _"cần kiểm chứng"_.

**Bước 1 — Chuẩn bị môi trường.** Node ≥ 22 (yêu cầu của Capacitor 8), Android Studio **Otter | 2025.2.1+** (mức tối thiểu của Capacitor 8), AGP **8.13.0**, Gradle wrapper **8.14.3**; iOS cần **Xcode 26.0+** (Capacitor 8) và deployment target **iOS 15.0** — nền tảng yêu cầu của Apple cần kiểm chứng tại thời điểm nộp. Cài: `npm i @capacitor/core@8 @capacitor/cli@8`.
**Bước 2 — Khởi tạo.** `npx cap init "Cờ Ô Vuông" com.<tên-bạn>.dotsboxes --web-dir=<thư mục web>`; `npx cap add android`; `npx cap add ios` (Capacitor 8 mặc định tạo project **SPM**; dùng `--packagemanager CocoaPods` nếu muốn CocoaPods).
**Bước 3 — Cấu hình Android.** `android/variables.gradle`: `minSdkVersion 24`, `compileSdkVersion 36`, `targetSdkVersion 36`, AndroidX theo khuyến nghị Capacitor 8; thêm `density` vào `android:configChanges` để WebView không reload khi xoay/đổi kích thước. **Target API level:** Google Play hiện yêu cầu **app mới và bản cập nhật nhắm API 36 (Android 16)+**; app hiện có cần tối thiểu API 35 — **cần kiểm chứng lại** ngưỡng và mốc thời gian mỗi năm.
**Bước 4 — Cấu hình iOS.** `Info.plist`: `GADApplicationIdentifier`, `GADIsAdManagerApp=true`, `NSUserTrackingUsageDescription` (câu tiếng Việt trung thực), `SKAdNetworkItems` gồm ID của Google và danh sách đầy đủ theo hướng dẫn Google.
**Bước 5 — Cài plugin AdMob.** `npm i @capacitor-community/admob` (v8.2.0, cần **Capacitor 8.5+**, iOS 15+, Android API 24+, GMA SDK 25.4.x Android / 13.11.0 iOS — **cần kiểm chứng** bản mới nhất). Android: `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="@string/admob_app_id"/>` + `strings.xml`. **Không thêm dependency Mobile Ads thứ hai.**
**Bước 6 — Map `window.AdBridge` → plugin.** Giữ nguyên hợp đồng từ Giai đoạn 1:
- `showBanner()` → `AdMob.showBanner({adId, adSize: BannerAdSize.ADAPTIVE_BANNER, position: BannerAdPosition.BOTTOM_CENTER, margin:0})`; ẩn bằng `AdMob.hideBanner()`/`removeBanner()`.
- `showInterstitial()` → `await AdMob.prepareInterstitial({adId})` (chuẩn bị sớm) rồi `await AdMob.showInterstitial()` **chỉ khi đã ở màn Kết quả**; đăng ký sẵn listener `InterstitialAdPluginEvents.Dismissed` để resolve `{completed:true}`, `{completed:false}` khi `FailedToShow`.
- `showRewarded()` → `AdMob.prepareRewardVideoAd({adId})` → `AdMob.showRewardVideoAd()`; **chỉ cấp gợi ý khi nhận sự kiện `onRewardedVideoAdReward`** (hằng số `RewardAdPluginEvents.Rewarded`) (sự kiện `Dismissed` không được dùng để cấp thưởng).
- Mọi lỗi → fallback mock/no-op để game chạy tiếp (timeout 5 giây).
**Bước 7 — Policy interstitial (tầng code, không phải tầng "người dùng tự nhớ"):** tối đa **1 interstitial / 2 ván**, **không bao giờ** trong lúc đang chơi (chặn bằng state = `Result`), **không che nút** (banner không phủ lên HUD/nút), không interstitial ngay lần mở app đầu tiên, không hiện ad khi app mất focus/đang resume. *(Các giới hạn chi tiết của AdMob như khoảng giãn tối thiểu — **cần kiểm chứng** theo hướng dẫn hiện hành.)*
**Bước 8 — Consent GDPR/UMP:** mỗi lần mở app gọi `AdMob.requestConsentInfo()`; nếu `status === REQUIRED` → `AdMob.showConsentForm()`; **chỉ** `AdMob.initialize()` và hiện banner khi `canRequestAds === true`. Lối vào "Tùy chọn quyền riêng tư" gọi `showPrivacyOptionsForm()`. Test EEA bằng `AdmobConsentDebugGeography.EEA` trên thiết bị test.
**Bước 9 — ATT trên iOS:** gọi `AdMob.requestTrackingAuthorization()` **sau** khi người dùng đã chơi/qua màn hình đầu hoặc từ Cài đặt (không ngay khi mở app), kiểm tra `trackingAuthorizationStatus()`; mô tả trong `NSUserTrackingUsageDescription` phải khớp mục đích thật.
**Bước 10 — Target audience & Families:** mặc định khai **người dùng phổ thông, không nhắm trẻ em**; giữ nội dung/ảnh store trung tính. Nếu sau này nhắm trẻ em: **bắt buộc** dùng SDK quảng cáo đã chứng nhận, **không cá nhân hoá** (`npa: true` / tag child-directed), và có màn hình tuổi trung lập — **cần kiểm chứng** chi tiết hiện hành.
**Bước 11 — Test ad unit trước khi dùng ID thật:** banner Android `ca-app-pub-3940256099942544/6300978111`, banner iOS `ca-app-pub-3940256099942544/2934735716` (ID demo chính thức của Google); chỉ dùng cho kiểm thử.
**Bước 12 — Nộp duyệt:** ký AAB, internal testing → production; iOS TestFlight → App Store; ghi lại lý do nếu bị từ chối (AF-03).
**Số liệu tài chính:** **không cam kết** eCPM, doanh thu hay thời gian review — mọi con số loại này là **khoảng tham khảo khác nhau theo quốc gia/định dạng, cần kiểm chứng** bằng dashboard AdMob thật sau khi phát hành.

---

## 6. Chiến lược kiểm thử & Definition of Done

### 6.1 Unit test engine bằng `node --test` (bắt buộc, không thư viện)
Chạy `node --test tests/` (Node ≥ 18, không cần `npm install`). Bộ test tối thiểu: số cạnh trong = `2n(n+1)` − 4n; viền ngoài không tô lại được; tổng điểm **luôn = n²** cho mọi n = 3…8 và mọi chuỗi nước đi; đóng ô → giữ lượt; hết cạnh → kết thúc; không nước đi bất hợp lệ nào làm hỏng state; đối xứng state sau `serialize`/`deserialize`. Test AI: không tự mở ô khi còn cạnh an toàn; AI Khó thắng Dễ ≥ 85% trong 200 ván seed cố định. Test timer: mô phỏng callback đến muộn (turnSeq cũ) → **không** được mất lượt hai lần.

### 6.2 Test thủ công cross-browser
Chrome, Edge, Firefox và Safari (desktop + Safari iOS). Mỗi trình duyệt: luật chơi 1 ván 5×5, oẳn tù tì, timer (bật/tắt/hết giờ), theme theo hệ thống, audio lần đầu, Tutorial, bàn phím, `file://` (hiện hướng dẫn), offline qua SW.

### 6.3 Ma trận thiết bị
Android tầm trung (Android 10+), Android máy yếu (RAM 2 GB), iPhone màn nhỏ (SE), iPhone màn lớn, tablet. Đo: fps khi chơi 8×8, thời gian tải, cảm nhận bấm cạnh. Giai đoạn 2 mở rộng: 3 loại ad × 2 theme × ≥ 6 thiết bị.

### 6.4 Definition of Done của cả dự án
1. `node --test` **100% pass**, không test bị skip. 2. Không `TODO`, không `console.log` rác trong bản phát hành. 3. QC ≥ **95/100**, không còn lỗi Critical/Major. 4. Chơi được **offline** và trên `file://` có hướng dẫn rõ. 5. Light/Dark + `prefers-reduced-motion` + bàn phím đều hoạt động. 6. Timer không bao giờ gây double-turn (có test chứng minh). 7. `AdBridge` hoạt động ở cả mock (web) và native (mobile) **không sửa logic game**. 8. Tài liệu `20/30/40/50` đầy đủ. 9. Giai đoạn 2: consent UMP chặn SDK đúng khi `canRequestAds=false`; interstitial ≤ 1 lần/2 ván và không che nút; app đã nộp store với bằng chứng.

---

## 7. Bảng phân công & thứ tự thực thi cho pipeline hiện tại

| Bước | Agent | Việc cần làm | Input | Output | Cổng thoát |
|---|---|---|---|---|---|
| 1 | **Orchestrator** | Ban hành brief, chốt phạm vi, điều phối | Yêu cầu người dùng | `00-BRIEF.md` | Brief chốt |
| 2 | **Planning** (agent này) | WBS, critical path, rủi ro, lộ trình GĐ2 | Brief | `10-PLAN.md` | Plan được duyệt |
| 3 | **Designer** | Design token, wireframe, spec animation, icon | D-01…D-04 trong Plan | `20-DESIGN.md` + CSS token | Tương phản WCAG ≥ 4.5:1 cho text |
| 4 | **Explainer** | Nội dung Tutorial 5 bước cho người mới | Brief §3 | `30-TUTORIAL.md` | Người chưa biết game đọc hiểu được |
| 5 | **Dev** | Hiện thực E1, E3–E9, E11 theo thứ tự: engine → timer/AI → render → audio → UI → tutorial → PWA → `AdBridge` mock | Plan + Design + Tutorial | `index.html`, `src/*`, `tests/*` | M0→M3 đạt |
| 6 | **Maintenance** | `40-MAINTENANCE.md`, hiệu năng, RCA lỗi | Bản build | Tài liệu vận hành | Hướng dẫn chạy được bởi người không chuyên |
| 7 | **QC** | Checklist, audit, regression, sign-off | Toàn bộ sản phẩm | `50-QC.md` + điểm /100 | ≥ 95/100, 0 Critical/Major |
| 8 | **Orchestrator** | Nghiệm thu M4, quyết định sang Giai đoạn 2 | Báo cáo QC | Sign-off | M4 đạt |
| 9 | **Dev → QC** (GĐ2) | E12–E17 → E18 | M4 | App + báo cáo mobile | M5 đạt |

**Song song hóa:** Bước 3 và 4 chạy song song sau khi Plan duyệt. Dev bắt đầu E1/E3 **ngay khi có Plan** (không chờ Designer), vì engine không phụ thuộc thẩm mỹ. Designer phải xong D-01 trước C-01/N-01 thực chất.

---

## 8. Giả định & câu hỏi mở

| # | Điểm mơ hồ | **Giả định mặc định (dùng ngay được)** | Cần người dùng xác nhận? |
|---|---|---|---|
| Q1 | App có nhắm **trẻ em** không? | **Không.** Khai target audience người dùng phổ thông → tránh ràng buộc Families policy | Có (ảnh hưởng lớn tới quảng cáo + review) |
| Q2 | Điện thoại **khóa dọc** hay cho xoay? | **Khóa dọc** (bàn vuông vẫn vừa, đơn giản hoá layout) | Nên xác nhận |
| Q3 | Ngôn ngữ UI | **Chỉ tiếng Việt** | Không (brief đã chốt) |
| Q4 | Rewarded "gợi ý nước đi" dùng cho **cả 2 người cùng máy** hay chỉ khi đấu với máy? | Chỉ khi chơi với máy | Có |
| Q5 | Giới hạn thời gian: giá trị mặc định 20s, có muốn cho chọn 10/20/30s? | Cho chọn 3 mức, mặc định 20s | Không bắt buộc |
| Q6 | Ứng dụng nộp store dùng tên/ID gì? | `Cờ Ô Vuông`, package `com.dotsboxes.game` (tạm) | Có |
| Q7 | ECPM / doanh thu kỳ vọng | **Không cam kết** — chỉ báo cáo số thật sau phát hành | Không |
| Q8 | Có tài khoản Google Play/AdMob & Apple Developer chưa? | Chưa có → AD-01 chặn mốc M5 | Có (chi phí, thời gian xác minh) |

---

## 9. Checklist 24 giờ (việc cần làm tiếp ngay)

- [ ] **Orchestrator:** duyệt Plan này, chốt Q1 (trẻ em?) và Q4 (rewarded cho chế độ nào).
- [ ] **Designer:** nhận D-01, chốt 2 bảng màu Light/Dark và kiểm tra tương phản bằng `designer_helper.py`.
- [ ] **Explainer:** soạn khung Tutorial 5 bước (`30-TUTORIAL.md` phiên bản đầu).
- [ ] **Dev:** dựng khung thư mục theo Brief §5, tạo `src/config.js` và `engine.js` khung — hướng tới **M0 trong ngày đầu**.
- [ ] **Orchestrator:** xác nhận người dùng có sẵn **Node ≥ 18** để chạy `node --test` (nếu chưa, Dev dùng script kiểm thử Node-free tạm).
- [ ] **Maintenance:** chuẩn bị khung `40-MAINTENANCE.md` (mục "cách chạy local" viết trước).
- [ ] **QC:** dựng checklist `50-QC.md` từ mục 3 và mục 6 của kế hoạch này.
- [ ] **Người dùng:** mở `docs/00-BRIEF.md` và xác nhận 3 điều dễ gây làm lại: Q1, Q2, Q4.
