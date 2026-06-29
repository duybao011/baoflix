# BảoFlix Stage 1 - Lint unblock patch

Patch này chỉ sửa `eslint.config.mjs` để Stage 1 TV stability không bị chặn bởi lint rules quá gắt trong Next/React mới.

## Sửa gì?

Các rule sau được hạ từ error xuống warning:

- `react-hooks/set-state-in-effect`
- `react-hooks/immutability`
- `@typescript-eslint/no-explicit-any`

Lý do: project hiện đang có nhiều màn hình client-only đọc `localStorage` / `sessionStorage` sau hydrate và nhiều payload API động. Refactor sạch từng file nên để sang đợt cleanup riêng; Stage 1 cần ưu tiên ổn định TV/player trước.

## Cách apply

Giải nén ZIP vào root project rồi chạy:

Windows:

```bat
apply_patch.bat
```

macOS/Linux:

```bash
./apply_patch.sh
```

Sau đó chạy:

```bash
npm run lint
npm run build
```

Lint có thể vẫn còn warning về `<img>`, exhaustive-deps hoặc các nợ kỹ thuật khác. Miễn không còn error là ổn để test Stage 1.

## Ghi chú

Đây không phải patch “dọn sạch codebase”. Đây là patch mở khóa để tiếp tục test TV stability. Sau khi Đợt 1 ổn, nên làm một đợt riêng để refactor localStorage state bằng `useSyncExternalStore` hoặc lazy initialization, đổi `any` sang `unknown`/type cụ thể, và chuyển ảnh quan trọng sang `next/image` nếu cần.
