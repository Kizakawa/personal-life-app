# Projects V14 Changelog

## Muc tieu

V14 la ban nang cap tap trung vao trai nghiem dung that: bot roi, bot form co dinh, bot nut lap lai va de chay hon tren may ban be.

## Thay doi chinh

- Them onboarding nhe tren Dashboard: goi y bat dau bang Mon hoc, Deadline, Chi tieu va Cai dat AI.
- Man hinh Du an ca nhan khong hien form tao moi mac dinh nua. Bam `+ Them du an` hoac `Sua` moi mo form.
- Bo hanh vi tu cuon len dau khi sua du an.
- Man hinh Chi tieu an form giao dich, ngan sach va danh muc cho den khi nguoi dung bam nut them/chinh.
- Khu ngan sach chi hien 4 danh muc dau tien va nut `Xem tat ca danh muc`, tranh tran ngang va lap nut `Sua han muc`.
- Lam nhe placeholder, label va nut phu toan app de chu mau khong qua dam.
- Cap nhat portable script:
  - build log ro hon.
  - dung registry npm public.
  - xuat `PersonalLifeApp_HSSV_Portable.zip`.
  - dua file start ve kieu V13: chay backend, doi ngan, mo web.
  - backend ghi log toi thieu vao `PersonalLifeApp\backend.log`.
- Ban va backend start:
  - bo lop kiem tra `/health`, `/auth/status`, tu dong kill port va shortcut desktop vi lam startup cham va de gay nhieu hon V13.
  - PyInstaller gom them cac submodule dong cua FastAPI/Pydantic/SQLAlchemy/Google GenAI.
  - tach `app.gamification` thanh `app.services.gamification_service` de tranh circular import khi dong goi PyInstaller.
  - giu lai `app.gamification` duoi dang compatibility shim de ghi de file cu neu nguoi dung giai nen de len thu muc co san.
  - build script tu xoa `backend/build`, `backend/dist`, file `.spec` va `__pycache__` truoc khi dong exe.
- Giu du lieu nguoi dung trong `%APPDATA%\PersonalLifeApp`, tach khoi thu muc chuong trinh de nang cap khong mat du lieu.

## Viec nen tiep tuc o V15

- Gom Kho tri thuc va Tai lieu thanh mot luong de hieu hon.
- Don lai sidebar theo che do co ban/nang cao.
- Sua cac loi nho trong Journal: ngay tuong lai, emote, luu lan dau va scroll sau khi sua.
