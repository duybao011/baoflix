# BảoFlix TV Overlay Deep Fix

Patch này chỉ sửa phần TV/watch/overlay. Không sửa API, không sửa `lib/kkphim.ts`, không sửa trang chủ `/`.

## Sửa gì

- Bỏ `TvSeekFocusBridge` khỏi layout để không còn 2 handler remote cùng bắt phím.
- TV watch mặc định dùng `link_embed` / Web player để ưu tiên xem được trước.
- HLS vẫn có nút riêng `HLS tua 10s` cho phim nào m3u8 chạy ổn.
- Overlay có thêm nút đổi player: `Web player` / `HLS tua 10s`.
- `FullscreenPlayerBox` không tự focus iframe khi vào TV mode để app không mất quyền bắt remote.
- `TvPlayerCommandBridge` thử gửi phím vào iframe rồi trả focus về surface để overlay/remote không bị kẹt.
- `/xem/[slug]` tự chọn server đầu tiên có tập nếu server query hiện tại rỗng.

## Cách dùng Windows

```bat
apply_patch.bat C:\Users\Moderator\baoflix
```

Hoặc double click `apply_patch.bat` rồi dán/kéo thả thư mục project.

## Test

1. `npm run build`
2. Mở `/tv`
3. Chọn phim
4. Bấm `Xem ngay`
5. Nếu Web player xem được: giữ Web player.
6. Nếu cần tua bằng app: chọn `HLS tua 10s` trong overlay/trang xem.

## Ghi chú

- Web player iframe cross-origin không thể tua chắc 100% bằng code ngoài app.
- HLS/video same-document mới tua chuẩn bằng `video.currentTime += 10`.
