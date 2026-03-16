"""
TTS 引擎抽象基底類別
所有引擎實作都必須繼承此類別
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


@dataclass
class TTSResult:
    audio_path: Path
    duration: float
    sample_rate: int = 24000


class BaseTTSEngine(ABC):
    """TTS 引擎抽象介面"""

    @property
    @abstractmethod
    def name(self) -> str:
        """引擎名稱"""
        ...

    @abstractmethod
    async def synthesize(
        self,
        text: str,
        output_path: Path,
        voice_sample_path: Path | None = None,
        speed: float = 1.0,
        pitch: int = 0,
    ) -> TTSResult:
        """
        將文字合成為語音

        Args:
            text: 要合成的文字
            output_path: 輸出音訊檔案路徑
            voice_sample_path: 聲音樣本路徑（用於語音複製），None 則使用預設聲音
            speed: 語速倍率（0.5 ~ 2.0）
            pitch: 音調調整（半音數，-12 ~ 12）

        Returns:
            TTSResult 包含音訊路徑、時長等資訊
        """
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """確認引擎是否可用"""
        ...
