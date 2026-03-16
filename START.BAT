@echo off
chcp 65001 >nul
setlocal

echo ============================================
echo  VoiceTTS - 啟動應用程式
echo ============================================
echo.

:: ── 檢查虛擬環境 ──
if not exist backend\.venv\Scripts\python.exe (
    echo [錯誤] 找不到 Python 虛擬環境
    echo        請先執行 INSTALL.BAT 安裝依賴
    pause
    exit /b 1
)

:: ── 檢查 node_modules ──
if not exist node_modules (
    echo [錯誤] 找不到 node_modules
    echo        請先執行 INSTALL.BAT 安裝依賴
    pause
    exit /b 1
)

echo [後端] 啟動 FastAPI (http://localhost:8765)...
start "VoiceTTS Backend" cmd /k "cd /d %~dp0backend && .\.venv\Scripts\uvicorn.exe main:app --reload --port 8765"

:: 等待後端就緒
echo 等待後端啟動...
timeout /t 3 /nobreak >nul

echo [前端] 啟動 Vite Dev Server (http://localhost:1420)...
start "VoiceTTS Frontend" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ============================================
echo  後端：http://localhost:8765
echo  前端：http://localhost:1420
echo  API 文件：http://localhost:8765/docs
echo.
echo  關閉兩個黑色視窗即可停止服務
echo ============================================
echo.
pause
endlocal
