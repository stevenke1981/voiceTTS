"""
openai-whisper installer for Python 3.13+

setup.py has two bugs with Python 3.13:
  1. exec(compile(...)); locals()["__version__"] -- exec no longer updates
     the caller's locals() in Python 3.13, causing KeyError: '__version__'
  2. import pkg_resources -- not bundled with setuptools >= 75

Workaround: download the sdist, patch setup.py, install from local source.
"""
import io
import os
import pathlib
import subprocess
import sys
import tarfile
import tempfile
import urllib.request

WHISPER_URL = (
    "https://files.pythonhosted.org/packages/"
    "f5/77/952ca71515f81919bd8a6a4a3f89a27b09e73880cebf90957eda8f2f8545/"
    "openai-whisper-20240930.tar.gz"
)
ALIYUN_URL = (
    "https://mirrors.aliyun.com/pypi/packages/"
    "f5/77/952ca71515f81919bd8a6a4a3f89a27b09e73880cebf90957eda8f2f8545/"
    "openai-whisper-20240930.tar.gz"
)

PATCHED_SETUP = """\
import platform
import sys
from pathlib import Path

import pkg_resources
from setuptools import find_packages, setup


def read_version(fname="whisper/version.py"):
    # Python 3.13: exec() no longer writes back to caller's locals()
    # Fix: pass an explicit namespace dict
    ns = {}
    exec(compile(open(fname, encoding="utf-8").read(), fname, "exec"), ns)
    return ns["__version__"]


requirements = []
if sys.platform.startswith("linux") and platform.machine() == "x86_64":
    requirements.append("triton>=2.0.0")

setup(
    name="openai-whisper",
    py_modules=["whisper"],
    version=read_version(),
    description="Robust Speech Recognition via Large-Scale Weak Supervision",
    long_description=open("README.md", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    readme="README.md",
    python_requires=">=3.8",
    author="OpenAI",
    url="https://github.com/openai/whisper",
    license="MIT",
    packages=find_packages(exclude=["tests*"]),
    install_requires=[
        str(r)
        for r in pkg_resources.parse_requirements(
            Path(__file__).with_name("requirements.txt").open()
        )
    ],
    entry_points={
        "console_scripts": ["whisper=whisper.transcribe:cli"],
    },
    include_package_data=True,
    extras_require={"dev": ["pytest", "scipy", "black", "flake8", "isort"]},
)
"""


def download(url: str) -> bytes:
    print(f"Downloading {url} ...")
    with urllib.request.urlopen(url, timeout=120) as r:
        return r.read()


def main() -> int:
    # Try PyPI first, fall back to Aliyun mirror
    data = None
    for url in (ALIYUN_URL, WHISPER_URL):
        try:
            data = download(url)
            print(f"Downloaded {len(data):,} bytes")
            break
        except Exception as e:
            print(f"  failed ({e}), trying next mirror...")

    if data is None:
        print("[ERROR] Cannot download openai-whisper tarball from any mirror.")
        return 1

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = pathlib.Path(tmp)

        # Extract tarball
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tf:
            tf.extractall(tmp_path)

        # Find extracted directory
        dirs = [d for d in tmp_path.iterdir() if d.is_dir()]
        if not dirs:
            print("[ERROR] Tarball extraction produced no directory.")
            return 1
        src = dirs[0]

        # Patch setup.py
        setup_py = src / "setup.py"
        setup_py.write_text(PATCHED_SETUP, encoding="utf-8")
        print("Patched setup.py (fixed exec/locals() for Python 3.13)")

        # Install from patched local source
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--no-build-isolation", str(src)],
            cwd=str(src),
        )
        return result.returncode


if __name__ == "__main__":
    sys.exit(main())
