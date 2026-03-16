"""
Qwen3-TTS 本地模型引擎
需要 GPU（NVIDIA CUDA / AMD ROCm / Apple MLX）
模型大小：0.6B 或 1.7B
"""
from pathlib import Path

from engines.base import BaseTTSEngine, TTSResult


class Qwen3LocalEngine(BaseTTSEngine):
    """
    Qwen3-TTS 本地推理引擎
    完全離線，高隱私保護
    首次使用時自動下載模型（~1~3GB）
    """

    MODEL_ID = "Qwen/Qwen3-TTS-0.6B"  # 或 Qwen/Qwen3-TTS-1.7B

    def __init__(self):
        self._pipeline = None  # 延遲載入，避免啟動時間過長

    @property
    def name(self) -> str:
        return "qwen3_local"

    def _load(self):
        if self._pipeline is not None:
            return
        try:
            from transformers import pipeline
            self._pipeline = pipeline(
                "text-to-speech",
                model=self.MODEL_ID,
                device_map="auto",
            )
        except Exception as e:
            raise RuntimeError(f"Qwen3-TTS 本地模型載入失敗：{e}") from e

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

        self._load()
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # 在執行緒池中執行 CPU/GPU 密集推理，避免阻塞 event loop
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: self._pipeline(text, forward_params={"speaker_wav": str(voice_sample_path)} if voice_sample_path else {}),
        )

        audio_data = result["audio"]
        sample_rate = result["sampling_rate"]

        sf.write(str(output_path), audio_data, sample_rate)

        info = sf.info(str(output_path))
        return TTSResult(audio_path=output_path, duration=info.duration, sample_rate=sample_rate)

    async def health_check(self) -> bool:
        try:
            import torch
            return torch.cuda.is_available() or True  # CPU fallback
        except ImportError:
            return False
