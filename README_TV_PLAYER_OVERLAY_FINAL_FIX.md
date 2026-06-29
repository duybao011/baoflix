# BảoFlix TV Player Overlay Final Fix

Patch này xử lý đúng lỗi: BảoFlix overlay đã ẩn nhưng control bar/player gốc vẫn còn hiện ở giữa/dưới video trên TV.

## Thay đổi chính

- Native HLS `<video>` không còn dùng `controls`, nên browser/native control bar không hiện đè lên video.
- Native HLS tự gọi `play()` khi manifest/metadata sẵn sàng, đồng thời vẫn bắt lỗi autoplay bị chặn.
- Remote command không focus trực tiếp vào `<video>` nữa, mà focus vào remote sink bên ngoài để tránh native controls bật lên.
- FullscreenPlayerBox không focus iframe/video khi overlay ẩn nữa.
- Iframe trong TV mode được thêm autoplay params và bị bỏ khỏi D-pad focus để tránh web player gốc hiện thanh control mãi.
- Hint iframe được đổi lại cho đúng logic mới.

## Cách apply

Giải nén ZIP vào root project `baoflix`, rồi chạy:

```bat
apply_patch.bat
```

Hoặc Linux/macOS:

```bash
./apply_patch.sh
```

Sau đó chạy:

```bash
npm run lint
npm run build
```

## Test TV nhanh

1. Mở phim có `link_m3u8`.
2. Vào trang xem: phim phải tự chạy nếu WebView cho phép autoplay.
3. Để im 3–4 giây: BảoFlix overlay ẩn và không còn thanh control gốc ở dưới/giữa video.
4. Bấm ↑/↓: chỉ hiện BảoFlix overlay, không pause.
5. Bấm ←/→: tua 10s, video vẫn giữ trạng thái đang chạy.
6. Bấm OK: play/pause theo chuẩn Android TV.
7. Nếu nguồn chỉ có iframe: BảoFlix không focus vào iframe mặc định để tránh thanh player gốc hiện mãi; autoplay iframe phụ thuộc player bên trong có hỗ trợ tham số autoplay hay không.
