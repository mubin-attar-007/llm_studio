@echo off
title LLM Studio
REM scripts\ lives one level under the project root — run from the root.
cd /d "%~dp0\.."
echo ================================================================
echo   LLM Studio - local ChatGPT-style app (cloud + local models)
echo   A browser tab will open at http://127.0.0.1:5000
echo   Keep this window open while you use it. Close it to stop.
echo ================================================================
echo.
".venv\Scripts\python.exe" -m app.main
echo.
echo Server stopped.
pause
