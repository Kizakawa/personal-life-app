# Projects v9 - Security, Notes Reliability and Performance Hardening

## Mục tiêu

Projects v9 tập trung vào 3 điểm bắt buộc trước khi mở rộng thêm tính năng: bảo mật dữ liệu cá nhân, giảm rủi ro sập SQLite khi ghi chép có ảnh, và tối ưu các màn hình có khả năng phình dữ liệu lớn sau thời gian dài sử dụng.

## Bảo mật và toàn vẹn dữ liệu

- Thêm `calendar_token` cho người dùng.
- API xuất lịch `.ics` không còn dùng link gắn trực tiếp với phiên đăng nhập; link xuất lịch dùng token riêng.
- Thêm API lấy link xuất lịch và tạo lại token lịch nếu link cũ bị lộ.
- Middleware backend chỉ cho phép `/calendar/export` đi qua khi có token, sau đó router vẫn xác thực token ở tầng backend.
- Thêm sanitizer server-side cho nội dung HTML của ghi chép bài giảng và workspace item.
- Frontend dùng DOMPurify để làm sạch HTML trước khi render bằng `dangerouslySetInnerHTML`.
- RichTextEditor và Journal chặn ảnh Base64 khi paste/drop, tự upload ảnh lên backend rồi chèn URL ảnh inline. Link ảnh inline dùng `public_token` riêng của file, không nhúng session token vào nội dung ghi chép.

## Ghi chép bài giảng

- Ghi chép bài giảng có auto-save sau khoảng 5 giây không gõ.
- Hiển thị trạng thái `Đang lưu...`, `Đã lưu`, `Lưu tự động lỗi` trong editor.
- Draft ghi chép mới được lưu tạm trong localStorage theo từng môn để giảm rủi ro mất bài khi bấm nhầm hoặc reload.
- Danh sách ghi chép trong Sinh viên 360 có phân trang nhẹ và nút `Tải thêm`.

## Trải nghiệm người dùng

- Thêm `react-hot-toast` để hiện thông báo thao tác thành công/lỗi.
- API client trung tâm tự xử lý lỗi mạng và phiên đăng nhập hết hạn.
- Thêm Zustand store cho gamification.
- Header/sidebar XP tự cập nhật sau khi hoàn thành task, workspace item hoặc phiên Pomodoro.

## Hiệu suất backend/frontend

- Student Hub giảm truy vấn lặp bằng cách preload dữ liệu theo nhóm môn học thay vì query từng môn nhiều lần.
- API tasks hỗ trợ `limit` và `offset`.
- API expenses đã hỗ trợ phân trang từ v8 và frontend v9 thêm nút tải thêm giao dịch.
- API class notes hỗ trợ `limit` và `offset`.
- Frontend Tasks, Expenses và Class Notes dùng cơ chế tải thêm thay vì luôn kéo toàn bộ dữ liệu.

## Database

- Nâng database version lên `5`.
- Migration tự thêm cột `calendar_token` vào bảng `users` nếu database cũ chưa có.
- Thêm index unique cho `users.calendar_token` và `file_items.public_token`.

## Lưu ý

- Bản zip sạch không chứa database cá nhân, uploads, `.venv`, `node_modules`, `.git` hoặc cache Python.
- Dữ liệu người dùng tiếp tục nằm trong `%APPDATA%\PersonalLifeApp`.
