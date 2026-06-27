README.md# BảoFlix

BảoFlix là app xem phim cá nhân được xây bằng Next.js, dùng dữ liệu phim từ KKPhim API và hỗ trợ thêm phim riêng. App tập trung vào trải nghiệm xem nhanh trên desktop, mobile và TV.

## Tính năng chính

- Trang chủ có hero phim mới và các nhóm phim bộ, phim lẻ, hoạt hình.
- Tìm kiếm phim, gợi ý nhanh và lưu lịch sử tìm kiếm trên thiết bị.
- Bộ lọc theo loại phim, thể loại, quốc gia, năm, ngôn ngữ và cách sắp xếp.
- Trang chi tiết phim, chọn server/tập và phát video qua iframe hoặc HLS.
- Lịch sử xem tiếp, tập đã mở và danh sách yêu thích lưu bằng `localStorage`.
- Dashboard cá nhân thống kê gu xem phim trên thiết bị hiện tại.
- Khu phim riêng để thêm nội dung cá nhân từ dữ liệu trong app.
- PWA, mobile bottom navigation và các tối ưu cho TV mode/remote.

## Công nghệ

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- hls.js
- ESLint

## Chạy local

Cài dependencies:

```bash
npm install
```

Chạy development server:

```bash
npm run dev
```

Mở `http://localhost:3000` trong trình duyệt.

Có thể chạy Turbopack bằng:

```bash
npm run dev:turbo
```

## Scripts

```bash
npm run dev        # Chạy Next.js dev server bằng webpack
npm run dev:turbo  # Chạy Next.js dev server bằng Turbopack
npm run build      # Build production
npm run start      # Chạy bản production đã build
npm run lint       # Kiểm tra ESLint
```

## Cấu trúc chính

```text
app/          App Router pages, layouts và API routes
components/   UI components, player, navigation, TV/mobile helpers
data/         Dữ liệu phim riêng cấu hình trong code
lib/          Hàm lấy dữ liệu KKPhim, lưu lịch sử/yêu thích
public/       Icon PWA, poster/placeholder và asset tĩnh
```

Một số file đáng chú ý:

- `app/page.tsx`: trang chủ.
- `app/layout.tsx`: layout gốc, PWA và TV/mobile controllers.
- `lib/kkphim.ts`: lớp lấy dữ liệu từ KKPhim API.
- `lib/watchStore.ts`: lưu lịch sử xem và tập đã mở.
- `data/custom-movies.ts`: danh sách phim riêng.

## Dữ liệu và quyền riêng tư

- Dữ liệu lịch sử xem, yêu thích và tìm kiếm được lưu trong trình duyệt bằng `localStorage`.
- Dữ liệu phim công khai được lấy từ KKPhim API.
- Dữ liệu phim riêng nằm trong source code, nên cần kiểm tra kỹ các link cá nhân trước khi public repo hoặc chia sẻ bản deploy.

## Deploy

App có thể deploy lên Vercel hoặc môi trường Node.js hỗ trợ Next.js.

```bash
npm run build
npm run start
```

## Ghi chú

Repo này hiện là app cá nhân, ưu tiên trải nghiệm xem phim nhanh, dễ dùng trên nhiều thiết bị và có khả năng mở rộng thêm phim riêng.