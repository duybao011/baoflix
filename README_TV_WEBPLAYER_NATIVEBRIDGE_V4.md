# BảoFlix TV WebPlayer Native Bridge v4

Bản này chỉ sửa phần TV/watch overlay. Không sửa API, không sửa `lib/kkphim.ts`, không sửa `app/page.tsx`.

## Mục tiêu

- Bỏ HLS khỏi TV mode.
- Chỉ dùng Web player / `link_embed` iframe.
- Không gọi `iframe.contentWindow.dispatchEvent(...)` để tránh lỗi cross-origin.
- Overlay có chọn tập nhanh thật.
- Thêm hook `BaoFlixTVNative` để APK TV native có thể gửi KeyEvent thật cho WebView.

## Files copy vào project

- `app/layout.tsx`
- `app/xem/[slug]/page.tsx`
- `components/WatchClient.tsx`
- `components/TvWatchOverlay.tsx`
- `components/TvRemoteNavigator.tsx`
- `components/TvPlayerCommandBridge.tsx`
- `components/FullscreenPlayerBox.tsx`

## Cách dùng Windows

```bat
apply_patch.bat C:\Users\Moderator\baoflix
```

hoặc bấm đôi `apply_patch.bat`, rồi dán đường dẫn project.

Sau đó chạy:

```bat
cd C:\Users\Moderator\baoflix
npm run build
```

## Test

1. Vào `/tv`.
2. Chọn phim.
3. Bấm `Xem ngay`.
4. Trang xem phải hiện Web player.
5. Bấm overlay:
   - `Focus player`: đưa focus vào iframe player.
   - `Tập / nguồn`: đổi Vietsub / Thuyết minh / Lồng tiếng.
   - `Chọn tập`: hiện tập nhanh của nguồn hiện tại.
   - `Thử tua`: gọi native bridge nếu APK có, nếu chưa có thì focus iframe và thử phím an toàn.

## APK native bridge

Trong thư mục `android-tv-native-bridge` có mẫu Kotlin để gắn vào APK WebView shell.

Nếu chỉ chạy web Next.js trong browser/localhost thì chưa có `BaoFlixTVNative`, nên tua bằng Web player vẫn hên xui. Muốn giống app TV native hơn thì phải chèn bridge vào APK.
