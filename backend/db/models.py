from datetime import datetime
from sqlalchemy import String, Float, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base


class VoiceProfile(Base):
    """聲音輪廓"""
    __tablename__ = "voice_profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    language: Mapped[str] = mapped_column(String(20), default="zh-TW")
    duration: Mapped[float] = mapped_column(Float, default=0.0)
    audio_path: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TTSJob(Base):
    """TTS 生成任務"""
    __tablename__ = "tts_jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    text: Mapped[str] = mapped_column(Text)
    engine: Mapped[str] = mapped_column(String(50))
    voice_profile_id: Mapped[str | None] = mapped_column(String, ForeignKey("voice_profiles.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="queued")
    audio_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class StoryScript(Base):
    """劇本"""
    __tablename__ = "story_scripts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    lines: Mapped[list["ScriptLine"]] = relationship(
        back_populates="script", cascade="all, delete-orphan", order_by="ScriptLine.order"
    )


class ScriptLine(Base):
    """劇本對白行"""
    __tablename__ = "script_lines"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    script_id: Mapped[str] = mapped_column(String, ForeignKey("story_scripts.id"))
    character_id: Mapped[str] = mapped_column(String(100))
    text: Mapped[str] = mapped_column(Text)
    order: Mapped[int] = mapped_column(Integer, default=0)
    audio_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    duration: Mapped[float | None] = mapped_column(Float, nullable=True)

    script: Mapped["StoryScript"] = relationship(back_populates="lines")
