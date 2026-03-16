from fastapi import APIRouter
from engines import health_check_all

router = APIRouter()


@router.get("/status")
async def engines_status():
    """回傳所有 TTS 引擎的可用狀態"""
    status = await health_check_all()
    return {
        "engines": [
            {
                "id": name,
                "available": ok,
                "label": {
                    "qwen3_cloud": "Qwen3-TTS（雲端）",
                    "qwen3_local": "Qwen3-TTS（本地）",
                    "chatterbox": "Chatterbox",
                    "cosyvoice": "CosyVoice2",
                }.get(name, name),
            }
            for name, ok in status.items()
        ]
    }
