@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Cookie Clicker Android - Prepare and Build

echo ==============================================
echo     COOKIE CLICKER ANDROID - ONE-CLICK BUILD
 echo ==============================================
echo.
REM Remove obsolete files from former built-in mods when upgrading in place.
REM The wooden resizer is now a completely separate Steam-format mod ZIP.
if exist "app\src\main\assets\android-wooden-resizer.js" del /q "app\src\main\assets\android-wooden-resizer.js"
REM Remove obsolete files from the former Android-native mod installer, if upgrading in place.
if exist "app\src\main\java\dev\unofficial\cookieport\ModStore.java" del /q "app\src\main\java\dev\unofficial\cookieport\ModStore.java"
if exist "app\src\main\assets\cookie-port-mod-loader.js" del /q "app\src\main\assets\cookie-port-mod-loader.js"
if exist "android-mod-smoke-test.zip" del /q "android-mod-smoke-test.zip"
if exist "MOD-TESTING.txt" del /q "MOD-TESTING.txt"
if exist "app\src\main\assets\game\index.html" (
  echo Game files already imported. Skipping import.
  if exist ".cookie-steam-path" goto build
  if exist "C:\Program Files (x86)\Steam\steamapps\common\Cookie Clicker\resources\app\mods" goto build
  echo A custom Steam path must be recorded to package your installed mods.
)

set "STEAM_GAME=C:\Program Files (x86)\Steam\steamapps\common\Cookie Clicker"
if not exist "%STEAM_GAME%\resources\app\src\index.html" (
  echo Steam game installation not found in the default location.
  echo In Steam: right-click Cookie Clicker ^> Manage ^> Browse local files.
  echo Paste that folder's full path below, without quotation marks.
  set /p "STEAM_GAME=Game folder: "
)
if not exist "%STEAM_GAME%\resources\app\src\index.html" (
  echo.
  echo ERROR: Could not find resources\app\src\index.html in that folder.
  echo Make sure the path points to your Cookie Clicker installation.
  goto fail
)

where py >nul 2>&1
if not errorlevel 1 (
  py "tools\prepare_game.py" "%STEAM_GAME%"
) else (
  where python >nul 2>&1
  if errorlevel 1 (
    echo ERROR: Python not found. Install Python and run this file again.
    goto fail
  )
  python "tools\prepare_game.py" "%STEAM_GAME%"
)
if errorlevel 1 goto fail

:build
call "%~dp0build-apk.bat"
exit /b %errorlevel%

:fail
echo.
echo Preparation stopped. The message above explains why.
pause
exit /b 1
