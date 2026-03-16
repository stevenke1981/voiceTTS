"""
Qwen3-TTS 雲端 API 引擎
使用 DashScope OpenAI 相容 API
"""
import os
from pathlib import Path

import httpx
from openai import AsyncOpenAI

from engines.base import BaseTTSEngine, TTSResult


class Qwen3CloudEngine(BaseTTSEngine):
    """
    Qwen3-TTS 雲端模式
    透過 DashScope API 呼叫，無需本地 GPU
    延遲目標：首音節 ~97ms
    支援語言：中文、英文、日文、韓文、德法俄葡西義
    """

    def __init__(self):
        api_key = os.getenv("DASHSCOPE_API_KEY", "")
        self._client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        )
        self._model = "qwen-tts-turbo"  # 或 qwen-tts

    @property
    def name(self) -> str:
        return "qwen3_cloud"

    async def synthesize(
        self,
        text: str,
        output_path: Path,
        voice_sample_path: Path | None = None,
        speed: float = 1.0,
        pitch: int = 0,
    ) -> TTSResult:
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # 若有聲音樣本，使用語音複製模式
        extra_params: dict = {}
        if voice_sample_path and voice_sample_path.exists():
            extra_params["voice"] = "custom"
            # 實際語音複製需透過 DashScope Voice Clone API 先建立 voice_id
            # 此處為簡化，直接傳入 voice_id（應由 VoiceProfile 儲存）

        response = await self._client.audio.speech.create(
            model=self._model,
            input=text,
            voice="longxiaochun",  # 預設聲音；複製時換成 custom voice_id
            response_format="wav",
            speed=speed,
            **extra_params,
        )

        output_path.write_bytes(response.content)

        # 計算時長
        import soundfile as sf
        info = sf.info(str(output_path))
        return TTSResult(audio_path=output_path, duration=info.duration)

    async def health_check(self) -> bool:
        api_key = os.getenv("DASHSCOPE_API_KEY", "")
        return bool(api_key)
