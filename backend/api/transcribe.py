"""
語音轉文字 API
POST /api/transcribe — 上傳音訊，回傳 Whisper 轉錄結果
"""
from pathlib import Path
import uuid
import tempfile

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

from audio.transcriber import get_transcriber

router = APIRouter()


class TranscribeResult(BaseModel):
    text: str
    language: str
    segments: list[dict]


@router.post("", response_model=TranscribeResult)
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = Form(default="zh"),
):
    """
    上傳音訊檔案，使用 Whisper 轉錄成文字

    Args:
        audio: 音訊檔案（WAV / MP3 / M4A）
        language: 語言代碼（zh / en / ja / ko / auto）
    """
    suffix = Path(audio.filename or "audio.wav").suffix or ".wav"

    # 寫到暫存檔
    tmp_path = Path(tempfile.gettempdir()) / f"whisper_{uuid.uuid4()}{suffix}"
    try:
        tmp_path.write_bytes(await audio.read())
        transcriber = get_transcriber()
        result = await transcriber.transcribe(tmp_path, language=language)
        return TranscribeResult(**result)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    finally:
        if tmp_path.exists():
            tmp_path.unlink()
