@echo off
chcp 65001 >nul
setlocal

echo ============================================
echo  VoiceTTS - 下載本地模型
echo ============================================
echo.

if not exist backend\.venv\Scripts\python.exe (
    echo [錯誤] 找不到 Python 虛擬環境
    echo        請先執行 INSTALL.BAT 安裝依賴
    pause
    exit /b 1
)

:: 將所有命令列參數透傳給 Python 腳本
:: 範例：DOWNLOAD_MODELS.BAT --qwen-small --chatterbox
::       DOWNLOAD_MODELS.BAT --all
::       DOWNLOAD_MODELS.BAT --hf-mirror https://hf-mirror.com --all
call backend\.venv\Scripts\python.exe download_models.py %*

if errorlevel 1 (
    echo.
    echo [注意] 部分模型下載失敗，請查閱上方錯誤訊息
    echo        若在中國大陸，可改用：
    echo        DOWNLOAD_MODELS.BAT --hf-mirror https://hf-mirror.com --all
)

echo.
pause
endlocal
