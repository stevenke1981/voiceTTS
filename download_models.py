"""
VoiceTTS — 本地模型下載工具

支援模型：
  1. Qwen3-TTS-0.6B   (Qwen/Qwen3-TTS-0.6B,   ~1.2 GB)
  2. Qwen3-TTS-1.7B   (Qwen/Qwen3-TTS-1.7B,   ~3.4 GB)
  3. Chatterbox TTS   (resemble-ai/chatterbox, ~1.0 GB)
  4. CosyVoice2-0.5B  (FunAudioLLM/CosyVoice2-0.5B, ~1.0 GB)

用法：
  python download_models.py            # 互動式選單
  python download_models.py --all      # 下載全部
  python download_models.py --qwen-small --chatterbox
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

# ── 顏色輔助（不依賴第三方）──
def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if sys.stdout.isatty() else text

OK    = lambda t: _c("32", f"[OK]  {t}")
INFO  = lambda t: _c("36", f"[>>]  {t}")
WARN  = lambda t: _c("33", f"[!!]  {t}")
ERR   = lambda t: _c("31", f"[XX]  {t}")
HEAD  = lambda t: _c("1;35", t)

HF_CACHE = Path.home() / ".cache" / "huggingface" / "hub"

MODELS: dict[str, dict] = {
    "qwen_small": {
        "label": "Qwen3-TTS-0.6B（輕量，推薦）",
        "repo_id": "Qwen/Qwen3-TTS-0.6B",
        "size": "~1.2 GB",
        "pip": [],
        "kind": "hf",
    },
    "qwen_large": {
        "label": "Qwen3-TTS-1.7B（高品質）",
        "repo_id": "Qwen/Qwen3-TTS-1.7B",
        "size": "~3.4 GB",
        "pip": [],
        "kind": "hf",
    },
    "chatterbox": {
        "label": "Chatterbox TTS（英文最佳，MIT 授權）",
        "repo_id": "resemble-ai/chatterbox",
        "size": "~1.0 GB",
        "pip": ["chatterbox-tts"],
        "kind": "hf",
    },
    "cosyvoice": {
        "label": "CosyVoice2-0.5B（中文最自然）",
        "repo_id": "FunAudioLLM/CosyVoice2-0.5B",
        "size": "~1.0 GB",
        "pip": [],
        "kind": "cosyvoice",   # 需要特殊安裝步驟
    },
}


# ─────────────────────────────────────────────
#  pip 安裝輔助
# ─────────────────────────────────────────────

def pip_install(packages: list[str]) -> bool:
    if not packages:
        return True
    print(INFO(f"安裝 pip 套件：{' '.join(packages)}"))
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", *packages],
        check=False,
    )
    return result.returncode == 0


def ensure_hf_hub() -> bool:
    """確保 huggingface_hub 可用"""
    try:
        import huggingface_hub  # noqa: F401
        return True
    except ImportError:
        return pip_install(["huggingface_hub"])


# ─────────────────────────────────────────────
#  HuggingFace 下載
# ─────────────────────────────────────────────

def hf_download(repo_id: str, label: str) -> bool:
    if not ensure_hf_hub():
        print(ERR("無法安裝 huggingface_hub，跳過"))
        return False

    from huggingface_hub import snapshot_download, HfApi
    from huggingface_hub.utils import HfHubHTTPError

    cache_dir = HF_CACHE / ("models--" + repo_id.replace("/", "--"))
    if cache_dir.exists():
        print(OK(f"{label} 已快取於 {cache_dir}"))
        return True

    print(INFO(f"下載 {repo_id}（{label}）…"))
    print(INFO("（可使用 HF_ENDPOINT 環境變數指定鏡像，例如 hf-mirror.com）"))

    try:
        path = snapshot_download(
            repo_id=repo_id,
            ignore_patterns=["*.msgpack", "flax_model*", "tf_model*", "rust_model*"],
        )
        print(OK(f"下載完成 → {path}"))
        return True
    except HfHubHTTPError as e:
        print(ERR(f"HuggingFace 下載失敗：{e}"))
        print(WARN("提示：設定環境變數 HF_ENDPOINT=https://hf-mirror.com 使用中國鏡像"))
        return False
    except Exception as e:
        print(ERR(f"下載失敗：{e}"))
        return False


# ─────────────────────────────────────────────
#  CosyVoice2 特殊安裝
# ─────────────────────────────────────────────

def _site_packages() -> Path:
    """回傳目前 Python 的 site-packages 路徑"""
    import site
    dirs = site.getsitepackages()
    return Path(dirs[0])


def install_cosyvoice() -> bool:
    """
    CosyVoice2 不在 PyPI，也沒有 setup.py / pyproject.toml。
    安裝方式：
      1. git clone 到 backend/vendor/CosyVoice
      2. 在 site-packages 放 cosyvoice.pth，讓 Python 找到套件
      3. 安裝依賴（grpcio 等需要 --prefer-binary 跳過原始碼編譯）
      4. 下載 HuggingFace 模型權重
    """
    install_dir = Path("backend") / "vendor" / "CosyVoice"

    # 1. 檢查是否已可導入
    try:
        from cosyvoice.cli.cosyvoice import CosyVoice2  # noqa: F401
        print(OK("CosyVoice2 Python 套件已安裝"))
    except ImportError:
        print(INFO("CosyVoice2 需要從 GitHub 安裝…"))

        # 確認 git 可用
        if subprocess.run(["git", "--version"], capture_output=True).returncode != 0:
            print(ERR("找不到 git，請先安裝 Git for Windows"))
            print(WARN("手動安裝說明：https://github.com/FunAudioLLM/CosyVoice#install"))
            return False

        # 2. Clone（若尚未 clone）
        if not (install_dir / ".git").exists():
            print(INFO(f"複製 CosyVoice 到 {install_dir} …"))
            r = subprocess.run([
                "git", "clone", "--depth", "1", "--recurse-submodules",
                "https://github.com/FunAudioLLM/CosyVoice.git",
                str(install_dir),
            ])
            if r.returncode != 0:
                print(ERR("git clone 失敗"))
                return False
        else:
            print(OK(f"CosyVoice 原始碼已存在：{install_dir}"))

        # 3. 加入 .pth 讓 Python 找到 cosyvoice 套件
        #    （CosyVoice 無 setup.py/pyproject.toml，用 .pth 代替 pip install -e）
        pth_file = _site_packages() / "cosyvoice.pth"
        abs_dir = install_dir.resolve()
        pth_content = f"{abs_dir}\n{abs_dir / 'third_party' / 'Matcha-TTS'}\n"
        pth_file.write_text(pth_content, encoding="utf-8")
        print(OK(f"已寫入 {pth_file}"))

        # 4. 安裝 CosyVoice 最小必要依賴
        #
        #    不使用 requirements.txt，原因：
        #      - 版本限制（matplotlib==3.7.5、numpy==1.26.4 等）在 Python 3.13 無
        #        預編譯 wheel 且原始碼編譯失敗
        #      - torch/torchaudio/transformers/librosa/soundfile 主專案已安裝
        #      - deepspeed / tensorrt* / onnxruntime-gpu 僅 Linux 使用
        #      - fastapi/uvicorn/pydantic 主專案已有相容版本
        #
        #    只安裝 CosyVoice 獨有且尚未安裝的套件，全部使用 --prefer-binary
        COSYVOICE_DEPS = [
            "conformer",
            "diffusers",
            "hydra-core",
            "HyperPyYAML",
            "inflect",
            "omegaconf",
            "onnxruntime",
            "protobuf",
            "x-transformers",
            "WeTextProcessing",
            "modelscope",
            "pybind11",
        ]
        print(INFO("安裝 CosyVoice 最小依賴（--prefer-binary）…"))
        subprocess.run([
            sys.executable, "-m", "pip", "install",
            "--prefer-binary",
            *COSYVOICE_DEPS,
        ])

    # 5. 下載模型權重
    return hf_download("FunAudioLLM/CosyVoice2-0.5B", "CosyVoice2-0.5B")


# ─────────────────────────────────────────────
#  各模型安裝入口
# ─────────────────────────────────────────────

def install_model(key: str) -> bool:
    m = MODELS[key]
    print()
    print(HEAD(f"══ {m['label']} ({m['size']}) ══"))

    # pip 套件
    if m["pip"] and not pip_install(m["pip"]):
        print(ERR(f"pip 安裝失敗：{m['pip']}"))
        return False

    # 特殊安裝邏輯
    if m["kind"] == "cosyvoice":
        return install_cosyvoice()

    # 標準 HuggingFace 下載
    return hf_download(m["repo_id"], m["label"])


# ─────────────────────────────────────────────
#  互動式選單
# ─────────────────────────────────────────────

def interactive_menu() -> list[str]:
    print()
    print(HEAD("╔══════════════════════════════════════════╗"))
    print(HEAD("║   VoiceTTS — 本地模型下載工具            ║"))
    print(HEAD("╚══════════════════════════════════════════╝"))
    print()
    print("  請選擇要下載的模型（可多選，以空格分隔）：")
    print()

    keys = list(MODELS.keys())
    for i, key in enumerate(keys, 1):
        m = MODELS[key]
        print(f"  [{i}] {m['label']}")
        print(f"       大小：{m['size']}   repo：{m['repo_id']}")
        print()

    print(f"  [A] 全部下載")
    print(f"  [Q] 離開")
    print()

    raw = input("請輸入選項（例如 1 3 或 A）：").strip().lower()
    if raw == "q":
        return []
    if raw == "a":
        return keys

    selected = []
    for token in raw.split():
        if token.isdigit():
            idx = int(token) - 1
            if 0 <= idx < len(keys):
                selected.append(keys[idx])
            else:
                print(WARN(f"無效選項：{token}"))
    return selected


# ─────────────────────────────────────────────
#  主程式
# ─────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="VoiceTTS 本地模型下載工具")
    parser.add_argument("--all", action="store_true", help="下載所有模型")
    parser.add_argument("--qwen-small", action="store_true", help="Qwen3-TTS-0.6B")
    parser.add_argument("--qwen-large", action="store_true", help="Qwen3-TTS-1.7B")
    parser.add_argument("--chatterbox", action="store_true", help="Chatterbox TTS")
    parser.add_argument("--cosyvoice", action="store_true", help="CosyVoice2-0.5B")
    parser.add_argument(
        "--hf-mirror",
        metavar="URL",
        help="HuggingFace 鏡像（例如 https://hf-mirror.com）",
    )
    args = parser.parse_args()

    # 設定 HF 鏡像
    if args.hf_mirror:
        import os
        os.environ["HF_ENDPOINT"] = args.hf_mirror
        print(INFO(f"HF 鏡像：{args.hf_mirror}"))

    # 決定下載哪些模型
    if args.all:
        to_download = list(MODELS.keys())
    elif any([args.qwen_small, args.qwen_large, args.chatterbox, args.cosyvoice]):
        to_download = []
        if args.qwen_small:  to_download.append("qwen_small")
        if args.qwen_large:  to_download.append("qwen_large")
        if args.chatterbox:  to_download.append("chatterbox")
        if args.cosyvoice:   to_download.append("cosyvoice")
    else:
        to_download = interactive_menu()

    if not to_download:
        print(INFO("未選擇任何模型，結束。"))
        return 0

    # 執行下載
    results: dict[str, bool] = {}
    for key in to_download:
        results[key] = install_model(key)

    # 結果摘要
    print()
    print(HEAD("══ 安裝結果 ══"))
    all_ok = True
    for key, ok in results.items():
        label = MODELS[key]["label"]
        if ok:
            print(OK(label))
        else:
            print(ERR(label))
            all_ok = False

    if not all_ok:
        print()
        print(WARN("部分模型安裝失敗，請查閱上方錯誤訊息。"))
        print(WARN("網路問題可使用 --hf-mirror https://hf-mirror.com 指定鏡像。"))
        return 1

    print()
    print(OK("所有模型安裝完成！"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
