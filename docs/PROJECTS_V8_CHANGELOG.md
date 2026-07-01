# Projects_v8 Changelog

## Trọng tâm nâng cấp

Projects_v8 chuyển trọng tâm từ “nhiều module” sang “dùng hằng ngày mượt hơn cho học sinh, sinh viên”. Các nâng cấp giữ nguyên dữ liệu người dùng, tiếp tục dùng AppData và migration tự động.

## Nâng cấp học tập

- Thêm ghi chép bài giảng ngay trong Sinh viên 360.
- Ghi chép bài giảng dùng lại bảng `workspace_items` với `category = class_note`, không tạo bảng dư thừa.
- Ghi chép gắn với môn học, ngày học, tag và nội dung HTML.
- Thêm mẫu ghi chép: Lý thuyết, Thực hành/Lab, Cornell.
- Thêm component `RichTextEditor` dùng chung, hỗ trợ đậm/nghiêng/gạch chân/list/highlight/màu/chèn ảnh.

## Nâng cấp tập trung và động lực

- Thêm backend Focus Session.
- Thêm Pomodoro/Focus Mode vào trang Quản lý học tập.
- Hoàn thành phiên tập trung được cộng EXP.
- Hoàn thành task hoặc mục học tập được cộng EXP.
- Thêm Gamification Summary: điểm EXP, level, chuỗi ngày, huy hiệu, hoạt động gần đây.
- Dashboard và Sinh viên 360 hiển thị EXP học tập.

## Nâng cấp lịch

- Thêm endpoint xuất lịch `.ics` tại `/calendar/export`.
- Lịch xuất gồm thời khóa biểu, sự kiện, deadline và task chưa xong.
- Sinh viên 360 có nút “Xuất lịch .ics” để import vào Google Calendar/Apple Calendar/Outlook.

## Nâng cấp hiệu năng và kỹ thuật

- Frontend chuyển sang lazy loading theo module bằng `React.lazy` và `Suspense`.
- Giảm kích thước bundle chính sau build.
- Thêm cache nhẹ phía frontend cho Sinh viên 360, không cần cài React Query.
- Thêm pagination tùy chọn cho `tasks`, `expenses`, `workspace-items`.
- Thêm SQLite WAL, busy timeout và một số index thường dùng.
- Tăng database version lên `3`.

## Backup/Restore

- Backup/restore bao gồm thêm:
  - `focusSessions`
  - `gamificationEvents`

## Lưu ý

- Không chứa database cá nhân.
- Không chứa uploads cá nhân.
- Không chứa `.venv`, `node_modules`, `.git`.
- Khi chạy lần đầu, backend sẽ tự migration database cũ lên version 3 và tạo backup trước nâng cấp.
