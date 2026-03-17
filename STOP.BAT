@echo off
chcp 65001 >nul
setlocal

echo ============================================
echo  VoiceTTS - 停止服務
echo ============================================
echo.

:: ── 關閉以視窗標題識別的 cmd 視窗 ──
echo [1/2] 停止後端 (VoiceTTS Backend)...
taskkill /fi "windowtitle eq VoiceTTS Backend*" /t /f >nul 2>&1
if errorlevel 1 (
    echo [SKIP] 後端視窗不存在或已關閉
) else (
    echo [OK] 後端已停止
)

echo [2/2] 停止前端 (VoiceTTS Frontend)...
taskkill /fi "windowtitle eq VoiceTTS Frontend*" /t /f >nul 2>&1
if errorlevel 1 (
    echo [SKIP] 前端視窗不存在或已關閉
) else (
    echo [OK] 前端已停止
)

:: ── 確保 port 已釋放 ──
echo.
echo 確認 port 8765 (後端)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8765 " ^| findstr "LISTENING" 2^>nul') do (
    echo   終止 PID %%p (port 8765)
    taskkill /pid %%p /t /f >nul 2>&1
)

echo 確認 port 1420 (前端)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":1420 " ^| findstr "LISTENING" 2^>nul') do (
    echo   終止 PID %%p (port 1420)
    taskkill /pid %%p /t /f >nul 2>&1
)

echo.
echo ============================================
echo  服務已停止
echo ============================================
echo.
pause
endlocal
