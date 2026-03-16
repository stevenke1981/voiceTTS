"""
語音複製 API
流程：上傳音訊 → Whisper 轉錄 → DashScope 建立 voice_id → 儲存 VoiceProfile
"""
import uuid
import os
from pathlib import Path

import soundfile as sf
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.database import get_db
from db.models import VoiceProfile
from audio.transcriber import get_transcriber
from voice_clone.qwen3_clone import create_custom_voice, delete_custom_voice
from voice_clone.preview import generate_preview

router = APIRouter()


class VoiceProfileOut(BaseModel):
    id: str
    name: str
    language: str
    duration: float
    transcript: str | None
    cloud_voice_id: str | None
    created_at: str
    audio_preview_url: str | None = None


def _profile_to_out(p: VoiceProfile) -> VoiceProfileOut:
    filename = Path(p.audio_path).name if p.audio_path else None
    return VoiceProfileOut(
        id=p.id,
        name=p.name,
        language=p.language,
        duration=p.duration,
        transcript=p.transcript,
        cloud_voice_id=p.cloud_voice_id,
        created_at=p.created_at.isoformat(),
        audio_preview_url=f"http://localhost:8765/audio/profiles/{filename}" if filename else None,
    )


async def _upload_to_cloud(profile_id: str, audio_path: Path, name: str):
    """背景任務：將聲音樣本上傳到 DashScope 取得 voice_id"""
    from db.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        profile = await db.get(VoiceProfile, profile_id)
        if not profile:
            return
        try:
            voice_id = await create_custom_voice(audio_path, name)
            profile.cloud_voice_id = voice_id
        except Exception as e:
            # 雲端上傳失敗不影響本地使用，僅記錄
            print(f"[VoiceClone] DashScope 上傳失敗（{profile_id}）：{e}")
        await db.commit()


@router.post("/profiles", response_model=VoiceProfileOut)
async def create_profile(
    name: str = Form(...),
    language: str = Form(default="zh-TW"),
    audio: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """
    上傳聲音樣本，建立語音複製輪廓

    步驟：
      1. 儲存音訊檔案
      2. Whisper 自動轉錄（同步，用於確認音質）
      3. 背景上傳到 DashScope 取得 cloud_voice_id（非同步，不阻塞回應）
    """
    profile_id = str(uuid.uuid4())
    audio_dir = Path("storage/profiles")
    audio_dir.mkdir(parents=True, exist_ok=True)

    suffix = Path(audio.filename or "sample.wav").suffix or ".wav"
    audio_path = audio_dir / f"{profile_id}{suffix}"
    audio_path.write_bytes(await audio.read())

    # 計算時長
    try:
        info = sf.info(str(audio_path))
        duration = info.duration
    except Exception:
        duration = 0.0

    # Whisper 轉錄
    transcript: str | None = None
    try:
        transcriber = get_transcriber()
        lang_code = language.split("-")[0]  # "zh-TW" → "zh"
        result = await transcriber.transcribe(audio_path, language=lang_code)
        transcript = result["text"]
    except Exception as e:
        print(f"[VoiceClone] Whisper 轉錄失敗：{e}")

    profile = VoiceProfile(
        id=profile_id,
        name=name,
        language=language,
        duration=duration,
        audio_path=str(audio_path),
        transcript=transcript,
    )
    db.add(profile)
    await db.commit()

    # 背景任務：上傳雲端 + 生成預覽音訊
    if background_tasks:
        if os.getenv("DASHSCOPE_API_KEY"):
            background_tasks.add_task(_upload_to_cloud, profile_id, audio_path, name)
        # 用 qwen3_cloud 生成預覽（有 API key）或跳過
        engine = "qwen3_cloud" if os.getenv("DASHSCOPE_API_KEY") else "qwen3_local"
        background_tasks.add_task(generate_preview, profile_id, language, engine)

    return _profile_to_out(profile)


@router.get("/profiles", response_model=list[VoiceProfileOut])
async def list_profiles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(VoiceProfile).order_by(VoiceProfile.created_at.desc())
    )
    return [_profile_to_out(p) for p in result.scalars().all()]


@router.get("/profiles/{profile_id}", response_model=VoiceProfileOut)
async def get_profile(profile_id: str, db: AsyncSession = Depends(get_db)):
    profile = await db.get(VoiceProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="聲音輪廓不存在")
    return _profile_to_out(profile)


@router.delete("/profiles/{profile_id}", status_code=204)
async def delete_profile(profile_id: str, db: AsyncSession = Depends(get_db)):
    profile = await db.get(VoiceProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="聲音輪廓不存在")

    # 刪除 DashScope 上的聲音
    if profile.cloud_voice_id:
        try:
            await delete_custom_voice(profile.cloud_voice_id)
        except Exception as e:
            print(f"[VoiceClone] DashScope 刪除失敗：{e}")

    # 刪除本地音訊
    audio_path = Path(profile.audio_path)
    if audio_path.exists():
        audio_path.unlink()

    await db.delete(profile)
    await db.commit()


@router.post("/profiles/{profile_id}/retranscribe", response_model=VoiceProfileOut)
async def retranscribe(
    profile_id: str,
    language: str = "zh",
    db: AsyncSession = Depends(get_db),
):
    """重新轉錄聲音樣本（換語言或 Whisper 失敗時使用）"""
    profile = await db.get(VoiceProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="聲音輪廓不存在")

    try:
        transcriber = get_transcriber()
        result = await transcriber.transcribe(Path(profile.audio_path), language=language)
        profile.transcript = result["text"]
        await db.commit()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Whisper 轉錄失敗：{e}")

    return _profile_to_out(profile)
