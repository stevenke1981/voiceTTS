import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Loader2,
  Download,
  Play,
  RotateCcw,
  Clock,
  AlignLeft,
} from "lucide-react";
import { apiClient, type TTSRequest } from "@/lib/apiClient";
import { useAppStore } from "@/stores/appStore";
import { useTTSJob } from "@/hooks/useTTSJob";
import WaveformPlayer from "@/components/WaveformPlayer";
import clsx from "clsx";

const ENGINES: { value: TTSRequest["engine"]; label: string; badge: string; desc: string }[] = [
  { value: "qwen3_cloud", label: "Qwen3-TTS", badge: "雲端", desc: "97ms 首音節延遲" },
  { value: "qwen3_local", label: "Qwen3-TTS", badge: "本地", desc: "完全離線，需 GPU" },
  { value: "chatterbox", label: "Chatterbox", badge: "本地", desc: "MIT · 英文最佳" },
  { value: "cosyvoice", label: "CosyVoice2", badge: "本地", desc: "中文語調最自然" },
];

export default function TTSPage() {
  const { selectedVoiceProfileId, defaultEngine } = useAppStore();
  const [text, setText] = useState("");
  const [engine, setEngine] = useState<TTSRequest["engine"]>(defaultEngine);
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    selectedVoiceProfileId
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ["voice-profiles"],
    queryFn: () => apiClient.clone.listProfiles(),
  });

  const { mutate: generate, isPending: isSubmitting } = useMutation({
    mutationFn: (req: TTSRequest) => apiClient.tts.generate(req),
    onSuccess: (job) => setCurrentJobId(job.job_id),
  });

  const { data: job } = useTTSJob(currentJobId);

  const isProcessing =
    isSubmitting || (job && (job.status === "queued" || job.status === "processing"));

  const handleGenerate = () => {
    if (!text.trim() || isProcessing) return;
    setCurrentJobId(null);
    generate({
      text: text.trim(),
      engine,
      voice_profile_id: selectedProfileId ?? undefined,
      speed,
      pitch,
    });
  };

  const charCount = text.length;
  const estimatedSecs = Math.ceil(charCount / 5);

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-surface-100">文字轉語音</h1>
        <p className="text-sm text-surface-500 mt-0.5">
          輸入文字，選擇聲音，一鍵生成高品質語音
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* ── 左側主區域 ── */}
        <div className="col-span-2 space-y-4">
          {/* 文字輸入 */}
          <div className="card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="label flex items-center gap-1.5">
                <AlignLeft size={12} />
                輸入文字
              </label>
              <div className="flex items-center gap-3 text-xs text-surface-500">
                <span>{charCount} 字</span>
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  約 {estimatedSecs}s
                </span>
              </div>
            </div>
            <textarea
              className="input min-h-[180px] resize-y"
              placeholder="在此輸入要轉換的文字...&#10;&#10;支援長文自動分段合成。"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          {/* 生成按鈕 */}
          <button
            className="btn-primary w-full py-3 text-sm font-semibold"
            onClick={handleGenerate}
            disabled={!!isProcessing || !text.trim()}
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {job?.status === "queued" ? "排隊中..." : "生成中..."}
              </>
            ) : (
              <>
                <Sparkles size={16} />
                生成語音
              </>
            )}
          </button>

          {/* 進度 + 結果 */}
          {job && (
            <div className="card p-4 space-y-3 animate-slide-up">
              <div className="flex items-center justify-between">
                <span className="label">生成結果</span>
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      "badge",
                      job.status === "done"
                        ? "badge-success"
                        : job.status === "error"
                          ? "badge-error"
                          : "badge-warning"
                    )}
                  >
                    {job.status === "done"
                      ? "完成"
                      : job.status === "error"
                        ? "失敗"
                        : job.status === "queued"
                          ? "排隊中"
                          : "處理中"}
                  </span>
                  {(job.status === "queued" || job.status === "processing") && (
                    <Loader2 size={14} className="animate-spin text-surface-400" />
                  )}
                </div>
              </div>

              {/* 處理中動畫 */}
              {(job.status === "queued" || job.status === "processing") && (
                <div className="space-y-2">
                  <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full animate-[shimmer_1.5s_ease-in-out_infinite] w-1/3" />
                  </div>
                  <p className="text-xs text-surface-500">正在合成語音，請稍候...</p>
                </div>
              )}

              {/* 完成：波形播放器 + 下載 */}
              {job.status === "done" && job.audio_url && (
                <div className="space-y-3">
                  <WaveformPlayer url={job.audio_url} />
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={job.audio_url}
                      download="voicetts_output.wav"
                      className="btn-ghost text-xs justify-center"
                    >
                      <Download size={13} />
                      下載 WAV
                    </a>
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => {
                        setText("");
                        setCurrentJobId(null);
                      }}
                    >
                      <RotateCcw size={13} />
                      重新輸入
                    </button>
                  </div>
                </div>
              )}

              {/* 錯誤 */}
              {job.status === "error" && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-xs text-red-400">{job.error ?? "生成失敗，請重試"}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 右側設定欄 ── */}
        <div className="space-y-4">
          {/* 引擎 */}
          <div className="card p-4 space-y-2">
            <label className="label">TTS 引擎</label>
            {ENGINES.map((e) => (
              <label
                key={e.value}
                className={clsx(
                  "flex items-center gap-2.5 rounded-lg p-2.5 cursor-pointer transition-colors",
                  engine === e.value
                    ? "bg-accent/15 border border-accent/30"
                    : "hover:bg-surface-800 border border-transparent"
                )}
              >
                <input
                  type="radio"
                  name="engine"
                  className="sr-only"
                  value={e.value}
                  checked={engine === e.value}
                  onChange={() => setEngine(e.value)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-100">{e.label}</p>
                  <p className="text-[10px] text-surface-500 mt-0.5">{e.desc}</p>
                </div>
                <span className="badge badge-accent text-[10px] shrink-0">{e.badge}</span>
              </label>
            ))}
          </div>

          {/* 聲音輪廓 */}
          <div className="card p-4 space-y-2">
            <label className="label">聲音輪廓</label>
            {/* 預設聲音選項 */}
            <label
              className={clsx(
                "flex items-center gap-2.5 rounded-lg p-2 cursor-pointer transition-colors",
                selectedProfileId === null
                  ? "bg-accent/15 border border-accent/30"
                  : "hover:bg-surface-800 border border-transparent"
              )}
            >
              <input
                type="radio"
                name="profile"
                className="sr-only"
                checked={selectedProfileId === null}
                onChange={() => setSelectedProfileId(null)}
              />
              <div className="w-6 h-6 rounded-full bg-surface-700 flex items-center justify-center text-[10px] text-surface-400 shrink-0">
                預
              </div>
              <span className="text-sm text-surface-200">預設聲音</span>
            </label>

            {profiles.length === 0 ? (
              <p className="text-[11px] text-surface-600 text-center py-2">
                前往「語音複製」建立聲音
              </p>
            ) : (
              profiles.map((p) => (
                <label
                  key={p.id}
                  className={clsx(
                    "flex items-center gap-2.5 rounded-lg p-2 cursor-pointer transition-colors",
                    selectedProfileId === p.id
                      ? "bg-accent/15 border border-accent/30"
                      : "hover:bg-surface-800 border border-transparent"
                  )}
                >
                  <input
                    type="radio"
                    name="profile"
                    className="sr-only"
                    checked={selectedProfileId === p.id}
                    onChange={() => setSelectedProfileId(p.id)}
                  />
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px] text-accent-light shrink-0">
                    {p.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-200 truncate">{p.name}</p>
                    <p className="text-[10px] text-surface-500">{p.language}</p>
                  </div>
                  <button
                    className="text-surface-600 hover:text-accent-light transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      if (p.audio_preview_url) {
                        new Audio(p.audio_preview_url).play();
                      }
                    }}
                  >
                    <Play size={11} />
                  </button>
                </label>
              ))
            )}
          </div>

          {/* 參數 */}
          <div className="card p-4 space-y-4">
            <label className="label">參數調整</label>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-surface-400">
                <span>語速</span>
                <span className="tabular-nums">{speed.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min={0.5} max={2.0} step={0.1}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full accent-accent h-1.5 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-surface-600">
                <span>0.5×</span><span>2.0×</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-surface-400">
                <span>音調</span>
                <span className="tabular-nums">
                  {pitch > 0 ? `+${pitch}` : pitch} 半音
                </span>
              </div>
              <input
                type="range"
                min={-12} max={12} step={1}
                value={pitch}
                onChange={(e) => setPitch(Number(e.target.value))}
                className="w-full accent-accent h-1.5 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-surface-600">
                <span>-12</span><span>+12</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
