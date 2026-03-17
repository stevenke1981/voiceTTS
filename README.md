# VoiceTTS

> 語音合成與複製桌面應用程式

多引擎 TTS、3 秒語音複製、即時聲音轉換、多角色劇本配音。
基於 **Tauri v2 + React + FastAPI**，支援完全離線本地運行。

---

## 功能

| 功能 | 說明 |
|------|------|
| **文字轉語音** | 多引擎支援、長文自動分段、語速/音調調整、波形播放 |
| **語音複製** | 上傳 3~20 秒音訊，Whisper 自動轉錄，複製任意聲音特徵 |
| **即時語音轉換** | 麥克風輸入即時轉換成目標聲音，WebSocket 低延遲串流 |
| **劇本編輯器** | 多角色對白配音、SSE 批次進度、時間軸視覺化、整軌匯出 |
| **音訊後製效果** | 殘響、壓縮、高通/低通濾波、延遲、增益 |

---

## 技術架構

```
voiceTTS/
├── src/              # React 18 + TypeScript 前端
├── src-tauri/        # Tauri v2 (Rust) 桌面殼層
└── backend/          # FastAPI + SQLite 後端
    ├── engines/      # TTS 引擎抽象層
    ├── audio/        # 音訊處理（分段、效果、合併）
    ├── voice_clone/  # 語音複製（DashScope / 本地）
    └── realtime/     # 即時轉換（VAD + WebSocket）
```

**前端：** React 18 · TypeScript · Tailwind CSS · Zustand · React Query · WaveSurfer.js
**後端：** FastAPI · SQLAlchemy · SQLite · Pedalboard · librosa · OpenAI Whisper
**桌面：** Tauri v2 (Rust)

---

## 支援的 TTS 引擎

| 引擎 | 模式 | 特色 | 需求 |
|------|------|------|------|
| **Qwen3-TTS** | 雲端 API | 首音節 97ms、3 秒語音複製 | DashScope API Key |
| **Qwen3-TTS** | 本地 | 完全離線、0.6B / 1.7B 模型 | GPU（CUDA/ROCm） |
| **Chatterbox** | 本地 | MIT 授權、英文最自然 | GPU（可 CPU） |
| **CosyVoice2** | 本地 | 中文語調最自然、Zero-shot 複製 | GPU（可 CPU） |

---

## 快速開始（Windows）

### 前置需求

- [Node.js](https://nodejs.org/) 20+
- [Python](https://www.python.org/) 3.11–3.13
- GPU（本地模型建議，雲端 API 模式不需要）

### 安裝

```bat
:: 1. Clone 專案
git clone https://github.com/stevenke1981/voiceTTS.git
cd voiceTTS

:: 2. 一鍵安裝所有依賴
INSTALL.BAT
```

> `INSTALL.BAT` 會自動安裝前端 npm 依賴、建立 Python 虛擬環境、安裝後端依賴（含 Python 3.13 相容性修補），並複製 `.env.example` → `.env`。

### 啟動 / 停止

```bat
START.BAT        :: 同時啟動後端 (port 8765) 與前端 (port 1420)
STOP.BAT         :: 停止所有服務並釋放 port
```

前端開啟：[http://localhost:1420](http://localhost:1420)
API 文件：[http://localhost:8765/docs](http://localhost:8765/docs)

### 下載本地模型（可選）

```bat
:: 互動式選單
DOWNLOAD_MODELS.BAT

:: 直接指定模型
DOWNLOAD_MODELS.BAT --qwen-small          :: Qwen3-TTS 0.6B (~1.2 GB)
DOWNLOAD_MODELS.BAT --qwen-large          :: Qwen3-TTS 1.7B (~3.4 GB)
DOWNLOAD_MODELS.BAT --chatterbox          :: Chatterbox (~1.0 GB)
DOWNLOAD_MODELS.BAT --cosyvoice          :: CosyVoice2-0.5B (~1.0 GB)
DOWNLOAD_MODELS.BAT --all                :: 全部下載

:: 中國大陸鏡像
DOWNLOAD_MODELS.BAT --hf-mirror https://hf-mirror.com --all
```

模型下載後，進入 **設定頁面 → TTS 引擎** 選擇本地引擎，首次請求時自動載入（約 5–30 秒）。

---

## 環境變數

複製 `.env.example` 為 `.env` 並填入：

| 變數 | 說明 | 必要 |
|------|------|------|
| `DASHSCOPE_API_KEY` | 阿里雲 DashScope API 金鑰 | 雲端模式 |
| `WHISPER_MODEL_SIZE` | Whisper 模型大小（`tiny` / `base` / `small`） | 否，預設 `base` |
| `BACKEND_PORT` | 後端 Port | 否，預設 `8765` |

---

## API 文件

後端啟動後開啟：[http://localhost:8765/docs](http://localhost:8765/docs)

主要端點：

```
POST /api/tts/generate                    # 建立 TTS 任務
GET  /api/tts/jobs/{id}                   # 查詢任務狀態

POST /api/clone/profiles                  # 建立聲音輪廓
GET  /api/clone/profiles                  # 列出所有輪廓

WS   /ws/realtime                         # 即時語音轉換 WebSocket

POST /api/story/scripts                   # 建立劇本
POST /api/story/scripts/{id}/generate     # 批次生成
GET  /api/story/scripts/{id}/progress     # SSE 進度
GET  /api/story/scripts/{id}/export       # 匯出整軌 WAV

POST /api/transcribe                      # Whisper 語音轉文字
GET  /api/engines/status                  # 引擎可用狀態
```

---

## Python 3.13 相容性

本專案已針對 Python 3.13 進行修補：

- **`setuptools >= 75` 移除 `pkg_resources`**：`INSTALL.BAT` 固定安裝 `setuptools==69.5.1`
- **`openai-whisper` setup.py `exec/locals()` 行為變更**：`install_whisper.py` 自動下載並套用修補後安裝
- **SQLAlchemy 非同步需要 `greenlet`**：已加入 `requirements.txt`

---

## 語音複製流程

```
上傳音訊（3~20 秒）
  ↓
Whisper 自動轉錄（確認音質）
  ↓
DashScope 建立 cloud_voice_id（背景執行）
  ↓
生成預覽音訊
  ↓
套用至 TTS / 即時轉換 / 劇本配音
```

---

## 開發進度

- [x] Phase 1 — 專案骨架（Tauri + React + FastAPI）
- [x] Phase 2 — TTS 多引擎、分段合成、音訊後處理
- [x] Phase 3 — 語音複製（Whisper + DashScope）
- [x] Phase 4 — 即時語音轉換（WebSocket + VAD）
- [x] Phase 5 — 劇本編輯器（SSE 進度 + 時間軸 + 整軌匯出）
- [x] Phase 6 — 音訊後製效果 UI（殘響、壓縮、高通/低通濾波、延遲、增益）
- [x] Phase 7 — Windows 一鍵安裝/啟動/停止腳本 + 本地模型下載工具

---

## License

MIT
