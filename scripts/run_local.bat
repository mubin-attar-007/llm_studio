@echo off
title LLM Studio (Local / Offline)
REM scripts\ lives one level under the project root — run from the root.
cd /d "%~dp0\.."
REM Force the app onto the local Ollama model (these override .env).
set LLM_API_KEY=ollama
set LLM_BASE_URL=http://localhost:11434/v1
set LLM_MODEL=llama3.2:3b
set LLM_MODELS=llama3.2:3b,llama3.2:1b
echo ================================================================
echo   LLM Studio - LOCAL mode (Ollama, fully private + offline)
echo   The model llama3.2:3b runs on YOUR PC. Nothing leaves your machine.
echo   (First reply may take ~30s while the model loads into memory.)
echo   A browser tab will open at http://127.0.0.1:5000
echo ================================================================
echo.
".venv\Scripts\python.exe" -m app.main
echo.
echo Server stopped.
pause
