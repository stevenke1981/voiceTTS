import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.database import get_db
from db.models import TTSJob, VoiceProfile
from engines import get_engine
from audio.chunker import chunk_text
from audio.processor import apply_effects, change_speed, crossfade_merge

router = APIRouter()


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50_000)
    engine: str = Field(default="qwen3_cloud")
    voice_profile_id: str | None = None
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    pitch: int = Field(default=0, ge=-12, le=12)


class TTSJobOut(BaseModel):
    job_id: str
    status: str
    audio_url: str | None = None
    error: str | None = None
    created_at: str


async def _run_tts(job_id: str, req: TTSRequest):
    """背景執行 TTS 任務（含分段合成 + 後製）"""
    from db.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        job = await db.get(TTSJob, job_id)
        if not job:
            return
        job.status = "processing"
        await db.commit()

        try:
            engine = get_engine(req.engine)

            # 取得聲音樣本路徑
            voice_sample_path: Path | None = None
            if req.voice_profile_id:
                profile = await db.get(VoiceProfile, req.voice_profile_id)
                if profile:
                    voice_sample_path = Path(profile.audio_path)

            # 長文分段
            chunks = chunk_text(req.text, max_chars=200)
            work_dir = Path(f"storage/audio/job_{job_id}")
            work_dir.mkdir(parents=True, exist_ok=True)

            # 逐段合成（音調先不調整，統一交由 apply_effects 處理）
            chunk_paths: list[Path] = []
            for i, chunk in enumerate(chunks):
                chunk_path = work_dir / f"chunk_{i:03d}.wav"
                await engine.synthesize(
                    text=chunk,
                    output_path=chunk_path,
                    voice_sample_path=voice_sample_path,
                    speed=1.0,   # 語速後製處理
                    pitch=0,     # 音調後製處理
                )
                chunk_paths.append(chunk_path)

            # 多段 crossfade 合併
            if len(chunk_paths) == 1:
                merged_path = chunk_paths[0]
            else:
                merged_path = work_dir / "merged.wav"
                crossfade_merge(chunk_paths, merged_path, crossfade_ms=80)

            # 語速調整
            after_speed = work_dir / "after_speed.wav"
            change_speed(merged_path, after_speed, speed=req.speed)

            # 音調 + 其他效果
            final_path = Path(f"storage/audio/tts_{job_id}.wav")
            apply_effects(
                after_speed,
                final_path,
                pitch_semitones=req.pitch,
            )

            job.status = "done"
            job.audio_path = str(final_path)

        except Exception as e:
            job.status = "error"
            job.error = str(e)

        await db.commit()


@router.post("/generate", response_model=TTSJobOut)
async def generate_tts(
    req: TTSRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """建立 TTS 生成任務，非同步執行"""
    job_id = str(uuid.uuid4())

    job = TTSJob(
        id=job_id,
        text=req.text,
        engine=req.engine,
        voice_profile_id=req.voice_profile_id,
        status="queued",
    )
    db.add(job)
    await db.commit()

    background_tasks.add_task(_run_tts, job_id, req)

    return TTSJobOut(
        job_id=job_id,
        status="queued",
        created_at=job.created_at.isoformat(),
    )


@router.get("/jobs/{job_id}", response_model=TTSJobOut)
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(TTSJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="任務不存在")

    audio_url = None
    if job.status == "done" and job.audio_path:
        filename = Path(job.audio_path).name
        audio_url = f"http://localhost:8765/audio/{filename}"

    return TTSJobOut(
        job_id=job.id,
        status=job.status,
        audio_url=audio_url,
        error=job.error,
        created_at=job.created_at.isoformat(),
    )


@router.get("/jobs", response_model=list[TTSJobOut])
async def list_jobs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TTSJob).order_by(TTSJob.created_at.desc()).limit(50)
    )
    jobs = result.scalars().all()

    return [
        TTSJobOut(
            job_id=j.id,
            status=j.status,
            audio_url=f"http://localhost:8765/audio/{Path(j.audio_path).name}"
            if j.audio_path
            else None,
            error=j.error,
            created_at=j.created_at.isoformat(),
        )
        for j in jobs
    ]


@router.delete("/jobs/{job_id}", status_code=204)
async def delete_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(TTSJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="任務不存在")
    # 清理音訊檔案
    if job.audio_path:
        p = Path(job.audio_path)
        if p.exists():
            p.unlink()
    await db.delete(job)
    await db.commit()
