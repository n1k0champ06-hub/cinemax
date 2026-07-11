@echo off
title Cinemax Scraper Auto-Start
color 0B
cls

echo ===================================================
echo           CINEMAX AUTO-LAUNCH MINER DASHBOARD
echo ===================================================
echo.

echo [1/3] Giai phong cong 3000 & 3001 neu dang chay...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr "LISTENING" ^| findstr ":3000"') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr "LISTENING" ^| findstr ":3001"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [2/3] Dang khoi dong Web Server & API Dev Server...
start "Cinemax Web Dev Server" cmd /c "npm run dev"
start "Cinemax API Server" cmd /c "npm run api"

echo [3/3] Cho he thong san sang (3 giay)...
ping 127.0.0.1 -n 4 >nul

echo MO TRINH DUYET...
start http://localhost:3000/?tab=scraper

echo.
echo [SUCCESS] Khoi dong thanh cong! Cua so nay se tu tat...
ping 127.0.0.1 -n 4 >nul
exit
