"""
即時語音轉換 WebSocket 端點
流程：麥克風音訊 → WebSocket → 聲音轉換 → 音訊回傳
"""
import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/realtime")
async def realtime_voice_convert(
    websocket: WebSocket,
    profile_id: str,
):
    """
    即時語音轉換 WebSocket

    客戶端傳入：Int16Array PCM 音訊資料（16kHz mono）
    伺服器回傳：轉換後 PCM 音訊資料
    """
    await websocket.accept()

    try:
        # TODO Phase 4：載入對應 profile 的聲音特徵模型
        # converter = VoiceConverter(profile_id)

        buffer = bytearray()

        while True:
            # 接收麥克風 PCM 資料
            data = await websocket.receive_bytes()
            buffer.extend(data)

            # 累積足夠資料後進行轉換（320ms chunk = 5120 bytes at 16kHz/16bit）
            chunk_size = 5120
            while len(buffer) >= chunk_size:
                chunk = bytes(buffer[:chunk_size])
                buffer = buffer[chunk_size:]

                # TODO Phase 4：實際聲音轉換邏輯
                # converted = await converter.convert(chunk)
                converted = chunk  # 暫時回傳原始音訊（passthrough）

                await websocket.send_bytes(converted)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.close(code=1011, reason=str(e))
