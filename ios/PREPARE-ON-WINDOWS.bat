@echo off
setlocal
cd /d "%~dp0"
title Cookie Clicker iOS - Prepare private Xcode project
set "STEAM=C:\Program Files (x86)\Steam\steamapps\common\Cookie Clicker"
if not exist "%STEAM%\resources\app\src\index.html" (
  echo Steam Cookie Clicker folder was not found in the default location.
  set /p "STEAM=Enter the full Cookie Clicker Steam installation folder: "
)
where py >nul 2>nul
if %errorlevel%==0 (set "PY=py") else (set "PY=python")
%PY% tools\prepare_game.py "%STEAM%"
if errorlevel 1 goto fail
%PY% tools\sync_steam_mods.py "%STEAM%"
if errorlevel 1 goto fail
%PY% tools\pack_prepared_project.py
if errorlevel 1 goto fail
echo.
echo SUCCESS: Move cookie-clicker-ios-prepared-PRIVATE.zip to a Mac with Xcode.
echo On the Mac, unzip the file, open Terminal in the project and run:
echo    bash BUILD-IPA.command
goto end
:fail
echo.
echo ERROR: Preparation failed. Read the error above.
:end
pause
