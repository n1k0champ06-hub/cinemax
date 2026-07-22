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
echo   [1] Quick sync  - 5 trang x 4 nguon (~350 phim)
echo   [2] Batch 300   - 13 trang x 4 nguon (~1,000 phim / 300+ phim moi nguon)
echo   [3] Deep sync   - 30 trang tu 4 nguon
echo   [4] Full sync   - TAT CA trang (rat lau)
echo   [5] Chi KKPhim  - 10 trang
echo   [6] Chi OPhim   - 10 trang
echo   [7] Chi NguonC  - 10 trang
echo   [8] Chi HoatHinh - 10 trang Anime chuyên biệt
echo   [9] Auto watch  - Sync lai moi 60 phut
echo   [10] Xem thong ke DB
echo   [0] Thoat
echo ====================================================================
echo.
set /p choice="Nhap lua chon (0-10): "

if "%choice%"=="0" exit
if "%choice%"=="1" goto quick
if "%choice%"=="2" goto batch300
if "%choice%"=="3" goto deep
if "%choice%"=="4" goto full
if "%choice%"=="5" goto kkphim
if "%choice%"=="6" goto ophim
if "%choice%"=="7" goto nguonc
if "%choice%"=="8" goto hoathinh
if "%choice%"=="9" goto watch
if "%choice%"=="10" goto stats

echo Lua chon khong hop le!
pause
goto :eof

:quick
echo.
echo [QUICK] Sync 5 trang x 4 nguon...
node hollysheesh-bridge\miner.cjs --pages 5 --concurrency 6
goto done

:batch300
echo.
echo [BATCH 300] Sync 13 trang x 4 nguon (300+ phim moi nguon)...
node hollysheesh-bridge\miner.cjs --pages 13 --concurrency 8
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

:hoathinh
echo.
echo [HOATHINH] Sync 10 trang Anime/HoatHinh...
node hollysheesh-bridge\miner.cjs --source hoathinh --pages 10
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
