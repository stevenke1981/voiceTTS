"""
Qwen3-TTS DashScope 語音複製服務
文件：https://www.alibabacloud.com/help/en/model-studio/qwen-tts-voice-cloning

流程：
  1. 上傳聲音樣本 → 取得 voice_id
  2. 儲存 voice_id 至 VoiceProfile
  3. TTS 生成時帶入 voice_id → 複製聲音輸出
"""
import os
import httpx
from pathlib import Path


DASHSCOPE_BASE = "https://dashscope.aliyuncs.com/api/v1"


def _headers() -> dict:
    api_key = os.getenv("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise RuntimeError("DASHSCOPE_API_KEY 未設定，請在 .env 填入")
    return {
        "Authorization": f"Bearer {api_key}",
    }


async def create_custom_voice(
    audio_path: Path,
    voice_name: str,
    prefix: str = "voicetts",
) -> str:
    """
    上傳聲音樣本到 DashScope，建立自訂 voice_id

    Args:
        audio_path: 聲音樣本路徑（WAV，3~20 秒）
        voice_name: 聲音輪廓顯示名稱
        prefix: voice_id 前綴

    Returns:
        voice_id (str) — 後續 TTS 帶入此 ID 即可複製聲音
    """
    async with httpx.AsyncClient(timeout=60) as client:
        # Step 1: 上傳聲音樣本
        with open(audio_path, "rb") as f:
            upload_resp = await client.post(
                f"{DASHSCOPE_BASE}/voices",
                headers=_headers(),
                files={"audio_file": (audio_path.name, f, "audio/wav")},
                data={
                    "model": "cosyvoice-clone-v1",
                    "voice_name": f"{prefix}_{voice_name}",
                },
            )

        if upload_resp.status_code not in (200, 201):
            raise RuntimeError(
                f"DashScope 語音上傳失敗 [{upload_resp.status_code}]：{upload_resp.text}"
            )

        data = upload_resp.json()
        voice_id: str = data.get("voice_id") or data.get("output", {}).get("voice_id", "")

        if not voice_id:
            raise RuntimeError(f"DashScope 回應缺少 voice_id：{data}")

        return voice_id


async def delete_custom_voice(voice_id: str) -> None:
    """刪除 DashScope 上的自訂聲音"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.delete(
            f"{DASHSCOPE_BASE}/voices/{voice_id}",
            headers=_headers(),
        )
        # 404 視為已刪除，不拋錯
        if resp.status_code not in (200, 204, 404):
            raise RuntimeError(f"DashScope 刪除聲音失敗 [{resp.status_code}]：{resp.text}")


async def tts_with_voice_clone(
    text: str,
    voice_id: str,
    output_path: Path,
    speed: float = 1.0,
) -> Path:
    """
    使用已複製的聲音生成 TTS（串流模式）

    Args:
        text: 要合成的文字
        voice_id: 由 create_custom_voice 取得的 voice_id
        output_path: WAV 輸出路徑
        speed: 語速（0.5 ~ 2.0）

    Returns:
        output_path
    """
    from openai import AsyncOpenAI

    api_key = os.getenv("DASHSCOPE_API_KEY", "")
    client = AsyncOpenAI(
        api_key=api_key,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )

    response = await client.audio.speech.create(
        model="qwen-tts",
        input=text,
        voice=voice_id,          # 使用複製的聲音
        response_format="wav",
        speed=speed,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(response.content)
    return output_path
