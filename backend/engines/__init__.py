from engines.base import BaseTTSEngine, TTSResult
from engines.qwen3_cloud import Qwen3CloudEngine
from engines.qwen3_local import Qwen3LocalEngine
from engines.chatterbox import ChatterboxEngine
from engines.cosyvoice import CosyVoice2Engine

ENGINE_REGISTRY: dict[str, type[BaseTTSEngine]] = {
    "qwen3_cloud": Qwen3CloudEngine,
    "qwen3_local": Qwen3LocalEngine,
    "chatterbox": ChatterboxEngine,
    "cosyvoice": CosyVoice2Engine,
}


def get_engine(engine_name: str) -> BaseTTSEngine:
    """根據名稱取得 TTS 引擎實例"""
    cls = ENGINE_REGISTRY.get(engine_name)
    if cls is None:
        raise ValueError(
            f"未知引擎：{engine_name}。可用引擎：{list(ENGINE_REGISTRY)}"
        )
    return cls()


async def health_check_all() -> dict[str, bool]:
    """回傳所有引擎的健康狀態"""
    results: dict[str, bool] = {}
    for name, cls in ENGINE_REGISTRY.items():
        try:
            engine = cls()
            results[name] = await engine.health_check()
        except Exception:
            results[name] = False
    return results
