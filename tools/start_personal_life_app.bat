@echo off
setlocal

set APP_DIR=%~dp0
set PERSONAL_LIFE_APP_DATA_DIR=%APPDATA%\PersonalLifeApp
set PERSONAL_LIFE_APP_FRONTEND_DIR=%APP_DIR%frontend
set PERSONAL_LIFE_APP_PORT=8000
set PERSONAL_LIFE_APP_LOG=%APP_DIR%backend.log

if not exist "%PERSONAL_LIFE_APP_DATA_DIR%" mkdir "%PERSONAL_LIFE_APP_DATA_DIR%"

echo Starting Personal Life App... > "%PERSONAL_LIFE_APP_LOG%"
echo Data dir: %PERSONAL_LIFE_APP_DATA_DIR% >> "%PERSONAL_LIFE_APP_LOG%"
echo Frontend dir: %PERSONAL_LIFE_APP_FRONTEND_DIR% >> "%PERSONAL_LIFE_APP_LOG%"

start "Personal Life App Backend" /min cmd /c ""%APP_DIR%backend\PersonalLifeBackend.exe" >> "%PERSONAL_LIFE_APP_LOG%" 2>&1"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:8000/app"
