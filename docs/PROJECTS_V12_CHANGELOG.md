# Projects V12

## Rà soát và gia cố AI V11

- Sliding window history chỉ đưa 8 tin nhắn gần nhất vào prompt gửi Gemini.
- Rút ngắn mỗi tin nhắn lịch sử còn tối đa 800 ký tự để giảm token.
- Context vẫn được truyền qua `system_instruction`, câu hỏi người dùng và lịch sử chat nằm ở `contents`.
- Thêm rate limit nội bộ 15 request/phút cho mỗi tài khoản.
- Lỗi 429 trả thông báo thân thiện: "Trợ lý AI đang suy nghĩ hơi nhiều..."
- Streaming route phát event lỗi rõ ràng khi Gemini bị rate limit hoặc lỗi API.

## V12 AI Agent an toàn

- Củng cố Action Proposal dạng JSON cho `create_task`.
- AI chỉ đề xuất hành động; frontend hiển thị card duyệt.
- Người dùng bấm "Tạo Task này" thì frontend mới gọi API tạo task.
- Vẫn giữ nguyên nguyên tắc Human-in-the-loop, AI không tự ghi database.

## Voice Input

- Thêm nút Mic trong AI Drawer.
- Dùng Web Speech API của trình duyệt, không cần backend hoặc thư viện mới.
- Giọng nói được chuyển thành chữ rồi đưa vào ô chat.

## RAG thu nhỏ cho ghi chú học tập

- Khi bật quyền ghi chú học tập, backend tìm keyword từ câu hỏi.
- Chỉ lấy 2 ghi chú liên quan nhất trong `workspace_items`.
- Không gửi toàn bộ kho ghi chú vào context.

## UI/UX

- AI Drawer tiếp tục dùng `react-markdown` và `remark-gfm`.
- Auto-scroll dùng `useRef` để tự cuộn xuống cuối khi AI stream nội dung.
- Thêm toast/error thân thiện cho lỗi AI và rate limit.

## Database

- Nâng `database_version` lên 8.
