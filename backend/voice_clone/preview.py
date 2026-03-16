"""
聲音輪廓預覽音訊生成
建立輪廓後自動生成一段測試語音，讓使用者確認複製效果
"""
from pathlib import Path


PREVIEW_TEXTS = {
    "zh": "你好，這是我的聲音複製測試，效果如何呢？",
    "zh-TW": "你好，這是我的聲音複製測試，效果如何呢？",
    "zh-CN": "你好，这是我的声音复制测试，效果如何呢？",
    "en": "Hello, this is my voice clone test. How does it sound?",
    "ja": "こんにちは、これは私の音声クローンテストです。",
    "ko": "안녕하세요, 이것은 제 음성 복제 테스트입니다.",
}


async def generate_preview(
    profile_id: str,
    language: str,
    engine_name: str = "qwen3_cloud",
) -> Path | None:
    """
    為聲音輪廓生成預覽音訊

    使用與主 TTS 相同的引擎 + 聲音樣本，
    生成一段固定文字，存為 storage/profiles/{profile_id}_preview.wav

    Returns:
        預覽音訊路徑，失敗時回傳 None
    """
    from db.database import AsyncSessionLocal
    from db.models import VoiceProfile
    from engines import get_engine

    lang_key = language.split("-")[0]
    text = PREVIEW_TEXTS.get(language) or PREVIEW_TEXTS.get(lang_key) or PREVIEW_TEXTS["en"]

    preview_path = Path(f"storage/profiles/{profile_id}_preview.wav")

    async with AsyncSessionLocal() as db:
        profile = await db.get(VoiceProfile, profile_id)
        if not profile:
            return None

        try:
            engine = get_engine(engine_name)
            voice_sample = Path(profile.audio_path)

            await engine.synthesize(
                text=text,
                output_path=preview_path,
                voice_sample_path=voice_sample if voice_sample.exists() else None,
            )
            return preview_path
        except Exception as e:
            print(f"[Preview] 預覽生成失敗（{profile_id}）：{e}")
            return None
