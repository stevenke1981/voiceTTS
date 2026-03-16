"""
CosyVoice2 TTS 引擎（本地）
Alibaba 開源，中文語調最自然
"""
from pathlib import Path

from engines.base import BaseTTSEngine, TTSResult


class CosyVoice2Engine(BaseTTSEngine):
    """
    CosyVoice2-0.5B 本地推理引擎
    優點：中文語調最自然、支援多語言、3 秒語音複製
    """

    MODEL_ID = "FunAudioLLM/CosyVoice2-0.5B"

    def __init__(self):
        self._model = None

    @property
    def name(self) -> str:
        return "cosyvoice"

    def _load(self):
        if self._model is not None:
            return
        try:
            from cosyvoice.cli.cosyvoice import CosyVoice2
            self._model = CosyVoice2(self.MODEL_ID, load_jit=False, load_trt=False)
        except ImportError as e:
            raise RuntimeError(
                "CosyVoice2 未安裝。請參閱：https://github.com/FunAudioLLM/CosyVoice"
            ) from e

    async def synthesize(
        self,
        text: str,
        output_path: Path,
        voice_sample_path: Path | None = None,
        speed: float = 1.0,
        pitch: int = 0,
    ) -> TTSResult:
        import asyncio
        import soundfile as sf
        import torchaudio
        import torch
        import numpy as np

        self._load()
        output_path.parent.mkdir(parents=True, exist_ok=True)

        loop = asyncio.get_event_loop()

        def _infer():
            if voice_sample_path and voice_sample_path.exists():
                # 語音複製模式（zero-shot）
                prompt_speech, sr = torchaudio.load(str(voice_sample_path))
                output = next(
                    self._model.inference_zero_shot(
                        text, "參考音訊", prompt_speech, speed=speed
                    )
                )
            else:
                # 使用預設聲音
                output = next(
                    self._model.inference_sft(text, "中文女", speed=speed)
                )
            return output["tts_speech"], self._model.sample_rate

        wav, sample_rate = await loop.run_in_executor(None, _infer)

        torchaudio.save(str(output_path), wav, sample_rate)

        info = sf.info(str(output_path))
        return TTSResult(
            audio_path=output_path,
            duration=info.duration,
            sample_rate=sample_rate,
        )

    async def health_check(self) -> bool:
        try:
            from cosyvoice.cli.cosyvoice import CosyVoice2  # noqa: F401
            return True
        except ImportError:
            return False
