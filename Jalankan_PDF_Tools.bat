@echo off
title PDF Tools Launcher
color 0B

echo ================================================================
echo           PDF Tools — Offline Client-Side Suite
echo ================================================================
echo.
echo Memeriksa lingkungan sistem...
echo.

where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
    node "%~dp0server.js"
    exit /b
)

:: Jika Node.js tidak tersedia, buka langsung berkas HTML di browser
echo [INFO] Membuka langsung berkas HTML di browser...
start "" "%~dp0index.html"
exit /b
