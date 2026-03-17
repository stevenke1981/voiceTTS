"""
VoiceTTS FastAPI 後端入口
啟動方式：uvicorn main:app --reload --port 8765
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db.database import init_db
from api.tts import router as tts_router
from api.clone import router as clone_router
from api.realtime import router as realtime_router
from api.story import router as story_router
from api.engines import router as engines_router
from api.transcribe import router as transcribe_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # 確保儲存目錄存在
    for d in ["storage/audio", "storage/profiles", "storage/audio/story"]:
        Path(d).mkdir(parents=True, exist_ok=True)
    print("✅ VoiceTTS 後端啟動 — http://localhost:8765")
    yield
    print("⏹ VoiceTTS 後端關閉")


app = FastAPI(
    title="VoiceTTS API",
    description="語音合成與複製後端服務",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS：允許 Tauri WebView 與本地開發頁面存取
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:1420",
        "http://localhost:5173",
        "tauri://localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 確保靜態目錄在掛載前存在（StaticFiles 在模組載入時就需要目錄）
for _d in ["storage/audio", "storage/profiles", "storage/audio/story"]:
    Path(_d).mkdir(parents=True, exist_ok=True)

# 靜態檔案服務（生成的音訊）
app.mount("/audio", StaticFiles(directory="storage/audio"), name="audio")
app.mount(
    "/audio/profiles",
    StaticFiles(directory="storage/profiles"),
    name="profiles",
)
app.mount(
    "/audio/story",
    StaticFiles(directory="storage/audio/story"),
    name="story-audio",
)

# API 路由
app.include_router(tts_router, prefix="/api/tts", tags=["TTS"])
app.include_router(clone_router, prefix="/api/clone", tags=["Voice Clone"])
app.include_router(realtime_router, prefix="/ws", tags=["Real-Time"])
app.include_router(story_router, prefix="/api/story", tags=["Story Editor"])
app.include_router(engines_router, prefix="/api/engines", tags=["Engines"])
app.include_router(transcribe_router, prefix="/api/transcribe", tags=["Transcribe"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
