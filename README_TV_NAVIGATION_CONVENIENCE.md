# BảoFlix TV Navigation Convenience Patch

Patch này không sửa player. Mục tiêu là làm phần TV ngoài trang xem dễ dùng hơn:

## File thay đổi

- `components/TvRemoteNavigator.tsx`
- `components/TvDashboard.tsx`
- `components/TvSearchBox.tsx`
- `components/FilterPanel.tsx`
- `components/MovieGrid.tsx`
- `components/Pagination.tsx`
- `components/MovieCard.tsx`

## Logic mới

- Back trong TV mode:
  - Nếu đang xem phim: về detail phim.
  - Nếu đang ở trang con như bộ lọc/tìm kiếm/yêu thích/lịch sử: về `/tv` ngay, không đi lòng vòng theo browser history.
  - Nếu đang ở `/tv`: về trang thường `/`.
- Thêm focus memory ổn hơn qua `data-tv-focus-key` cho home TV, shortcut, filter, kết quả phim và phân trang.
- Row có thể wrap bằng `data-tv-row-wrap="true"`, hợp các hàng chip/shortcut kiểu app TV.
- Trang `/tv` ưu tiên lối tắt hay dùng: xem tiếp, bộ lọc, phim bộ Trung, Hàn, Nhật, Vietsub, thuyết minh, phim riêng.
- Tìm kiếm TV ưu tiên chip/lối tắt trước, nhập chữ chỉ là phương án phụ.
- Bộ lọc có preset lớn giống tab TV, nút Apply/Clear rõ, chip lớn hơn và focus rõ hơn.
- Kết quả lọc/phân trang có focus key để Back/đổi trang không bị mất vị trí.

## Cách apply

Windows:

```bat
apply_patch.bat
```

macOS/Linux:

```bash
chmod +x apply_patch.sh
./apply_patch.sh
```

Sau đó chạy:

```bash
npm run lint
npm run build
```

## Test nhanh trên TV/APK

1. Vào `/tv`.
2. D-pad qua hero, tìm nhanh, lối tắt, phim bộ Trung.
3. Vào `/loc`, chọn vài chip rồi bấm `Lọc kết quả`.
4. D-pad xuống kết quả phim, mở phim, Back về `/tv`.
5. Từ `/yeu-thich`, `/lich-su`, `/ca-nhan`, `/loc`, bấm Back phải về `/tv`.
6. Về lại `/tv`, focus nên nhớ gần đúng card trước đó.
