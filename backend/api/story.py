import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from db.database import get_db
from db.models import StoryScript, ScriptLine
from engines import get_engine

router = APIRouter()


class ScriptLineIn(BaseModel):
    character_id: str
    text: str
    order: int = 0


class StoryScriptIn(BaseModel):
    name: str
    lines: list[ScriptLineIn] = []


class ScriptLineOut(BaseModel):
    id: str
    character_id: str
    text: str
    order: int
    audio_url: str | None = None
    duration: float | None = None


class StoryScriptOut(BaseModel):
    id: str
    name: str
    lines: list[ScriptLineOut]
    created_at: str


def _to_out(script: StoryScript) -> StoryScriptOut:
    return StoryScriptOut(
        id=script.id,
        name=script.name,
        created_at=script.created_at.isoformat(),
        lines=[
            ScriptLineOut(
                id=line.id,
                character_id=line.character_id,
                text=line.text,
                order=line.order,
                audio_url=f"http://localhost:8765/audio/{Path(line.audio_path).name}"
                if line.audio_path
                else None,
                duration=line.duration,
            )
            for line in script.lines
        ],
    )


@router.get("/scripts", response_model=list[StoryScriptOut])
async def list_scripts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StoryScript)
        .options(selectinload(StoryScript.lines))
        .order_by(StoryScript.created_at.desc())
    )
    return [_to_out(s) for s in result.scalars().all()]


@router.post("/scripts", response_model=StoryScriptOut)
async def create_script(
    payload: StoryScriptIn, db: AsyncSession = Depends(get_db)
):
    script = StoryScript(id=str(uuid.uuid4()), name=payload.name)
    script.lines = [
        ScriptLine(
            id=str(uuid.uuid4()),
            character_id=line.character_id,
            text=line.text,
            order=line.order,
        )
        for line in payload.lines
    ]
    db.add(script)
    await db.commit()
    await db.refresh(script)
    return _to_out(script)


@router.patch("/scripts/{script_id}", response_model=StoryScriptOut)
async def update_script(
    script_id: str,
    payload: StoryScriptIn,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StoryScript)
        .options(selectinload(StoryScript.lines))
        .where(StoryScript.id == script_id)
    )
    script = result.scalar_one_or_none()
    if not script:
        raise HTTPException(status_code=404, detail="劇本不存在")

    script.name = payload.name
    # 重建對白行
    for line in script.lines:
        await db.delete(line)
    script.lines = [
        ScriptLine(
            id=str(uuid.uuid4()),
            character_id=l.character_id,
            text=l.text,
            order=l.order,
        )
        for l in payload.lines
    ]
    await db.commit()
    await db.refresh(script)
    return _to_out(script)


@router.delete("/scripts/{script_id}", status_code=204)
async def delete_script(script_id: str, db: AsyncSession = Depends(get_db)):
    script = await db.get(StoryScript, script_id)
    if not script:
        raise HTTPException(status_code=404, detail="劇本不存在")
    await db.delete(script)
    await db.commit()


@router.post("/scripts/{script_id}/generate", status_code=202)
async def generate_all(
    script_id: str,
    background_tasks: BackgroundTasks,
    engine: str = "qwen3_cloud",
    db: AsyncSession = Depends(get_db),
):
    """批次生成劇本所有對白的語音"""
    result = await db.execute(
        select(StoryScript)
        .options(selectinload(StoryScript.lines))
        .where(StoryScript.id == script_id)
    )
    script = result.scalar_one_or_none()
    if not script:
        raise HTTPException(status_code=404, detail="劇本不存在")

    background_tasks.add_task(_generate_script_audio, script_id, engine)
    return {"message": "批次生成已排入佇列"}


async def _generate_script_audio(script_id: str, engine_name: str):
    """背景批次生成劇本語音"""
    import soundfile as sf
    from db.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(StoryScript)
            .options(selectinload(StoryScript.lines))
            .where(StoryScript.id == script_id)
        )
        script = result.scalar_one_or_none()
        if not script:
            return

        engine = get_engine(engine_name)
        output_dir = Path(f"storage/audio/story_{script_id}")
        output_dir.mkdir(parents=True, exist_ok=True)

        for line in script.lines:
            if not line.text.strip():
                continue
            try:
                out_path = output_dir / f"line_{line.id}.wav"
                tts_result = await engine.synthesize(
                    text=line.text, output_path=out_path
                )
                line.audio_path = str(tts_result.audio_path)
                line.duration = tts_result.duration
            except Exception as e:
                print(f"[StoryEditor] 生成第 {line.order} 行失敗：{e}")

        await db.commit()
