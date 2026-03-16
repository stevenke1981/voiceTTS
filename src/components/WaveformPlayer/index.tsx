import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, Volume2 } from "lucide-react";
import clsx from "clsx";

interface WaveformPlayerProps {
  url: string;
  height?: number;
}

export default function WaveformPlayer({ url, height = 60 }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#4a4040",
      progressColor: "#7c6ff7",
      cursorColor: "#a99bf9",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height,
      normalize: true,
      interact: true,
    });

    wsRef.current = ws;
    ws.load(url);

    ws.on("ready", () => {
      setIsReady(true);
      setDuration(ws.getDuration());
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));
    ws.on("timeupdate", (t) => setCurrentTime(t));

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, [url, height]);

  const togglePlay = () => {
    wsRef.current?.playPause();
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    wsRef.current?.setVolume(v);
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-2">
      {/* 波形 */}
      <div
        ref={containerRef}
        className={clsx(
          "rounded-lg overflow-hidden bg-surface-800 px-2 transition-opacity",
          !isReady && "opacity-50"
        )}
      />

      {/* 控制列 */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={!isReady}
          className="w-8 h-8 rounded-full bg-accent flex items-center justify-center hover:bg-accent-dark transition-colors disabled:opacity-40"
        >
          {isPlaying ? (
            <Pause size={14} className="text-white" />
          ) : (
            <Play size={14} className="text-white ml-0.5" />
          )}
        </button>

        {/* 時間 */}
        <span className="text-xs tabular-nums text-surface-500 w-20">
          {fmt(currentTime)} / {fmt(duration)}
        </span>

        {/* 音量 */}
        <div className="flex items-center gap-1.5 ml-auto">
          <Volume2 size={12} className="text-surface-500" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="w-16 accent-accent h-1 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
