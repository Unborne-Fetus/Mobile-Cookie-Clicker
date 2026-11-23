@echo off
setlocal
cd /d "%~dp0"
if not exist "%~dp0tools\build_apk.ps1" (
  echo ERROR: tools\build_apk.ps1 is missing.
  echo Extract the entire fix ZIP into the existing cookie-clicker-android-port folder.
  echo.
  pause
  exit /b 1
)
REM Remove obsolete embedded resize mod left behind by an earlier project ZIP.
if exist "app\src\main\assets\android-wooden-resizer.js" del /q "app\src\main\assets\android-wooden-resizer.js"
echo Synchronizing installed Steam mods into the APK project...
where py >nul 2>&1
if not errorlevel 1 (
  py "tools\sync_steam_mods.py"
) else (
  where python >nul 2>&1
  if errorlevel 1 (
    echo ERROR: Python not found. Python is required for the Steam mod snapshot.
    goto failed_sync
  )
  python "tools\sync_steam_mods.py"
)
if errorlevel 1 goto failed_sync

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\build_apk.ps1"
set "BUILD_EXIT=%ERRORLEVEL%"
echo.
if "%BUILD_EXIT%"=="0" (
  echo Script finished successfully.
) else (
  echo Build did not finish. The error is above. Copy it or send a screenshot.
)
echo Press any key to close this window.
pause >nul
exit /b %BUILD_EXIT%
:failed_sync
echo.
echo ERROR: Failed to include Steam mods. APK build cancelled to avoid an incomplete snapshot.
echo Check your Steam installation and run START-HERE.bat.
pause
exit /b 1
