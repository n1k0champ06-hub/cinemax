@echo off
title Cinemax Setup & Runner
color 0A
cls

echo ===================================================
echo               CINEMAX SYSTEM MANAGER
echo ===================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/ first.
    echo.
    pause
    exit /b
)

:: Check for NPM
where npm >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] NPM is not installed!
    echo.
    pause
    exit /b
)

echo [1/3] Node.js & NPM detected.
echo.

:: Ask for Dependency Installation
set /p INSTALL="Ban co muon cai dat cac package (npm install) khong? (y/n): "
if /I "%INSTALL%"=="y" (
    echo.
    echo Dang cai dat dependencies... Vui long cho...
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Cai dat package that bai!
        pause
        exit /b
    )
    echo.
    echo [SUCCESS] Cai dat dependencies hoan tat.
)

:: Ask for Build
echo.
set /p BUILD="Ban co muon build du an khong? (y/n): "
if /I "%BUILD%"=="y" (
    echo.
    echo Dang build du an...
    call npm run build
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Build that bai!
        pause
        exit /b
    )
    echo.
    echo [SUCCESS] Du an duoc build thanh cong.
)

echo.
echo ===================================================
echo [2/3] KHOI DONG CAC DICH VU...
echo ===================================================
echo.

echo Dang don dep cac tien trinh dang chay tren cong 3000 & 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr "LISTENING" ^| findstr ":3000"') do (
    echo Giai phong cong 3000 (PID: %%a)...
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr "LISTENING" ^| findstr ":3001"') do (
    echo Giai phong cong 3001 (PID: %%a)...
    taskkill /f /pid %%a >nul 2>&1
)
echo Da don dep xong.
echo.

echo Dang khoi dong Web Dev Server (Vite) tai cong 3000...
start "Cinemax Web Dev Server" cmd /k "npm run dev"

echo Dang khoi dong Dev Proxy API Server...
start "Cinemax API Server" cmd /k "npm run api"

echo.
echo [SUCCESS] Web Server va API Server da duoc khoi dong trong cua so moi!
echo.
echo ===================================================
echo [3/3] HUONG DAN CAI DAT CHROME EXTENSION
echo ===================================================
echo.
echo 1. Mo Google Chrome va truy cap: chrome://extensions/
echo 2. Bat "Developer mode" (Che do cho nha phat trien) o goc tren ben phai.
echo 3. Click "Load unpacked" (Tai tien ich da giai nen) o goc tren ben trai.
echo 4. Chon thu muc sau:
echo    %~dp0cinemax-extension
echo.
echo 5. Mo trang web: http://localhost:3000/?godmode=activated
echo 6. Mo popup Chrome Extension va kiem tra thong tin trong God-Mode Console.
echo.
echo ===================================================
echo.
pause
