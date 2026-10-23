# Ngôn ngữ thiết kế giao diện

Rút từ bản vẽ Figma "phương án 11" (trang soạn bộ câu hỏi) và áp dụng cho toàn bộ trang. Lớp CSS dùng chung: `src/assets/ui-refresh.css` (nạp sau `theme-overrides.css`). Trình soạn câu hỏi có bộ biến riêng `--ed-*` (`.editor-page`, `main.css`).

## 1. Nguyên tắc
- Thẻ trắng nổi trên nền xám nhạt, **viền mảnh 1px**, gần như không đổ bóng. Chỉ thẻ đang chọn, thanh nổi và popup mới có bóng.
- **Một màu nhấn** (`--main-color`, đổi được theo người dùng): nút chính, phần đang chọn, chữ nút phụ, gạch chân. Không thêm màu nhấn khác.
- Chỉ mở phần đang làm; phần khác thu gọn thành một dòng tóm tắt.
- Nút phụ là **chữ + icon, không viền** (ví dụ "+ Thêm đáp án"). Nút chỉ có icon thì vuông 36–40px, viền mảnh hoặc không viền.
- Khung điều hướng (thanh tiêu đề, mục lục, thanh công cụ) dính khi cuộn.

## 2. Token màu (luôn dùng biến, không dùng mã màu thô)
| Vai trò | Biến |
|---|---|
| Nền trang | `--background-color` / `--c-page` |
| Thẻ | `--content-item-background-color` / `--c-surface` |
| Hàng / ô nền trong thẻ | `--c-surface-subtle` |
| Viền thẻ | `--content-item-border-color` / `--c-border` |
| Viền ô nhập | `--form-item-border-color` / `--c-border-strong` |
| Ô nhập, popup | `--form-item-background-color` / `--c-surface-raised` |
| Chữ / chữ phụ | `--c-text` / `--c-text-muted` |
| Nhấn | `--main-color` (nền), `--c-primary-text` (chữ), `--main-color-theme` (nền nhạt), `color-mix(in srgb, var(--main-color) 14%, var(--c-surface))` |
| Lỗi / đúng | `--c-danger`, `--c-danger-text`, `--c-success`, `--c-success-text` (nền nhạt: `color-mix` 14–20% với `--c-surface`) |
| Vòng focus | `--c-focus-ring` |

Mọi cặp chữ / nền phải đạt WCAG AA ở cả giao diện sáng, tối và 6 màu nhấn (công cụ kiểm: `tools/theme-audit`).

## 3. Bo góc (biến `--ui-r-*` trong `ui-refresh.css`)
| Biến | px | Dùng cho |
|---|---|---|
| (999px) | tròn | tag dạng viên thuốc, avatar, nút tròn |
| `--ui-r-xl` | 16 | thẻ, khối nội dung, hộp thoại |
| `--ui-r-lg` | 12 | popup: dropdown, popover, thông báo, bảng |
| `--ui-r-md` | 10 | nút, hàng chọn được, nút icon, thanh phân đoạn |
| `--ui-r-sm` | 8 | ô nhập, select, tab, mục menu, ô số |
| `--ui-r-xs` | 6 | badge nhỏ, ô tích |

## 4. Đổ bóng
- Thẻ thường: `border: 1px solid var(--content-item-border-color)`, **không bóng**.
- Thẻ đang chọn / mở: viền 2px nhấn + `var(--ui-shadow-pop)`.
- Popup, thanh nổi: `var(--ui-shadow-pop)`; hộp thoại: `var(--ui-shadow-modal)`.

## 5. Chữ (Inter)
| Dùng cho | Cỡ / độ đậm |
|---|---|
| Tiêu đề trang | 22–24 / 700 (thanh tiêu đề trình soạn: 18 / 600) |
| Tiêu đề khối | 18–20 / 700 |
| Tiêu đề thẻ, nội dung chính | 14–16 / 500–600 |
| Mô tả, meta | 12–15, màu `--c-text-muted` |
| Badge | 12 / 500 |
| Nút | 14 / 600 |
| Ô nhập | 14 / 400 |
| Nhãn cột | 11 / 600, in hoa, giãn chữ 0.04em |

## 6. Kích thước và khoảng cách
- Nút cao 40 (nhỏ 32, lớn 44), padding ngang 16, icon 18, khoảng cách icon–chữ 8.
- Ô nhập, select cao 40; textarea padding 8–10 / 12.
- Thẻ: padding 16–24; khoảng cách giữa các thẻ 16; trong thẻ 12–14.
- Hàng chọn được: padding 10, khoảng cách 10, cao ~56.

## 7. Trạng thái
- Hover thẻ / hàng: viền chuyển sang `--main-color` (hoặc `--c-border-strong`).
- Đang chọn: nền nhấn nhạt + viền nhấn.
- Lỗi: viền `--c-danger`, chữ `--c-danger-text`, ô số nền đỏ nhạt.
- Đúng: nền xanh nhạt + viền `--c-success`.
- Focus bàn phím: `outline: 2px solid var(--c-focus-ring); outline-offset: 2px` (đã có ở `theme-overrides.css`).
- Disabled: giữ độ tương phản chữ `--c-disabled-text`.

## 8. Quy tắc khi sửa trang
- **Chỉ đổi giao diện** (CSS, class, bố cục trình bày). Không đổi logic, API, tên route, i18n key, hành vi.
- Ưu tiên dùng class / token chung; CSS riêng của trang (`<style scoped>`) dùng token, không mã màu thô, không `border-radius` ngoài thang trên.
- Thay các bo góc 3–5px của khối / thẻ bằng thang trên; bỏ `box-shadow` đậm của thẻ.
- Giữ nguyên tên class mà JS / test đang dùng.
- Kiểm cả giao diện sáng và tối, viewport 1440 và 390 (không tràn ngang, không đè chữ).
- Không sửa `ui-refresh.css`, `main.css`, `base.css`, `theme-overrides.css`, `responsive.css`: nếu cần sửa chung, báo lại để gom vào một chỗ.
