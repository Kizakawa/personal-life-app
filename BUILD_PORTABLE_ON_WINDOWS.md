# Build Portable On Windows

## Cach tao file zip gui ban be

1. Cai Node.js LTS va Python 3.11+.
2. Mo thu muc `personal-life-app/tools`.
3. Chay `build_portable_windows.bat`.
4. File zip se nam tai:

```text
personal-life-app/portable/PersonalLifeApp_HSSV_Portable.zip
```

## Cach ban be su dung

1. Giai nen file zip.
2. Mo thu muc `PersonalLifeApp`.
3. Bam `Start Personal Life App.bat`.
4. App se tu mo trinh duyet tai:

```text
http://127.0.0.1:8000/app/
```

Lan dau chay, app se tu tao shortcut `Personal Life App` ngoai Desktop.

## Noi luu du lieu

Du lieu nguoi dung khong nam trong thu muc code. App luu du lieu tai:

```text
%APPDATA%\PersonalLifeApp
```

Ben trong co database, uploads, backups va logs. Vi vay khi nang cap ban moi,
nguoi dung chi can thay thu muc chuong trinh, du lieu cu van con.
