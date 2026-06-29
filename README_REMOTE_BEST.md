# BaoFlix TV Remote Best Drop-in

Ban nay gom lai logic remote theo huong "mot bo nao remote" giong app TV that hon.

## Cach ap dung tren Windows de nhat

1. Giai nen ZIP.
2. Mo thu muc `baoflix_remote_best_dropin`.
3. Bam dup `apply_patch.bat`.
4. Keo/tha thu muc project `baoflix` vao cua so CMD hoac dan duong dan, vi du:

```text
C:\Users\Bao\baoflix
```

Batch se tu:

- Copy `app/layout.tsx` vao project.
- Copy cac file trong `components` vao project.
- Xoa `components\TvSeekFocusBridge.tsx` neu con ton tai, de tranh 2 lop cung bat remote.
- Hoi co chay `npm run lint` va `npm run build` hay khong.

## Cach ap dung tren macOS/Linux/Git Bash

```bash
./apply_patch.sh /duong/dan/toi/baoflix
cd /duong/dan/toi/baoflix
npm run lint
npm run build
```

## File trong patch

- `app/layout.tsx`: bo import/render `TvSeekFocusBridge`.
- `components/TvRemoteNavigator.tsx`: bo dieu khien chinh cho D-pad/OK/Back/media keys.
- `components/TvPlayerCommandBridge.tsx`: cau lenh player HLS/iframe fallback.
- `components/TvWatchOverlay.tsx`: nut tua co `data-tv-seek="backward/forward"`.
- `components/TvSearchBox.tsx`: fix hydration do localStorage.

## Ghi chu

Iframe cross-origin khong the tua/play chac chan tu web app. Neu co HLS/m3u8 thi TV mode se dieu khien on hon nhieu.
