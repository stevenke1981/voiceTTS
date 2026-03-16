import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Mic, Upload, Square, Loader2, CheckCircle,
  Trash2, Play, Cloud, CloudOff, FileText, RefreshCw,
} from "lucide-react";
import { apiClient, type VoiceProfile } from "@/lib/apiClient";
import clsx from "clsx";

type Step = "record" | "preview" | "naming" | "creating" | "done";

const LANGUAGES = [
  { value: "zh-TW", label: "繁體中文" },
  { value: "zh-CN", label: "簡體中文" },
  { value: "en-US", label: "English" },
  { value: "ja-JP", label: "日本語" },
  { value: "ko-KR", label: "한국어" },
];

export default function VoiceClonePage() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("record");
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [language, setLanguage] = useState("zh-TW");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["voice-profiles"],
    queryFn: () => apiClient.clone.listProfiles(),
  });

  const { mutate: createProfile, isPending: isCreating } = useMutation({
    mutationFn: () =>
      apiClient.clone.createProfile(profileName, language, audioBlob!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-profiles"] });
      setStep("done");
      setTimeout(() => {
        setStep("record");
        setProfileName("");
        setAudioBlob(null);
        setAudioUrl(null);
        setRecordSecs(0);
      }, 2500);
    },
  });

  const { mutate: deleteProfile } = useMutation({
    mutationFn: (id: string) => apiClient.clone.deleteProfile(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["voice-profiles"] }),
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      setRecordSecs(0);

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setStep("preview");
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
      };

      recorder.start();
      setIsRecording(true);
      timerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch {
      alert("無法存取麥克風，請確認瀏覽器權限。");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
    setStep("preview");
  };

  const reset = () => {
    setStep("record");
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordSecs(0);
  };

  const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-surface-100">語音複製</h1>
        <p className="text-sm text-surface-500 mt-0.5">
          上傳 3~20 秒清晰音訊，自動建立聲音輪廓並雲端複製
        </p>
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* ── 左側建立流程（2/5） ── */}
        <div className="col-span-2 space-y-4">
          <div className="card p-5">
            {/* 步驟指示器 */}
            <div className="flex items-center gap-1.5 mb-5">
              {[
                { key: "record", label: "錄音" },
                { key: "preview", label: "預覽" },
                { key: "naming", label: "命名" },
              ].map((s, i) => {
                const steps = ["record", "preview", "naming", "creating", "done"];
                const current = steps.indexOf(step);
                const thisIdx = i;
                const done = current > thisIdx;
                const active = current === thisIdx;
                return (
                  <div key={s.key} className="flex items-center gap-1.5 flex-1">
                    <div className={clsx(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors",
                      done ? "bg-green-500 text-white"
                        : active ? "bg-accent text-white"
                          : "bg-surface-700 text-surface-500"
                    )}>
                      {done ? "✓" : i + 1}
                    </div>
                    <span className={clsx("text-xs", active ? "text-surface-200" : "text-surface-600")}>
                      {s.label}
                    </span>
                    {i < 2 && <div className="flex-1 h-px bg-surface-700" />}
                  </div>
                );
              })}
            </div>

            {/* Step 1 — 錄音 / 上傳 */}
            {step === "record" && (
              <div className="space-y-4 text-center">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={clsx(
                    "w-28 h-28 rounded-full mx-auto flex flex-col items-center justify-center gap-1.5 transition-all",
                    isRecording
                      ? "bg-red-500/20 border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)] animate-pulse-slow"
                      : "bg-surface-800 border-2 border-surface-600 hover:border-accent/60"
                  )}
                >
                  {isRecording ? (
                    <>
                      <Square size={26} className="text-red-400" />
                      <span className="text-red-400 text-xs font-mono">{fmtSecs(recordSecs)}</span>
                    </>
                  ) : (
                    <Mic size={30} className="text-surface-300" />
                  )}
                </button>

                <p className="text-sm text-surface-500">
                  {isRecording
                    ? `錄音中 · 點擊停止（建議 5~20 秒）`
                    : "點擊開始錄音"}
                </p>

                {isRecording && recordSecs >= 20 && (
                  <p className="text-xs text-yellow-400">已達 20 秒，建議停止</p>
                )}

                <div className="flex items-center gap-2 my-1">
                  <div className="flex-1 h-px bg-surface-800" />
                  <span className="text-xs text-surface-600">或</span>
                  <div className="flex-1 h-px bg-surface-800" />
                </div>

                <label className="btn-ghost w-full cursor-pointer text-sm">
                  <Upload size={15} />
                  上傳音訊（WAV / MP3 / M4A）
                  <input type="file" accept="audio/*" className="sr-only" onChange={handleFileUpload} />
                </label>
              </div>
            )}

            {/* Step 2 — 預覽 */}
            {step === "preview" && audioUrl && (
              <div className="space-y-4">
                <p className="label text-center">確認音訊品質</p>
                <audio controls src={audioUrl} className="w-full" />
                <p className="text-xs text-surface-500 text-center">
                  請確認聲音清晰、無明顯雜音
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-ghost text-sm" onClick={reset}>重錄</button>
                  <button className="btn-primary text-sm" onClick={() => setStep("naming")}>
                    下一步
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — 命名 */}
            {step === "naming" && (
              <div className="space-y-4">
                <p className="label text-center">命名聲音輪廓</p>
                <div className="space-y-1.5">
                  <label className="text-xs text-surface-400">輪廓名稱</label>
                  <input
                    className="input"
                    placeholder="例：小明的聲音"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && profileName.trim() && createProfile()}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-surface-400">語言</label>
                  <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-ghost text-sm" onClick={() => setStep("preview")}>返回</button>
                  <button
                    className="btn-primary text-sm"
                    disabled={!profileName.trim() || isCreating}
                    onClick={() => createProfile()}
                  >
                    {isCreating ? (
                      <><Loader2 size={14} className="animate-spin" />建立中...</>
                    ) : "建立輪廓"}
                  </button>
                </div>
              </div>
            )}

            {/* Done */}
            {step === "done" && (
              <div className="text-center space-y-3 py-6 animate-fade-in">
                <CheckCircle size={44} className="text-green-400 mx-auto" />
                <p className="font-medium text-surface-100">建立成功！</p>
                <p className="text-xs text-surface-500">正在背景上傳至雲端複製服務...</p>
              </div>
            )}
          </div>

          {/* 說明卡 */}
          <div className="card p-4 space-y-2">
            <p className="label">錄音建議</p>
            <ul className="text-xs text-surface-500 space-y-1.5">
              <li className="flex gap-2"><span className="text-accent-light">•</span>安靜環境，避免背景噪音</li>
              <li className="flex gap-2"><span className="text-accent-light">•</span>自然語速，5~20 秒最佳</li>
              <li className="flex gap-2"><span className="text-accent-light">•</span>麥克風距離嘴巴 15~30 公分</li>
              <li className="flex gap-2"><span className="text-accent-light">•</span>朗讀一段完整句子效果最好</li>
            </ul>
          </div>
        </div>

        {/* ── 右側聲音輪廓庫（3/5） ── */}
        <div className="col-span-3 card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between shrink-0">
            <span className="label">聲音輪廓庫</span>
            <span className="badge badge-accent">{profiles.length} 個</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={22} className="animate-spin text-surface-500" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-10 text-surface-500 text-sm">
              尚無聲音輪廓，從左側建立第一個
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto flex-1">
              {profiles.map((p) => (
                <ProfileCard key={p.id} profile={p} onDelete={() => deleteProfile(p.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileCard({
  profile,
  onDelete,
}: {
  profile: VoiceProfile;
  onDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { mutate: retranscribe, isPending: isRetranscribing } = useMutation({
    mutationFn: () =>
      fetch(
        `http://localhost:8765/api/clone/profiles/${profile.id}/retranscribe?language=${profile.language.split("-")[0]}`,
        { method: "POST" }
      ).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["voice-profiles"] }),
  });

  return (
    <div className="rounded-xl bg-surface-800 hover:bg-surface-750 transition-colors border border-surface-700/50">
      <div className="flex items-center gap-3 p-3">
        {/* 頭像 */}
        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-sm font-semibold text-accent-light shrink-0">
          {profile.name[0]?.toUpperCase()}
        </div>

        {/* 基本資訊 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-surface-100 truncate">{profile.name}</p>
            {/* 雲端狀態 */}
            {profile.cloud_voice_id ? (
              <span title="已同步至雲端複製">
                <Cloud size={12} className="text-green-400 shrink-0" />
              </span>
            ) : (
              <span title="僅本地，尚未同步雲端">
                <CloudOff size={12} className="text-surface-600 shrink-0" />
              </span>
            )}
          </div>
          <p className="text-xs text-surface-500">
            {profile.language} · {profile.duration.toFixed(1)}s · {new Date(profile.created_at).toLocaleDateString("zh-TW")}
          </p>
        </div>

        {/* 操作按鈕 */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="p-1.5 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-100 transition-colors"
            title="展開詳情"
            onClick={() => setExpanded((v) => !v)}
          >
            <FileText size={13} />
          </button>
          {profile.audio_preview_url && (
            <button
              className="p-1.5 rounded hover:bg-surface-700 text-surface-400 hover:text-accent-light transition-colors"
              title="播放樣本"
              onClick={() => new Audio(profile.audio_preview_url!).play()}
            >
              <Play size={13} />
            </button>
          )}
          <button
            className="p-1.5 rounded hover:bg-red-500/20 text-surface-400 hover:text-red-400 transition-colors"
            title="刪除"
            onClick={onDelete}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* 展開：轉錄文字 */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-surface-700/50 pt-2.5 space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs text-surface-500">Whisper 轉錄</span>
            <button
              className="flex items-center gap-1 text-[10px] text-surface-500 hover:text-accent-light"
              onClick={() => retranscribe()}
              disabled={isRetranscribing}
            >
              <RefreshCw size={10} className={clsx(isRetranscribing && "animate-spin")} />
              重新轉錄
            </button>
          </div>
          {profile.transcript ? (
            <p className="text-xs text-surface-300 bg-surface-900 rounded-lg p-2.5 leading-relaxed">
              {profile.transcript}
            </p>
          ) : (
            <p className="text-xs text-surface-600 italic">尚無轉錄文字</p>
          )}
          {profile.cloud_voice_id && (
            <p className="text-[10px] text-surface-600 font-mono">
              voice_id: {profile.cloud_voice_id}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
