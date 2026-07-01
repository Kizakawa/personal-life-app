# Projects_v7 - Student Life Upgrade

Bản này tập trung chuyển app từ nhiều module rời rạc thành một trung tâm sinh viên dùng hằng ngày.

## Nâng cấp chính

- Thêm module **Sinh viên 360** ở menu tổng quan.
- Thêm lịch tổng hợp 21 ngày: thời khóa biểu, sự kiện, task và deadline nằm chung một trục thời gian.
- Thêm trung tâm môn học: mỗi môn gom lịch học, deadline, tài liệu, điểm số và chuyên cần.
- Thêm quản lý điểm số/GPA:
  - Đầu điểm theo môn.
  - Thang điểm và trọng số.
  - Tính điểm hệ 10, hệ 4 và chữ.
  - GPA tạm tính theo tín chỉ.
- Thêm quản lý chuyên cần:
  - Ghi buổi có mặt, vắng, muộn, có phép.
  - Theo dõi số buổi được vắng.
  - Cảnh báo môn gần/vượt giới hạn vắng.
- Dashboard được bổ sung thẻ hành động hôm nay từ dữ liệu sinh viên.
- Module Môn học được bổ sung:
  - Số buổi được vắng.
  - Mục tiêu điểm.
- Backup/restore đã bao gồm dữ liệu điểm số và chuyên cần.
- Database version nâng lên 2 và tự migration thêm cột mới cho bảng subjects.

## Lưu ý dữ liệu

Gói này không chứa database cá nhân, uploads, node_modules, .venv hoặc .git.
Dữ liệu thật vẫn nằm ở `%APPDATA%\PersonalLifeApp` theo cơ chế đã nâng cấp từ bản trước.

## Chạy lại

Backend:

```cmd
cd /d E:\Projects_v7\personal-life-app\backend
py -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Frontend:

```cmd
cd /d E:\Projects_v7\personal-life-app\frontend
npm install
npm run dev
```
