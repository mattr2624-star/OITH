@echo off
echo ============================================
echo    OITH Local Server Starting...
echo ============================================
echo.
echo Server running at:
echo    Index: http://localhost:5500/index.html
echo    Admin: http://localhost:5500/manager.html
echo.
echo (Press Ctrl+C to stop the server)
echo ============================================
echo.

cd /d "%~dp0"
start http://localhost:5500/index.html
python -m http.server 5500
pause

