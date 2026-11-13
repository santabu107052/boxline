# Đóng gói mobile — Boxline (giai đoạn 2)

Hướng dẫn ngắn để bọc bản web hiện tại thành app Android/iOS bằng **Capacitor** và gắn **AdMob**.
Logic game **không phải sửa**: chỉ thay phần thân của `window.AdBridge` (mock) bằng plugin AdMob.
Nguồn chi tiết: `docs/10-PLAN.md` mục 5.

> ⚠️ **Mọi con số version dưới đây "cần kiểm chứng"** tại thời điểm làm. Hệ sinh thái
> Capacitor/AdMob đổi rất nhanh; đừng tin version trong tài liệu cũ.

## 0. Danh tính sản phẩm (đã chốt)

| Hạng mục | Giá trị |
|---|---|
| Tên nộp store | `Boxline: Dots & Boxes` |
| Tên hiển thị (launcher) | `Boxline` |
| Tên localize tiếng Việt | `Cờ Ô Vuông` |
| Bundle id / applicationId | `com.santabu.boxline` |

## 1. Chuẩn bị (mọi version **cần kiểm chứng**)

- Node ≥ 22 (yêu cầu của Capacitor 8).
- Android Studio Otter | 2025.2.1+; AGP 8.13.0; Gradle wrapper 8.14.3.
- Xcode 26.0+ (Capacitor 8) và deployment target iOS 15.0.
- `npm i @capacitor/core@8 @capacitor/cli@8`

## 2. Khởi tạo

```bash
# webDir phải là thư mục chứa index.html (dự án hiện tại dùng gốc thư mục)
npx cap init "Boxline" com.santabu.boxline --web-dir=.
npx cap add android
npx cap add ios          # Capacitor 8: mặc định SPM; dùng --packagemanager CocoaPods nếu cần
node build-bundle.mjs    # nếu muốn bundle một tệp (không bắt buộc cho WebView)
npx cap sync
```

Nếu giữ cấu trúc thư mục hiện tại, đặt `webDir` trỏ tới thư mục chứa `index.html`, `src/`, `manifest.webmanifest`.

## 3. Cấu hình Android

`android/variables.gradle`:
```gradle
minSdkVersion = 24
compileSdkVersion = 36
targetSdkVersion = 36
```
Thêm `density` vào `android:configChanges` để WebView không reload khi xoay/đổi kích thước.
Ngưỡng targetSdk mà Google Play yêu cầu **thay đổi hằng năm — cần kiểm chứng**.

## 4. Cấu hình iOS

`Info.plist`:
```xml
<key>GADApplicationIdentifier</key><string>ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY</string>
<key>GADIsAdManagerApp</key><true/>
<key>NSUserTrackingUsageDescription</key>
<string>Cho phép dùng mã nhận dạng để hiện quảng cáo phù hợp hơn. Bạn có thể từ chối và vẫn chơi bình thường.</string>
<key>SKAdNetworkItems</key> … <!-- theo danh sách Google công bố (cần kiểm chứng) -->
```

## 5. Gắn AdMob

```bash
npm i @capacitor-community/admob     # version cần kiểm chứng (tài liệu ghi v8.2.0, cần Capacitor 8.5+)
```
Android: `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="@string/admob_app_id"/>`
+ khai báo `admob_app_id` trong `strings.xml`. **Không** thêm dependency Mobile Ads thứ hai.

## 6. Thay phần thân `window.AdBridge`

Giữ nguyên chữ ký 3 hàm như bản web (`src/main.js`):

- `showBanner()` → `AdMob.showBanner({ adSize: ADAPTIVE_BANNER, position: BOTTOM_CENTER })`; ẩn bằng `hideBanner()`/`removeBanner()`.
- `showInterstitial()` → `prepareInterstitial()` sớm, `showInterstitial()` **chỉ khi đang ở màn Kết quả**;
  resolve `{completed:true|false}` từ sự kiện `Dismissed` / lỗi `FailedToShow`.
- `showRewarded()` → `prepareRewardVideoAd()` → `showRewardVideoAd()`; **chỉ cấp gợi ý** khi nhận
  `RewardAdPluginEvents.Rewarded`. Không dùng `Dismissed` để cấp thưởng.
- Mọi lỗi → fallback no-op + timeout 5 giây để game không bị treo.

## 7. Policy (thực thi ở tầng code, không nhờ người dùng nhớ)

- Tối đa **1 interstitial / 2 ván** — đã cài sẵn trong mock (`INTERSTITIAL_EVERY_N_GAMES`).
- **Không** interstitial giữa ván (mock chặn bằng `inGame: true`).
- Không hiện ngay lần mở app đầu tiên; không hiện khi app mất focus.
- Các giới hạn chi tiết khác của AdMob **cần kiểm chứng** theo hướng dẫn hiện hành.

## 8. Consent & ATT

- GDPR/UMP: `requestConsentInfo()`; `status === REQUIRED` → `showConsentForm()`; chỉ `initialize()`
  và hiện banner khi `canRequestAds === true`. Lối vào "Quyền riêng tư" gọi `showPrivacyOptionsForm()`.
- iOS ATT: gọi `requestTrackingAuthorization()` **sau** khi người dùng đã chơi qua màn hình đầu
  (hoặc từ Cài đặt), không gọi ngay khi mở app.

## 9. Test ad unit (bắt buộc trước khi dùng ID thật)

- Banner Android: `ca-app-pub-3940256099942544/6300978111`
- Banner iOS: `ca-app-pub-3940256099942544/2934735716`

## 10. Kiểm thử trên máy thật (checklist)

- [ ] Xoay ngang/dọc không reload WebView, bàn cờ vẫn vuông và bấm chuẩn.
- [ ] Safe-area: nút ⚙ và nút đóng modal không chui dưới tai thỏ / home indicator.
- [ ] Banner hiện/ẩn **không** làm layout nhảy (khung `#ad-slot` giữ nguyên 50px).
- [ ] Interstitial chỉ xuất hiện sau màn Kết quả ≥ 1.2s, tối đa 1 lần / 2 ván.
- [ ] Rewarded chỉ cộng gợi ý khi có sự kiện `Rewarded`.
- [ ] Chế độ im lặng của máy tắt được âm thanh; nhạc nền dừng khi app xuống nền.
- [ ] Tắt mạng hoàn toàn: game vẫn chơi được (offline 100%).
