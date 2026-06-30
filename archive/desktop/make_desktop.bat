@echo off
title Build GLM Studio (.exe)
cd /d "%~dp0"
echo Installing build tools (pywebview, pyinstaller)...
".venv\Scripts\python.exe" -m pip install --quiet pywebview pyinstaller
echo.
echo Building "GLM Studio.exe" ... (this takes a few minutes)
".venv\Scripts\python.exe" build_desktop.py
echo.
if exist "dist\GLM Studio.exe" (
  echo SUCCESS  -^>  dist\GLM Studio.exe
) else (
  echo Build did not produce the exe. See the messages above.
)
pause
