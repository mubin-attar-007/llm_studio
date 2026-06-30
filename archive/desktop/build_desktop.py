"""Build a single-file Windows .exe for GLM Studio (desktop mode).

Run:  .venv\\Scripts\\python.exe build_desktop.py   ->  dist/GLM Studio.exe
(or just double-click make_desktop.bat)
"""
import PyInstaller.__main__

PyInstaller.__main__.run([
    "desktop.py",
    "--name=GLM Studio",
    "--onefile",
    "--windowed",
    "--noconfirm",
    "--clean",
    "--add-data=app/templates;app/templates",
    "--add-data=app/static;app/static",
    "--collect-all=uvicorn",
    "--collect-all=fastapi",
    "--collect-all=starlette",
    "--collect-all=pydantic",
    "--collect-all=webview",
    "--collect-submodules=openai",
    "--collect-submodules=app",
])
