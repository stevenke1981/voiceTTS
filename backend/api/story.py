"""
劇本編輯器 API
支援角色管理、對白 CRUD、批次語音生成、SSE 進度推送、整軌匯出
"""
import asyncio
import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from db.database import get_db
from db.models import StoryScript, StoryCharacter, ScriptLine, VoiceProfile
from engines import get_engine
from audio.processor import crossfade_merge

router = APIRouter()

# SSE 事件佇列：script_id → asyncio.Queue
_sse_queues: dict[str, asyncio.Queue] = {}


# ─────────────────── Pydantic 模型 ───────────────────

class CharacterIn(BaseModel):
    name: str
    color: str = "bg-violet-500"
    voice_profile_id: str | None = None
    order: int = 0


class CharacterOut(BaseModel):
    id: str
    name: str
    color: str
    voice_profile_id: str | None
    voice_profile_name: str | None
    order: int


class ScriptLineIn(BaseModel):
    character_id: str
    text: str
    order: int = 0


class ScriptLineOut(BaseModel):
    id: str
    character_id: str
    text: str
    order: int
    audio_url: str | None = None
    duration: float | None = None
    gen_status: str


class StoryScriptOut(BaseModel):
    id: str
    name: str
    characters: list[CharacterOut]
    lines: list[ScriptLineOut]
    created_at: str


# ─────────────────── 輔助函式 ───────────────────

def _char_out(c: StoryCharacter) -> CharacterOut:
    return CharacterOut(
        id=c.id,
        name=c.name,
        color=c.color,
        voice_profile_id=c.voice_profile_id,
        voice_profile_name=c.voice_profile.name if c.voice_profile else None,
        order=c.order,
    )


def _line_out(line: ScriptLine) -> ScriptLineOut:
    audio_url = None
    if line.audio_path and Path(line.audio_path).exists():
        filename = Path(line.audio_path).name
        audio_url = f"http://localhost:8765/audio/story/{filename}"
    return ScriptLineOut(
        id=line.id,
        character_id=line.character_id,
        text=line.text,
        order=line.order,
        audio_url=audio_url,
        duration=line.duration,
        gen_status=line.gen_status,
    )


def _script_out(script: StoryScript) -> StoryScriptOut:
    return StoryScriptOut(
        id=script.id,
        name=script.name,
        created_at=script.created_at.isoformat(),
        characters=[_char_out(c) for c in script.characters],
        lines=[_line_out(l) for l in script.lines],
    )


async def _push_sse(script_id: str, event: dict):
    """推送 SSE 事件給對應的訂閱者"""
    q = _sse_queues.get(script_id)
    if q:
        await q.put(event)


# ─────────────────── 劇本 CRUD ───────────────────

@router.get("/scripts", response_model=list[StoryScriptOut])
async def list_scripts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StoryScript)
        .options(
            selectinload(StoryScript.characters).selectinload(StoryCharacter.voice_profile),
            selectinload(StoryScript.lines),
        )
        .order_by(StoryScript.created_at.desc())
    )
    return [_script_out(s) for s in result.scalars().all()]


@router.post("/scripts", response_model=StoryScriptOut)
async def create_script(name: str, db: AsyncSession = Depends(get_db)):
    script = StoryScript(id=str(uuid.uuid4()), name=name)
    db.add(script)
    await db.commit()
    await db.refresh(script)
    # eager load
    result = await db.execute(
        select(StoryScript)
        .options(
            selectinload(StoryScript.characters).selectinload(StoryCharacter.voice_profile),
            selectinload(StoryScript.lines),
        )
        .where(StoryScript.id == script.id)
    )
    return _script_out(result.scalar_one())


@router.patch("/scripts/{script_id}/name", response_model=StoryScriptOut)
async def rename_script(script_id: str, name: str, db: AsyncSession = Depends(get_db)):
    script = await _load_script(script_id, db)
    script.name = name
    await db.commit()
    return _script_out(script)


@router.delete("/scripts/{script_id}", status_code=204)
async def delete_script(script_id: str, db: AsyncSession = Depends(get_db)):
    script = await db.get(StoryScript, script_id)
    if not script:
        raise HTTPException(status_code=404, detail="劇本不存在")
    await db.delete(script)
    await db.commit()


# ─────────────────── 角色 CRUD ───────────────────

@router.post("/scripts/{script_id}/characters", response_model=CharacterOut)
async def add_character(
    script_id: str,
    payload: CharacterIn,
    db: AsyncSession = Depends(get_db),
):
    char = StoryCharacter(
        id=str(uuid.uuid4()),
        script_id=script_id,
        name=payload.name,
        color=payload.color,
        voice_profile_id=payload.voice_profile_id,
        order=payload.order,
    )
    db.add(char)
    await db.commit()
    await db.refresh(char)
    # reload with profile
    result = await db.execute(
        select(StoryCharacter)
        .options(selectinload(StoryCharacter.voice_profile))
        .where(StoryCharacter.id == char.id)
    )
    return _char_out(result.scalar_one())


@router.patch("/scripts/{script_id}/characters/{char_id}", response_model=CharacterOut)
async def update_character(
    script_id: str,
    char_id: str,
    payload: CharacterIn,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StoryCharacter)
        .options(selectinload(StoryCharacter.voice_profile))
        .where(StoryCharacter.id == char_id, StoryCharacter.script_id == script_id)
    )
    char = result.scalar_one_or_none()
    if not char:
        raise HTTPException(status_code=404, detail="角色不存在")
    char.name = payload.name
    char.color = payload.color
    char.voice_profile_id = payload.voice_profile_id
    char.order = payload.order
    await db.commit()
    await db.refresh(char)
    result2 = await db.execute(
        select(StoryCharacter)
        .options(selectinload(StoryCharacter.voice_profile))
        .where(StoryCharacter.id == char_id)
    )
    return _char_out(result2.scalar_one())


@router.delete("/scripts/{script_id}/characters/{char_id}", status_code=204)
async def delete_character(script_id: str, char_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StoryCharacter).where(
            StoryCharacter.id == char_id, StoryCharacter.script_id == script_id
        )
    )
    char = result.scalar_one_or_none()
    if not char:
        raise HTTPException(status_code=404, detail="角色不存在")
    await db.delete(char)
    await db.commit()


# ─────────────────── 對白行 CRUD ───────────────────

@router.post("/scripts/{script_id}/lines", response_model=ScriptLineOut)
async def add_line(
    script_id: str,
    payload: ScriptLineIn,
    db: AsyncSession = Depends(get_db),
):
    line = ScriptLine(
        id=str(uuid.uuid4()),
        script_id=script_id,
        character_id=payload.character_id,
        text=payload.text,
        order=payload.order,
    )
    db.add(line)
    await db.commit()
    await db.refresh(line)
    return _line_out(line)


@router.patch("/scripts/{script_id}/lines/{line_id}", response_model=ScriptLineOut)
async def update_line(
    script_id: str,
    line_id: str,
    payload: ScriptLineIn,
    db: AsyncSession = Depends(get_db),
):
    line = await db.get(ScriptLine, line_id)
    if not line or line.script_id != script_id:
        raise HTTPException(status_code=404, detail="對白行不存在")
    line.character_id = payload.character_id
    line.text = payload.text
    line.order = payload.order
    line.gen_status = "queued"  # 文字修改後重置狀態
    line.audio_path = None
    await db.commit()
    return _line_out(line)


@router.delete("/scripts/{script_id}/lines/{line_id}", status_code=204)
async def delete_line(script_id: str, line_id: str, db: AsyncSession = Depends(get_db)):
    line = await db.get(ScriptLine, line_id)
    if not line or line.script_id != script_id:
        raise HTTPException(status_code=404, detail="對白行不存在")
    if line.audio_path:
        Path(line.audio_path).unlink(missing_ok=True)
    await db.delete(line)
    await db.commit()


@router.post("/scripts/{script_id}/lines/reorder", response_model=StoryScriptOut)
async def reorder_lines(
    script_id: str,
    line_orders: list[dict],   # [{"id": "...", "order": 0}, ...]
    db: AsyncSession = Depends(get_db),
):
    """批次更新對白順序"""
    for item in line_orders:
        line = await db.get(ScriptLine, item["id"])
        if line and line.script_id == script_id:
            line.order = item["order"]
    await db.commit()
    return _script_out(await _load_script(script_id, db))


# ─────────────────── 批次生成 ───────────────────

@router.post("/scripts/{script_id}/generate", status_code=202)
async def generate_all(
    script_id: str,
    background_tasks: BackgroundTasks,
    engine: str = "qwen3_cloud",
    db: AsyncSession = Depends(get_db),
):
    """批次生成劇本所有對白語音（SSE 推播進度）"""
    script = await _load_script(script_id, db)

    # 建立 SSE 佇列
    _sse_queues[script_id] = asyncio.Queue()

    background_tasks.add_task(_generate_script_audio, script_id, engine)
    return {"message": "批次生成已啟動，透過 SSE 追蹤進度"}


@router.get("/scripts/{script_id}/progress")
async def generation_progress(script_id: str):
    """SSE 進度串流：訂閱批次生成事件"""
    if script_id not in _sse_queues:
        _sse_queues[script_id] = asyncio.Queue()

    async def event_stream():
        q = _sse_queues[script_id]
        try:
            while True:
                event = await asyncio.wait_for(q.get(), timeout=30)
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") == "done":
                    break
        except asyncio.TimeoutError:
            yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
        finally:
            _sse_queues.pop(script_id, None)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _generate_script_audio(script_id: str, engine_name: str):
    """背景批次生成語音"""
    from db.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        script = await _load_script(script_id, db)
        lines = [l for l in script.lines if l.text.strip()]
        char_map = {c.id: c for c in script.characters}

        out_dir = Path(f"storage/audio/story_{script_id}")
        out_dir.mkdir(parents=True, exist_ok=True)

        total = len(lines)
        await _push_sse(script_id, {"type": "start", "total": total})

        engine = get_engine(engine_name)

        for i, line in enumerate(lines):
            line.gen_status = "generating"
            await db.commit()
            await _push_sse(script_id, {
                "type": "progress",
                "line_id": line.id,
                "index": i,
                "total": total,
                "status": "generating",
            })

            try:
                char = char_map.get(line.character_id)
                voice_sample: Path | None = None
                if char and char.voice_profile_id:
                    profile = await db.get(VoiceProfile, char.voice_profile_id)
                    if profile:
                        voice_sample = Path(profile.audio_path)

                out_path = out_dir / f"line_{line.id}.wav"
                result = await engine.synthesize(
                    text=line.text,
                    output_path=out_path,
                    voice_sample_path=voice_sample,
                )
                line.audio_path = str(result.audio_path)
                line.duration = result.duration
                line.gen_status = "done"
                await _push_sse(script_id, {
                    "type": "progress",
                    "line_id": line.id,
                    "index": i,
                    "total": total,
                    "status": "done",
                    "audio_url": f"http://localhost:8765/audio/story/{out_path.name}",
                    "duration": result.duration,
                })

            except Exception as e:
                line.gen_status = "error"
                await _push_sse(script_id, {
                    "type": "progress",
                    "line_id": line.id,
                    "index": i,
                    "total": total,
                    "status": "error",
                    "error": str(e),
                })

            await db.commit()

        await _push_sse(script_id, {"type": "done", "total": total})


# ─────────────────── 整軌匯出 ───────────────────

@router.get("/scripts/{script_id}/export")
async def export_script(script_id: str, db: AsyncSession = Depends(get_db)):
    """將所有已生成的對白音訊 crossfade 合併，回傳整軌 WAV"""
    script = await _load_script(script_id, db)

    done_lines = [l for l in script.lines if l.gen_status == "done" and l.audio_path]
    if not done_lines:
        raise HTTPException(status_code=400, detail="尚無已生成的語音，請先批次生成")

    audio_paths = [Path(l.audio_path) for l in done_lines if Path(l.audio_path).exists()]
    if not audio_paths:
        raise HTTPException(status_code=400, detail="音訊檔案不存在")

    out_path = Path(f"storage/audio/story_{script_id}_export.wav")
    crossfade_merge(audio_paths, out_path, crossfade_ms=80)

    return StreamingResponse(
        open(out_path, "rb"),
        media_type="audio/wav",
        headers={
            "Content-Disposition": f'attachment; filename="{script.name}.wav"'
        },
    )


# ─────────────────── 輔助 ───────────────────

async def _load_script(script_id: str, db: AsyncSession) -> StoryScript:
    result = await db.execute(
        select(StoryScript)
        .options(
            selectinload(StoryScript.characters).selectinload(StoryCharacter.voice_profile),
            selectinload(StoryScript.lines),
        )
        .where(StoryScript.id == script_id)
    )
    script = result.scalar_one_or_none()
    if not script:
        raise HTTPException(status_code=404, detail="劇本不存在")
    return script
