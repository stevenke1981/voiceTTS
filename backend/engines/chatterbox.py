"""
Chatterbox TTS 引擎（本地）
MIT 授權，英文語音品質最佳
模型：resemble-ai/chatterbox
"""
from pathlib import Path

from engines.base import BaseTTSEngine, TTSResult


class ChatterboxEngine(BaseTTSEngine):
    """
    Chatterbox 本地 TTS 引擎
    優點：MIT 授權、生成速度快、英文自然度高
    限制：英文主導，中文支援有限
    """

    def __init__(self):
        self._model = None

    @property
    def name(self) -> str:
        return "chatterbox"

    def _load(self):
        if self._model is not None:
            return
        try:
            import torch
            from chatterbox.tts import ChatterboxTTS

            device = "cuda" if torch.cuda.is_available() else "cpu"
            self._model = ChatterboxTTS.from_pretrained(device=device)
        except ImportError as e:
            raise RuntimeError(
                "Chatterbox 未安裝。請執行：pip install chatterbox-tts"
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

        self._load()
        output_path.parent.mkdir(parents=True, exist_ok=True)

        loop = asyncio.get_event_loop()

        def _infer():
            kwargs: dict = {"text": text, "exaggeration": 0.5, "cfg_weight": 0.5}
            if voice_sample_path and voice_sample_path.exists():
                kwargs["audio_prompt_path"] = str(voice_sample_path)
            return self._model.generate(**kwargs)

        wav = await loop.run_in_executor(None, _infer)

        torchaudio.save(str(output_path), wav, self._model.sr)

        info = sf.info(str(output_path))
        return TTSResult(
            audio_path=output_path,
            duration=info.duration,
            sample_rate=self._model.sr,
        )

    async def health_check(self) -> bool:
        try:
            import chatterbox  # noqa: F401
            return True
        except ImportError:
            return False
