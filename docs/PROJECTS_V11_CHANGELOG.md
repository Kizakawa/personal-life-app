# Projects V11

## AI Context An Toan Hon

- Gioi han context task trong 14 ngay toi, chi lay task chua hoan thanh.
- Deadline chi lay 7 ngay toi, chi lay deadline chua xong.
- Chi tieu chi lay du lieu thang hien tai.
- Diem chi lay moc gan day, chuyen can chi tong hop rui ro gan day.
- Nhat ky chi lay cac entry trong 30 ngay gan day khi nguoi dung bat quyen.
- Ghi chu hoc tap dung co che truy hoi lien quan theo tu khoa, chi dua top ghi chu phu hop vao prompt thay vi gui tat ca.

## Streaming Chat

- Them endpoint `POST /api/ai/chat/stream` tra Server-Sent Events.
- Frontend doc stream va hien chu dan dan trong AI Drawer.
- Van giu endpoint `/api/ai/chat` dong bo de fallback.

## Sliding Window History

- Khi goi Gemini, backend chi dua 10 tin nhan gan nhat vao prompt ngan han.
- Lich su day du van duoc luu trong database de nguoi dung xem lai.

## Human-in-the-loop Actions

- Them cot `suggested_action` trong `ai_chat_history`.
- AI co the de xuat hanh dong dang card, hien tai ho tro `create_task`.
- Frontend chi tao task sau khi nguoi dung bam nut `Tao Task nay`.
- AI khong tu ghi, sua, xoa du lieu trong database.

## Markdown UI

- Them style `.ai-markdown` cho heading, list, code block va table trong cau tra loi AI.
- Project hien dung CSS thuong, nen khong them Tailwind Typography de tranh lam phuc tap build.

## Database

- Nang `database_version` len 7.
