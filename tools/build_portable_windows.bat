@echo off
setlocal EnableExtensions

set "ROOT=%~dp0.."
set "BACKEND_DIR=%ROOT%\backend"
set "FRONTEND_DIR=%ROOT%\frontend"
set "PORTABLE_ROOT=%ROOT%\portable"
set "PORTABLE_DIR=%PORTABLE_ROOT%\PersonalLifeApp"
set "ZIP_PATH=%PORTABLE_ROOT%\PersonalLifeApp_HSSV_Portable.zip"
set "LOG_FILE=%PORTABLE_ROOT%\build_portable_log.txt"

if not exist "%PORTABLE_ROOT%" mkdir "%PORTABLE_ROOT%"
echo Personal Life App portable build > "%LOG_FILE%"
echo Root: "%ROOT%" >> "%LOG_FILE%"

call :log Checking tools...
where npm >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto :missing_npm
where python >> "%LOG_FILE%" 2>&1
if errorlevel 1 where py >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto :missing_python

call :log [1/7] Build frontend
cd /d "%FRONTEND_DIR%" || goto :fail
if exist package-lock.json (
  call npm ci --no-audit --no-fund >> "%LOG_FILE%" 2>&1
) else (
  call npm install --no-audit --no-fund >> "%LOG_FILE%" 2>&1
)
if errorlevel 1 goto :fail
call npm run build >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto :fail

call :log [2/7] Prepare backend environment
cd /d "%BACKEND_DIR%" || goto :fail
call :log Cleaning old backend build cache
if exist "build" rmdir /s /q "build" >> "%LOG_FILE%" 2>&1
if exist "dist" rmdir /s /q "dist" >> "%LOG_FILE%" 2>&1
if exist "PersonalLifeBackend.spec" del /q "PersonalLifeBackend.spec" >> "%LOG_FILE%" 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath '%BACKEND_DIR%' -Recurse -Directory -Filter '__pycache__' | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue" >> "%LOG_FILE%" 2>&1
if not exist ".venv\Scripts\python.exe" (
  py -3 -m venv .venv >> "%LOG_FILE%" 2>&1
  if errorlevel 1 python -m venv .venv >> "%LOG_FILE%" 2>&1
)
if not exist ".venv\Scripts\python.exe" goto :fail
call ".venv\Scripts\activate.bat" >> "%LOG_FILE%" 2>&1
python -m pip install --upgrade pip >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto :fail
python -m pip install -r requirements.txt >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto :fail
python -m pip install pyinstaller >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto :fail

call :log [3/7] Build backend executable
python -m PyInstaller --noconfirm --onedir --name PersonalLifeBackend --paths "%BACKEND_DIR%" --collect-submodules app --collect-submodules fastapi --collect-submodules starlette --collect-submodules pydantic --collect-submodules sqlalchemy --collect-submodules google desktop_server.py >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto :fail

call :log [4/7] Create portable folder
if not exist "%PORTABLE_DIR%" mkdir "%PORTABLE_DIR%"
if exist "%PORTABLE_DIR%\backend" rmdir /s /q "%PORTABLE_DIR%\backend"
if exist "%PORTABLE_DIR%\frontend" rmdir /s /q "%PORTABLE_DIR%\frontend"
if exist "%PORTABLE_DIR%\docs" rmdir /s /q "%PORTABLE_DIR%\docs"

xcopy /E /I /Y "%BACKEND_DIR%\dist\PersonalLifeBackend" "%PORTABLE_DIR%\backend" >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto :fail
xcopy /E /I /Y "%FRONTEND_DIR%\dist" "%PORTABLE_DIR%\frontend" >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto :fail
if not exist "%PORTABLE_DIR%\docs" mkdir "%PORTABLE_DIR%\docs"
copy /Y "%ROOT%\tools\start_personal_life_app.bat" "%PORTABLE_DIR%\Start Personal Life App.bat" >> "%LOG_FILE%" 2>&1
copy /Y "%ROOT%\BUILD_PORTABLE_ON_WINDOWS.md" "%PORTABLE_DIR%\docs\BUILD_PORTABLE_ON_WINDOWS.md" >> "%LOG_FILE%" 2>&1

call :log [5/7] Portable app created
echo "%PORTABLE_DIR%" >> "%LOG_FILE%"

call :log [6/7] Create zip for sharing
if exist "%ZIP_PATH%" del /q "%ZIP_PATH%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path '%PORTABLE_DIR%' -DestinationPath '%ZIP_PATH%' -Force" >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto :fail

call :log [7/7] Done
echo.
echo Zip output:
echo %ZIP_PATH%
echo.
echo Log file:
echo %LOG_FILE%
pause
exit /b 0

:missing_npm
echo.
echo Khong tim thay npm. Hay cai Node.js LTS truoc khi build portable.
echo Khong tim thay npm. >> "%LOG_FILE%"
pause
exit /b 1

:missing_python
echo.
echo Khong tim thay Python. Hay cai Python 3.11+ va tick Add Python to PATH.
echo Khong tim thay Python. >> "%LOG_FILE%"
pause
exit /b 1

:fail
echo.
echo Build bi loi hoac bi ngat.
echo Hay mo file log de xem chi tiet:
echo %LOG_FILE%
echo.
echo Meo nhanh: neu dung o npm install qua lau, bam Ctrl+C roi chay lai file nay.
pause
exit /b 1

:log
echo %*
echo %* >> "%LOG_FILE%"
exit /b 0
