# BảoFlix TV Pause Logic Fix

Patch nhỏ sau bản `tv-player-overlay-final-fix`.

## Sửa gì

- Khi user bấm OK để tạm dừng, video giữ trạng thái pause cho đến khi user bấm OK/play lại.
- `focus-player` / ẩn overlay / auto-hide overlay không còn gọi play ngầm.
- Autoplay chỉ chạy khi mới vào tập hoặc đổi nguồn/tập, không chạy lại sau khi user đã pause.
- Tua trái/phải vẫn hoạt động khi đang pause, nhưng không tự play lại sau khi tua.

## File thay đổi

- `components/NativeVideoPlayer.tsx`

## Cách apply

Chạy ở thư mục gốc project:

```bash
apply_patch.bat
# hoặc
./apply_patch.sh
```

Sau đó:

```bash
npm run lint
npm run build
```

## Test nhanh trên TV

1. Vào một phim có Native HLS/m3u8.
2. Đợi video tự chạy.
3. Bấm OK để pause.
4. Để im 5-10 giây, overlay tự ẩn.
5. Video phải vẫn pause, không tự chạy lại.
6. Bấm trái/phải khi pause: tua được nhưng vẫn pause.
7. Bấm OK lần nữa: video chạy lại.
