# BảoFlix TV Stability Patch — Đợt 1

Patch này chỉ ổn định TV/player/remote, không thêm thư viện phim, TMDB, sync hay backend.

## File được thay đổi / thêm

- `components/TvRemoteNavigator.tsx`
- `components/TvWatchOverlay.tsx`
- `components/FullscreenPlayerBox.tsx`
- `components/WatchClient.tsx`
- `components/NativeVideoPlayer.tsx` mới

## Điểm chính

1. Remote TV chạy theo contract ổn định:
   - OK/Enter: play/pause khi đang ở player; chọn item khi đang focus vào nút/panel.
   - ←/→: tua 10s khi overlay ẩn hoặc chưa focus vào control.
   - ↑/↓: peek overlay, không pause video.
   - Back: đóng modal/panel trước, ẩn overlay sau, rồi mới thoát trang.

2. Overlay chuyển thành 3 trạng thái:
   - `hidden`: không che phim.
   - `peek`: hiện control nhỏ, tự ẩn sau khoảng 3.4s.
   - `panel`: mở tập/nguồn, không tự ẩn cho tới khi Back/Đóng.

3. Overlay TV nhỏ lại khoảng 50% so với bản trước:
   - Nút thấp hơn.
   - Text nhỏ hơn.
   - Panel hẹp hơn.
   - Ít chữ hướng dẫn hơn.

4. Player ổn định hơn:
   - Nếu tập có `link_m3u8`, dùng `NativeVideoPlayer` bằng `<video>` + `hls.js`.
   - Nếu chỉ có `link_embed`, vẫn dùng iframe nhưng remote sẽ focus player và hiện hint fallback.
   - Có Media Session action handlers cho play/pause/seek khi WebView/browser hỗ trợ.

5. Focus memory nhẹ:
   - Nhớ focus theo pathname bằng `href` hoặc `data-tv-focus-key` nếu có.
   - Khi quay lại trang, TV mode cố gắng focus lại item cũ.

## Cách apply

### Windows

Copy ZIP vào thư mục gốc project rồi chạy:

```bat
apply_patch.bat
```

### macOS/Linux

```bash
chmod +x apply_patch.sh
./apply_patch.sh
```

## Test sau khi apply

Chạy:

```bash
npm run build
npm run lint
```

Sau đó test trên TV/APK:

- Vào `/tv` hoặc mở link xem với `?tv=1`.
- Vào player, đợi 3–4s: overlay phải tự ẩn.
- Bấm ↑/↓: overlay hiện nhỏ, video không pause.
- Bấm ←/→ khi overlay ẩn: tua 10s.
- Bấm OK khi overlay ẩn: play/pause với native HLS, iframe thì fallback focus player.
- Mở panel tập/nguồn, bấm Back: chỉ đóng panel.
- Khi overlay hiện, bấm Back: chỉ ẩn overlay.
- Khi overlay ẩn, bấm Back: mới thoát trang xem.

## Lưu ý

- `hls.js` đã có trong `package.json` hiện tại của BảoFlix.
- Nguồn iframe cross-origin không thể điều khiển chắc 100% bằng JavaScript. Patch này chỉ focus iframe và báo fallback; nguồn HLS/m3u8 mới là đường điều khiển ngon nhất cho TV.
