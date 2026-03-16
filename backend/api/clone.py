import uuid
from pathlib import Path

import soundfile as sf
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.database import get_db
from db.models import VoiceProfile

router = APIRouter()


class VoiceProfileOut(BaseModel):
    id: str
    name: str
    language: str
    duration: float
    created_at: str
    audio_preview_url: str | None = None


@router.post("/profiles", response_model=VoiceProfileOut)
async def create_profile(
    name: str = Form(...),
    language: str = Form(default="zh-TW"),
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """上傳聲音樣本，建立語音複製輪廓"""
    profile_id = str(uuid.uuid4())
    audio_dir = Path("storage/profiles")
    audio_dir.mkdir(parents=True, exist_ok=True)

    # 儲存原始音訊
    suffix = Path(audio.filename or "sample.wav").suffix or ".wav"
    audio_path = audio_dir / f"{profile_id}{suffix}"
    audio_path.write_bytes(await audio.read())

    # 計算時長
    try:
        info = sf.info(str(audio_path))
        duration = info.duration
    except Exception:
        duration = 0.0

    profile = VoiceProfile(
        id=profile_id,
        name=name,
        language=language,
        duration=duration,
        audio_path=str(audio_path),
    )
    db.add(profile)
    await db.commit()

    return VoiceProfileOut(
        id=profile.id,
        name=profile.name,
        language=profile.language,
        duration=profile.duration,
        created_at=profile.created_at.isoformat(),
        audio_preview_url=f"http://localhost:8765/audio/profiles/{profile_id}{suffix}",
    )


@router.get("/profiles", response_model=list[VoiceProfileOut])
async def list_profiles(db: AsyncSession = Depends(get_db)):
    """取得所有聲音輪廓"""
    result = await db.execute(
        select(VoiceProfile).order_by(VoiceProfile.created_at.desc())
    )
    profiles = result.scalars().all()

    return [
        VoiceProfileOut(
            id=p.id,
            name=p.name,
            language=p.language,
            duration=p.duration,
            created_at=p.created_at.isoformat(),
        )
        for p in profiles
    ]


@router.delete("/profiles/{profile_id}", status_code=204)
async def delete_profile(profile_id: str, db: AsyncSession = Depends(get_db)):
    """刪除聲音輪廓"""
    profile = await db.get(VoiceProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="聲音輪廓不存在")

    # 刪除音訊檔案
    audio_path = Path(profile.audio_path)
    if audio_path.exists():
        audio_path.unlink()

    await db.delete(profile)
    await db.commit()
