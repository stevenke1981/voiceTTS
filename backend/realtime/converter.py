"""
即時語音轉換核心模組
策略：VAD 端點偵測 → 切段 → CosyVoice2 / RVC 轉換 → 串流回傳

設計目標：
  - 延遲 < 300ms（實務上受模型推理速度限制）
  - 支援可插拔的轉換後端
"""
import asyncio
import io
import numpy as np
from pathlib import Path


SAMPLE_RATE = 16000        # 輸入取樣率
CHUNK_SIZE = 4096          # 每次輸入的 frame 數（256ms at 16kHz）
VAD_SILENCE_MS = 500       # 靜音超過此時間視為句子結束
VAD_THRESHOLD = 0.01       # 音量閾值（0~1）


class RealtimeConverter:
    """
    即時聲音轉換器

    使用方式（WebSocket handler）：
        converter = RealtimeConverter(profile)
        async for out_chunk in converter.stream(in_bytes):
            await ws.send_bytes(out_chunk)
    """

    def __init__(self, profile_audio_path: Path, engine_name: str = "cosyvoice"):
        self._profile_path = profile_audio_path
        self._engine_name = engine_name
        self._buffer = np.array([], dtype=np.float32)
        self._silence_frames = 0
        self._engine = None

    def _load_engine(self):
        if self._engine is not None:
            return
        from engines import get_engine
        self._engine = get_engine(self._engine_name)

    def _is_silent(self, audio: np.ndarray) -> bool:
        rms = float(np.sqrt(np.mean(audio ** 2)))
        return rms < VAD_THRESHOLD

    async def _convert_segment(self, segment: np.ndarray) -> bytes:
        """將一段 PCM 音訊轉換成目標聲音，回傳 WAV bytes"""
        import tempfile, soundfile as sf

        self._load_engine()

        # 寫入暫存 WAV
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_in:
            sf.write(tmp_in.name, segment, SAMPLE_RATE)
            in_path = Path(tmp_in.name)

        out_path = in_path.with_suffix(".out.wav")
        try:
            result = await self._engine.synthesize(
                text="",            # 即時模式不需要文字
                output_path=out_path,
                voice_sample_path=self._profile_path,
            )
            return result.audio_path.read_bytes()
        finally:
            in_path.unlink(missing_ok=True)
            out_path.unlink(missing_ok=True)

    async def process_chunk(self, raw_bytes: bytes) -> bytes | None:
        """
        輸入一段 PCM bytes（Int16），回傳轉換後的 WAV bytes 或 None（等待更多資料）

        使用簡單 VAD：靜音超過 500ms 後觸發轉換
        """
        # Int16 → float32 正規化
        pcm = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        self._buffer = np.concatenate([self._buffer, pcm])

        if self._is_silent(pcm):
            self._silence_frames += len(pcm)
        else:
            self._silence_frames = 0

        silence_samples = int(SAMPLE_RATE * VAD_SILENCE_MS / 1000)

        # 音訊緩衝夠長 + 偵測到靜音段落 → 觸發轉換
        if self._silence_frames >= silence_samples and len(self._buffer) > SAMPLE_RATE * 0.3:
            segment = self._buffer[: -self._silence_frames]
            self._buffer = self._buffer[-self._silence_frames:]
            self._silence_frames = 0

            if len(segment) > 0:
                return await self._convert_segment(segment)

        return None
