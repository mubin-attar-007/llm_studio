@echo off
title Build LLM Studio (.exe)
cd /d "%~dp0"
echo Installing build tools (pywebview, pyinstaller)...
".venv\Scripts\python.exe" -m pip install --quiet pywebview pyinstaller
echo.
echo Building "LLM Studio.exe" ... (this takes a few minutes)
".venv\Scripts\python.exe" build_desktop.py
echo.
if exist "dist\LLM Studio.exe" (
  echo SUCCESS  -^>  dist\LLM Studio.exe
) else (
  echo Build did not produce the exe. See the messages above.
)
pause
