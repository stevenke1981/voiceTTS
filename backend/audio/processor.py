"""
音訊後處理模組
使用 Spotify Pedalboard 處理音調、語速、效果
"""
from pathlib import Path
import numpy as np
import soundfile as sf
from pedalboard import (
    Pedalboard,
    PitchShift,
    Reverb,
    Compressor,
    HighpassFilter,
    LowpassFilter,
    Delay,
    Gain,
)
from pedalboard.io import AudioFile


def apply_effects(
    input_path: Path,
    output_path: Path,
    *,
    pitch_semitones: int = 0,
    reverb_room: float = 0.0,       # 0.0 ~ 1.0
    reverb_wet: float = 0.0,        # 0.0 ~ 1.0
    compression_db: float = 0.0,    # 0 = off；正值表示壓縮閾值（dBFS，如 -6）
    highpass_hz: float = 0.0,       # 0 = off
    lowpass_hz: float = 0.0,        # 0 = off（20000 = off）
    delay_seconds: float = 0.0,     # 0 = off
    gain_db: float = 0.0,
) -> Path:
    """
    套用音訊後製效果鏈

    Returns:
        output_path
    """
    effects = []

    if pitch_semitones != 0:
        effects.append(PitchShift(semitones=float(pitch_semitones)))

    if reverb_room > 0 and reverb_wet > 0:
        effects.append(
            Reverb(room_size=reverb_room, wet_level=reverb_wet, dry_level=1 - reverb_wet)
        )

    if compression_db < 0:
        effects.append(Compressor(threshold_db=compression_db, ratio=4.0))

    if highpass_hz > 0:
        effects.append(HighpassFilter(cutoff_frequency_hz=highpass_hz))

    if 0 < lowpass_hz < 20000:
        effects.append(LowpassFilter(cutoff_frequency_hz=lowpass_hz))

    if delay_seconds > 0:
        effects.append(Delay(delay_seconds=delay_seconds, mix=0.3))

    if gain_db != 0:
        effects.append(Gain(gain_db=gain_db))

    if not effects:
        # 無效果，直接複製
        import shutil
        shutil.copy2(input_path, output_path)
        return output_path

    board = Pedalboard(effects)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with AudioFile(str(input_path)) as f:
        audio = f.read(f.frames)
        sample_rate = f.samplerate

    processed = board(audio, sample_rate)

    with AudioFile(str(output_path), "w", samplerate=sample_rate, num_channels=processed.shape[0]) as f:
        f.write(processed)

    return output_path


def change_speed(
    input_path: Path,
    output_path: Path,
    speed: float,
) -> Path:
    """
    調整語速（不影響音調）
    使用 librosa 的 time_stretch
    speed > 1 = 加速；speed < 1 = 減速
    """
    if abs(speed - 1.0) < 0.01:
        import shutil
        shutil.copy2(input_path, output_path)
        return output_path

    import librosa

    y, sr = librosa.load(str(input_path), sr=None, mono=False)
    # librosa 只支援 mono，多聲道逐軌處理
    if y.ndim == 1:
        y_stretched = librosa.effects.time_stretch(y, rate=speed)
    else:
        channels = [librosa.effects.time_stretch(y[i], rate=speed) for i in range(y.shape[0])]
        y_stretched = np.stack(channels)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(output_path), y_stretched.T if y_stretched.ndim > 1 else y_stretched, sr)
    return output_path


def crossfade_merge(audio_paths: list[Path], output_path: Path, crossfade_ms: int = 80) -> Path:
    """
    將多段音訊以 Crossfade 方式合併成一個檔案

    Args:
        audio_paths: 要合併的音訊路徑列表（順序即播放順序）
        output_path: 輸出路徑
        crossfade_ms: 每段之間的淡入淡出時長（毫秒）
    """
    if not audio_paths:
        raise ValueError("audio_paths 不可為空")

    if len(audio_paths) == 1:
        import shutil
        shutil.copy2(audio_paths[0], output_path)
        return output_path

    segments: list[tuple[np.ndarray, int]] = []
    for p in audio_paths:
        data, sr = sf.read(str(p), always_2d=True)
        segments.append((data, sr))

    # 統一以第一段的 sample rate 為基準
    target_sr = segments[0][1]
    import librosa
    resampled = []
    for data, sr in segments:
        if sr != target_sr:
            # 重採樣
            data_mono = data.mean(axis=1)
            data_resampled = librosa.resample(data_mono, orig_sr=sr, target_sr=target_sr)
            data = data_resampled[:, np.newaxis]
        resampled.append(data)

    cf_samples = int(target_sr * crossfade_ms / 1000)
    result = resampled[0]

    for seg in resampled[1:]:
        if len(result) < cf_samples or len(seg) < cf_samples:
            result = np.concatenate([result, seg])
            continue

        # 淡出：result 末端
        fade_out = np.linspace(1.0, 0.0, cf_samples)[:, np.newaxis]
        # 淡入：seg 開頭
        fade_in = np.linspace(0.0, 1.0, cf_samples)[:, np.newaxis]

        overlap = result[-cf_samples:] * fade_out + seg[:cf_samples] * fade_in
        result = np.concatenate([result[:-cf_samples], overlap, seg[cf_samples:]])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(output_path), result, target_sr)
    return output_path
