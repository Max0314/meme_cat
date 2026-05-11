@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-CatMemeStudio.ps1"
if errorlevel 1 (
  echo.
  echo Install failed. See the message above.
  pause
  exit /b 1
)
echo.
echo Cat Meme Studio installed successfully.
pause
