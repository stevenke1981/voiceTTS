"""
Whisper 語音轉文字服務
用途：將聲音樣本轉錄成文字，供語音複製品質確認使用
"""
from pathlib import Path


class WhisperTranscriber:
    """
    使用 OpenAI Whisper 進行語音轉文字
    支援本地模型（tiny / base / small / medium / large）
    """

    def __init__(self, model_size: str = "base"):
        self._model_size = model_size
        self._model = None

    def _load(self):
        if self._model is not None:
            return
        try:
            import whisper
            self._model = whisper.load_model(self._model_size)
        except ImportError as e:
            raise RuntimeError(
                "openai-whisper 未安裝。請執行：pip install openai-whisper"
            ) from e

    async def transcribe(self, audio_path: Path, language: str = "zh") -> dict:
        """
        轉錄音訊檔案

        Returns:
            {
              "text": str,          # 完整轉錄文字
              "language": str,      # 偵測到的語言
              "segments": [...]     # 每段時間戳記
            }
        """
        import asyncio

        self._load()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: self._model.transcribe(
                str(audio_path),
                language=language if language != "auto" else None,
                fp16=False,
            ),
        )

        return {
            "text": result["text"].strip(),
            "language": result.get("language", language),
            "segments": [
                {
                    "start": s["start"],
                    "end": s["end"],
                    "text": s["text"].strip(),
                }
                for s in result.get("segments", [])
            ],
        }


# 全域單例（延遲初始化）
_transcriber: WhisperTranscriber | None = None


def get_transcriber() -> WhisperTranscriber:
    global _transcriber
    if _transcriber is None:
        import os
        size = os.getenv("WHISPER_MODEL_SIZE", "base")
        _transcriber = WhisperTranscriber(model_size=size)
    return _transcriber
