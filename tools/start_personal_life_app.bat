@echo off
setlocal EnableExtensions

set "APP_DIR=%~dp0"
set "PERSONAL_LIFE_APP_DATA_DIR=%APPDATA%\PersonalLifeApp"
set "PERSONAL_LIFE_APP_FRONTEND_DIR=%APP_DIR%frontend"
set "PERSONAL_LIFE_APP_PORT=8000"
set "LOG_DIR=%PERSONAL_LIFE_APP_DATA_DIR%\logs"
set "LOG_FILE=%LOG_DIR%\backend.log"
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Personal Life App.lnk"

if not exist "%PERSONAL_LIFE_APP_DATA_DIR%" mkdir "%PERSONAL_LIFE_APP_DATA_DIR%"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

if not exist "%APP_DIR%backend\PersonalLifeBackend.exe" (
  echo Khong tim thay backend\PersonalLifeBackend.exe
  echo Hay chay lai tools\build_portable_windows.bat de tao ban portable hoan chinh.
  pause
  exit /b 1
)

if not exist "%SHORTCUT_PATH%" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath='%APP_DIR%Start Personal Life App.bat'; $s.WorkingDirectory='%APP_DIR%'; $s.IconLocation='%SystemRoot%\System32\shell32.dll,220'; $s.Save()" >nul 2>&1
)

netstat -ano | findstr ":8000" >nul
if errorlevel 1 (
  start "Personal Life App Backend" /min cmd /c ""%APP_DIR%backend\PersonalLifeBackend.exe" >> "%LOG_FILE%" 2>&1"
  timeout /t 4 /nobreak >nul
)

start "" "http://127.0.0.1:8000/app/"
exit /b 0
