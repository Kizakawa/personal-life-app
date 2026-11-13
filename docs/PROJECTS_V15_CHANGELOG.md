# Projects V15 Changelog

## Muc tieu

V15 tap trung bien cac phan con thieu cua V14 thanh luong dung that: sinh ton co AI thuc te hon, them module ho tro ghi bai, va noi du lieu ghi bai vao search/thong ke/AI context.

## Thay doi chinh

- Them module frontend `Ho tro ghi bai`.
  - Luu ghi bai theo mon, ngay hoc va noi dung.
  - Sua, xoa, tim kiem ghi bai.
  - Gui ghi bai sang Tro ly AI de tom tat, rut y chinh, tao cau hoi on tap.
- Them menu `Ho tro ghi bai` trong nhom Lich va hoc tap.
- Noi `class_notes` vao backend workspace chung.
  - AI context co the truy xuat ghi bai khi bat quyen `Ghi chu hoc tap`.
  - Search va Thong ke nhan dien module ghi bai.
- Nang cap che do `Sinh ton` trong Chi tieu.
  - Ket qua sinh ton co nut `Nho AI toi uu ke hoach sinh ton`.
  - Prompt gui sang AI gom tien hien co, so ngay, chi phi co dinh, phan bo hien tai va goi y hien tai.
- Bo sung prompt goi y rieng cho trang `Ho tro ghi bai` trong AI drawer.

## Ghi chu ky thuat

- Khong them bang database moi; dung lai `workspace_items` de giam rui ro migration.
- Giu startup portable theo huong on dinh cua V13/V14 stable.
- Giu compatibility shim `app.gamification` de tranh loi PyInstaller khi build de len thu muc cu.
