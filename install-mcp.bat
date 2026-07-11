@echo off
title Cinemax MCP Auto-Installer
color 0A
cls

echo ===================================================
echo             CINEMAX MCP AUTO-INSTALLER
echo ===================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js first.
    echo.
    pause
    exit /b
)

echo Dang tu dong cau hinh file .claude.json...
echo.

:: Run Node.js script to create/merge .claude.json
node -e " + ^
const fs = require('fs'); + ^
const path = require('path'); + ^
const configPath = path.join(process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\cykab', '.claude.json'); + ^
let config = { mcpServers: {} }; + ^
if (fs.existsSync(configPath)) { + ^
  try { + ^
    config = JSON.parse(fs.readFileSync(configPath, 'utf8')); + ^
    if (!config.mcpServers) config.mcpServers = {}; + ^
  } catch (e) { + ^
    console.log('[WARN] Loi khi doc file .claude.json cu. Se ghi de moi...'); + ^
  } + ^
} + ^
config.mcpServers.playwright = { + ^
  command: 'npx', + ^
  args: ['-y', '@playwright/mcp', '--browser', 'chrome'], + ^
  description: 'Browser automation and testing via Playwright' + ^
}; + ^
config.mcpServers.sqlite = { + ^
  command: 'npx', + ^
  args: ['-y', '@modelcontextprotocol/server-sqlite', '--db', 'c:/Users/cykab/Downloads/cinemax/cinemax-debug.db'], + ^
  description: 'Local SQLite database operations' + ^
}; + ^
fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8'); + ^
console.log('[SUCCESS] Da cau hinh cac MCP servers vao file: ' + configPath); + ^
"

if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Thiet lap file cau hinh .claude.json that bai!
    pause
    exit /b
)

echo.
echo ===================================================
echo KHOI TAO TRINH DUYET CHO PLAYWRIGHT...
echo ===================================================
echo.
echo Dang tai xuong trinh duyet cho Playwright (vui long cho)...
call npx playwright install chromium

echo.
echo ===================================================
echo [HOAN TAT] DA CAI DAT XONG TU A-Z!
echo ===================================================
echo.
echo LUU Y QUAN TRONG:
echo De ap dung cac cong cu MCP moi vao he thong, vui long:
echo - TIEP TUC hoac KHOI DONG LAI phien lam viec Claude Code/Antigravity nay.
echo.
echo Cac cong cu nhu 'playwright_navigate', 'sqlite_query' se tu dong xuat hien sau do.
echo ===================================================
echo.
pause
