@echo off
title Cinemax Miner v2
color 0A
cls

echo.
echo  ██████╗██╗███╗   ██╗███████╗███╗   ███╗ █████╗ ██╗  ██╗
echo ██╔════╝██║████╗  ██║██╔════╝████╗ ████║██╔══██╗╚██╗██╔╝
echo ██║     ██║██╔██╗ ██║█████╗  ██╔████╔██║███████║ ╚███╔╝ 
echo ██║     ██║██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══██║ ██╔██╗ 
echo ╚██████╗██║██║ ╚████║███████╗██║ ╚═╝ ██║██║  ██║██╔╝ ██╗
echo  ╚═════╝╚═╝╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝
echo             MINER v2.0  --  Hollysheesh Data Engine
echo.
echo ====================================================================
echo  Chon che do crawl:
echo   [1] Quick sync - 5 trang tu tat ca nguon (KKPhim + OPhim + NguonC)
echo   [2] Deep sync  - 20 trang tu tat ca nguon
echo   [3] Full sync  - TAT CA trang (rat lau)
echo   [4] Chi KKPhim - 10 trang
echo   [5] Chi OPhim  - 10 trang
echo   [6] Chi NguonC - 10 trang
echo   [7] Auto watch - Sync lai moi 60 phut
echo   [8] Xem thong ke DB
echo   [0] Thoat
echo ====================================================================
echo.
set /p choice="Nhap lua chon (0-8): "

if "%choice%"=="0" exit
if "%choice%"=="1" goto quick
if "%choice%"=="2" goto deep
if "%choice%"=="3" goto full
if "%choice%"=="4" goto kkphim
if "%choice%"=="5" goto ophim
if "%choice%"=="6" goto nguonc
if "%choice%"=="7" goto watch
if "%choice%"=="8" goto stats

echo Lua chon khong hop le!
pause
goto :eof

:quick
echo.
echo [QUICK] Sync 5 trang tu tat ca nguon...
node hollysheesh-bridge\miner.cjs --pages 5
goto done

:deep
echo.
echo [DEEP] Sync 20 trang tu tat ca nguon...
node hollysheesh-bridge\miner.cjs --pages 20
goto done

:full
echo.
echo [FULL] Sync TOAN BO - co the mat vai gio...
node hollysheesh-bridge\miner.cjs --all
goto done

:kkphim
echo.
echo [KKPHIM] Sync 10 trang tu KKPhim...
node hollysheesh-bridge\miner.cjs --source kkphim --pages 10
goto done

:ophim
echo.
echo [OPHIM] Sync 10 trang tu OPhim...
node hollysheesh-bridge\miner.cjs --source ophim --pages 10
goto done

:nguonc
echo.
echo [NGUONC] Sync 10 trang tu NguonC...
node hollysheesh-bridge\miner.cjs --source nguonc --pages 10
goto done

:watch
echo.
echo [WATCH] Auto sync moi 60 phut (Ctrl+C de dung)...
node hollysheesh-bridge\miner.cjs --pages 5 --watch 60
goto done

:stats
echo.
node hollysheesh-bridge\miner.cjs --stats
goto done

:done
echo.
echo ====================================================================
echo  Hoan thanh! Nhan phim bat ky de thoat...
echo ====================================================================
pause > nul
