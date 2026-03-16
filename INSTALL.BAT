@echo off
chcp 65001 >nul
setlocal

echo ============================================
echo  VoiceTTS - 安裝相依套件
echo ============================================
echo.

:: ── 1. 確認 Node.js ──
where node >nul 2>&1
if errorlevel 1 (
    echo [錯誤] 找不到 Node.js，請先安裝 Node.js 20+
    echo        下載：https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo [OK] Node.js %%v

:: ── 2. 確認 Python ──
where python >nul 2>&1
if errorlevel 1 (
    echo [錯誤] 找不到 Python，請先安裝 Python 3.11+
    echo        下載：https://www.python.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version') do echo [OK] %%v

:: ── 3. 前端 npm install ──
echo.
echo [1/4] 安裝前端依賴 (npm install)...
call npm install
if errorlevel 1 (
    echo [錯誤] npm install 失敗
    pause
    exit /b 1
)
echo [OK] 前端依賴安裝完成

:: ── 4. 建立 Python 虛擬環境 ──
echo.
echo [2/4] 建立 Python 虛擬環境 (backend\.venv)...
if exist backend\.venv (
    echo [SKIP] 虛擬環境已存在，跳過建立
) else (
    python -m venv backend\.venv
    if errorlevel 1 (
        echo [錯誤] 建立虛擬環境失敗
        pause
        exit /b 1
    )
    echo [OK] 虛擬環境建立完成
)

:: ── 5. 升級 pip ──
echo.
echo [3/4] 升級 pip...
call backend\.venv\Scripts\python.exe -m pip install --upgrade pip --quiet
echo [OK] pip 已升級

:: ── 6. 安裝後端依賴 ──
echo.
echo [4/4] 安裝後端依賴 (pip install -r requirements.txt)...
call backend\.venv\Scripts\pip.exe install -r backend\requirements.txt
if errorlevel 1 (
    echo [錯誤] 後端依賴安裝失敗
    pause
    exit /b 1
)
echo [OK] 後端依賴安裝完成

:: ── 7. 建立 .env ──
echo.
if not exist .env (
    if exist .env.example (
        copy .env.example .env >nul
        echo [OK] 已複製 .env.example -> .env
        echo      請編輯 .env 填入 DASHSCOPE_API_KEY（使用雲端模式時）
    )
) else (
    echo [SKIP] .env 已存在
)

echo.
echo ============================================
echo  安裝完成！執行 START.BAT 啟動應用程式
echo ============================================
echo.
pause
endlocal
