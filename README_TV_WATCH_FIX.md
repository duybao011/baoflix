# BảoFlix TV Watch Fix

Bản này chỉ sửa luồng TV/watch, không đụng API, không đụng lib/kkphim.ts, không đụng trang chủ app/page.tsx.

## File thay đổi

- app/layout.tsx
  - Bỏ TvSeekFocusBridge khỏi layout để tránh hai lớp remote cùng bắt phím.
- app/xem/[slug]/page.tsx
  - Nếu server query rỗng/không có tập, tự nhảy sang server đầu tiên có tập.
- components/WatchClient.tsx
  - TV mode ưu tiên Web player/iframe trước để xem được ổn định.
  - HLS/m3u8 trở thành lựa chọn phụ bằng nút “HLS tua bằng remote”.
  - Iframe luôn tabIndex=0 để TV WebView có thể focus player.
  - Nếu tập không có link, báo rõ và hướng dẫn đổi Tập / nguồn.

## Cách dùng Windows

```bat
apply_patch.bat C:\Users\Moderator\baoflix
```

Hoặc bấm đôi apply_patch.bat rồi dán/kéo thả thư mục project vào.

Sau đó chạy:

```bat
cd C:\Users\Moderator\baoflix
npm run build
npm run start
```

Test nhanh:

- Mở /tv
- Bấm vào phim
- Bấm Xem ngay
- Nếu nguồn Web player không chạy, bấm Tập / nguồn để đổi server
- Nếu muốn tua remote bằng HLS, chọn nút “HLS tua bằng remote” trong trang xem

## Vì sao sửa vậy?

Bản trước ép TV mode dùng HLS/m3u8 trước. Một số nguồn m3u8 có thể lỗi trên WebView TV hoặc CORS, làm normal mode xem được bằng iframe nhưng TV mode lại không xem được. Bản này ưu tiên xem được trước: iframe/Web player là mặc định nếu có, HLS chỉ là lựa chọn phụ.
