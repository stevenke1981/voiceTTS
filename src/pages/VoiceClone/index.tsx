import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic, Upload, Square, Loader2, CheckCircle, Trash2, Play } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import clsx from "clsx";

type Step = "record" | "preview" | "naming" | "done";

export default function VoiceClonePage() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("record");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [language, setLanguage] = useState("zh-TW");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
      setProfileName("");
      setAudioBlob(null);
      setAudioUrl(null);
      setTimeout(() => setStep("record"), 2000);
    },
  });

  const { mutate: deleteProfile } = useMutation({
    mutationFn: (id: string) => apiClient.clone.deleteProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-profiles"] });
    },
  });

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/wav" });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      setStep("preview");
      stream.getTracks().forEach((t) => t.stop());
    };

    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
    setStep("preview");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-surface-100">語音複製</h1>
        <p className="text-sm text-surface-500 mt-0.5">
          上傳 3~20 秒音訊，即可建立專屬聲音輪廓
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 左：建立流程 */}
        <div className="space-y-4">
          <div className="card p-6">
            {/* Step 指示器 */}
            <div className="flex items-center gap-2 mb-6">
              {(["record", "preview", "naming"] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={clsx(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                      step === s || (step === "done" && i < 3)
                        ? "bg-accent text-white"
                        : "bg-surface-700 text-surface-400"
                    )}
                  >
                    {i + 1}
                  </div>
                  {i < 2 && (
                    <div className="flex-1 h-px bg-surface-700 w-8" />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: 錄音 / 上傳 */}
            {step === "record" && (
              <div className="space-y-4 text-center">
                <p className="label">Step 1 — 錄音或上傳音檔</p>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={clsx(
                    "w-24 h-24 rounded-full mx-auto flex items-center justify-center transition-all",
                    isRecording
                      ? "bg-red-500/20 border-2 border-red-500 animate-pulse-slow"
                      : "bg-surface-800 border-2 border-surface-700 hover:border-accent/50"
                  )}
                >
                  {isRecording ? (
                    <Square size={28} className="text-red-400" />
                  ) : (
                    <Mic size={28} className="text-surface-300" />
                  )}
                </button>
                <p className="text-sm text-surface-500">
                  {isRecording ? "點擊停止錄音" : "點擊開始錄音（3~20 秒）"}
                </p>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-surface-700" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 bg-surface-900 text-xs text-surface-500">
                      或
                    </span>
                  </div>
                </div>
                <label className="btn-ghost w-full cursor-pointer">
                  <Upload size={16} />
                  上傳音訊檔案（WAV / MP3 / M4A）
                  <input
                    type="file"
                    accept="audio/*"
                    className="sr-only"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            )}

            {/* Step 2: 預覽 */}
            {step === "preview" && audioUrl && (
              <div className="space-y-4">
                <p className="label">Step 2 — 確認音訊</p>
                <audio controls src={audioUrl} className="w-full" />
                <div className="flex gap-2">
                  <button
                    className="btn-ghost flex-1"
                    onClick={() => {
                      setStep("record");
                      setAudioBlob(null);
                      setAudioUrl(null);
                    }}
                  >
                    重新錄製
                  </button>
                  <button
                    className="btn-primary flex-1"
                    onClick={() => setStep("naming")}
                  >
                    確認，下一步
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: 命名 */}
            {step === "naming" && (
              <div className="space-y-4">
                <p className="label">Step 3 — 命名聲音輪廓</p>
                <div className="space-y-2">
                  <label className="text-xs text-surface-400">輪廓名稱</label>
                  <input
                    className="input"
                    placeholder="例：小明的聲音"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-surface-400">語言</label>
                  <select
                    className="input"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="zh-TW">繁體中文</option>
                    <option value="zh-CN">簡體中文</option>
                    <option value="en-US">English</option>
                    <option value="ja-JP">日本語</option>
                    <option value="ko-KR">한국어</option>
                  </select>
                </div>
                <button
                  className="btn-primary w-full"
                  disabled={!profileName.trim() || isCreating}
                  onClick={() => createProfile()}
                >
                  {isCreating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      建立中...
                    </>
                  ) : (
                    "建立聲音輪廓"
                  )}
                </button>
              </div>
            )}

            {/* Done */}
            {step === "done" && (
              <div className="text-center space-y-3 py-4">
                <CheckCircle size={40} className="text-green-400 mx-auto" />
                <p className="text-surface-200 font-medium">建立成功！</p>
              </div>
            )}
          </div>
        </div>

        {/* 右：聲音輪廓庫 */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="label">聲音輪廓庫</span>
            <span className="badge badge-accent">{profiles.length} 個</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-surface-500" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-8 text-surface-500 text-sm">
              尚無聲音輪廓
              <br />
              從左側建立第一個
            </div>
          ) : (
            <div className="space-y-2">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg p-3 bg-surface-800 hover:bg-surface-700/80 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-sm font-medium text-accent-light shrink-0">
                    {p.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-100 truncate">
                      {p.name}
                    </p>
                    <p className="text-xs text-surface-500">
                      {p.language} · {p.duration.toFixed(1)}s
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 rounded hover:bg-surface-600 text-surface-400 hover:text-surface-100">
                      <Play size={13} />
                    </button>
                    <button
                      className="p-1.5 rounded hover:bg-red-500/20 text-surface-400 hover:text-red-400"
                      onClick={() => deleteProfile(p.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
