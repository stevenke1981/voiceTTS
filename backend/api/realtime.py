"""
即時語音轉換 WebSocket 端點

協定：
  連線：ws://localhost:8765/ws/realtime?profile_id=xxx&engine=cosyvoice
  客戶端傳入：Int16 PCM 音訊 bytes（16kHz mono）
  伺服器回傳：WAV bytes（每次偵測到句子結束後輸出）
              或 JSON 控制訊息 {"type": "status", "msg": "..."}
"""
import json
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

router = APIRouter()


@router.websocket("/realtime")
async def realtime_voice_convert(
    websocket: WebSocket,
    profile_id: str = Query(...),
    engine: str = Query(default="cosyvoice"),
):
    await websocket.accept()

    # 取得聲音輪廓的音訊路徑
    from db.database import AsyncSessionLocal
    from db.models import VoiceProfile

    async with AsyncSessionLocal() as db:
        profile = await db.get(VoiceProfile, profile_id)

    if not profile:
        await websocket.send_text(
            json.dumps({"type": "error", "msg": "聲音輪廓不存在"})
        )
        await websocket.close(code=1008)
        return

    profile_audio = Path(profile.audio_path)
    if not profile_audio.exists():
        await websocket.send_text(
            json.dumps({"type": "error", "msg": "聲音樣本檔案遺失"})
        )
        await websocket.close(code=1011)
        return

    # 傳送就緒訊號
    await websocket.send_text(
        json.dumps({"type": "ready", "msg": f"即時轉換就緒，使用引擎：{engine}"})
    )

    # 建立轉換器
    from realtime.converter import RealtimeConverter
    converter = RealtimeConverter(profile_audio_path=profile_audio, engine_name=engine)

    try:
        while True:
            data = await websocket.receive_bytes()

            # 處理音訊 chunk，可能回傳轉換結果
            result = await converter.process_chunk(data)
            if result is not None:
                # 回傳轉換後的 WAV bytes
                await websocket.send_bytes(result)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(
                json.dumps({"type": "error", "msg": str(e)})
            )
        except Exception:
            pass
