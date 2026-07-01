# Projects V10

## AI Assistant

- Thêm router backend `/api/ai` cho Trợ lý AI dùng Gemini qua `google-genai`.
- API key chỉ đọc ở backend theo thứ tự: biến môi trường `GEMINI_API_KEY`, sau đó `app_settings.gemini_api_key`.
- Thêm `AIChatHistory` để lưu lịch sử chat theo tài khoản, model, token, latency, lỗi và snapshot ngữ cảnh.
- Thêm Context Builder chỉ đọc dữ liệu đã được bật quyền, không gửi toàn bộ database.
- Thêm Context Preview để người dùng xem tóm tắt dữ liệu sẽ cấp cho AI.
- Thêm privacy toggles cho task, deadline, lịch, học tập, điểm, tài chính, nhật ký, người quan trọng và ghi chú học tập.
- Không đưa `gemini_api_key` vào backup/export và che key trong danh sách settings thường.
- Nâng `database_version` lên 6.

## Frontend

- Thêm Floating AI Drawer ở góc phải dưới.
- Thêm suggested prompts theo trang hiện tại.
- Render phản hồi AI bằng Markdown qua `react-markdown` và `remark-gfm`, không bật raw HTML.
- Thêm khu vực "Trợ lý AI" trong trang Cài đặt để nhập API key, đổi model và bật/tắt quyền dữ liệu.
