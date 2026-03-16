"""
長文分段模組
將超長文字切成適合 TTS 的段落，支援中英文標點斷句
"""
import re

# 斷句優先序：句號 > 問號/驚嘆號 > 逗號 > 空白
_SENTENCE_END = re.compile(r"([。！？.!?])")
_SOFT_BREAK = re.compile(r"([，、；,;])")


def chunk_text(
    text: str,
    max_chars: int = 200,
) -> list[str]:
    """
    將文字切成不超過 max_chars 的段落

    優先在句末（。！？）斷切，其次在逗號，最後強制切割。

    Args:
        text: 原始文字
        max_chars: 每段最大字數

    Returns:
        段落列表，保留原始文字內容
    """
    text = text.strip()
    if not text:
        return []

    if len(text) <= max_chars:
        return [text]

    chunks: list[str] = []
    remaining = text

    while remaining:
        if len(remaining) <= max_chars:
            chunks.append(remaining)
            break

        candidate = remaining[:max_chars]

        # 嘗試在句末斷切
        match = None
        for m in _SENTENCE_END.finditer(candidate):
            match = m
        if match and match.end() > max_chars * 0.3:
            cut = match.end()
            chunks.append(remaining[:cut].strip())
            remaining = remaining[cut:].strip()
            continue

        # 嘗試在逗號斷切
        match = None
        for m in _SOFT_BREAK.finditer(candidate):
            match = m
        if match and match.end() > max_chars * 0.3:
            cut = match.end()
            chunks.append(remaining[:cut].strip())
            remaining = remaining[cut:].strip()
            continue

        # 強制切割
        chunks.append(candidate.strip())
        remaining = remaining[max_chars:].strip()

    return [c for c in chunks if c]


def estimate_duration(text: str, chars_per_second: float = 5.0) -> float:
    """粗估文字轉語音時長（秒）"""
    return len(text.strip()) / chars_per_second
