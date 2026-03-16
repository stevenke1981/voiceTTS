import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mic, MicOff, Radio, Volume2, Settings2 } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import clsx from "clsx";

export default function RealTimePage() {
  const [isActive, setIsActive] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ["voice-profiles"],
    queryFn: () => apiClient.clone.listProfiles(),
  });

  const toggleConversion = async () => {
    if (isActive) {
      stopConversion();
    } else {
      await startConversion();
    }
  };

  const startConversion = async () => {
    if (!selectedProfileId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });

      // WebSocket 連線到後端即時轉換
      const ws = new WebSocket(
        `ws://localhost:8765/ws/realtime?profile_id=${selectedProfileId}`
      );
      wsRef.current = ws;

      ws.onopen = () => setIsActive(true);
      ws.onclose = () => setIsActive(false);
      ws.onerror = () => setIsActive(false);

      // 音訊串流處理（簡化示意）
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        const level = Math.max(...Array.from(data).map(Math.abs));
        setInputLevel(Math.min(level * 100, 100));

        if (ws.readyState === WebSocket.OPEN) {
          const int16 = new Int16Array(data.map((v) => v * 32767));
          ws.send(int16.buffer);
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
    } catch (err) {
      console.error("無法啟動即時轉換：", err);
    }
  };

  const stopConversion = () => {
    wsRef.current?.close();
    audioContextRef.current?.close();
    setIsActive(false);
    setInputLevel(0);
    setOutputLevel(0);
  };

  useEffect(() => () => stopConversion(), []);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-surface-100">即時語音轉換</h1>
        <p className="text-sm text-surface-500 mt-0.5">
          麥克風輸入即時轉換成目標聲音，延遲目標 &lt;200ms
        </p>
      </div>

      {/* 主控面板 */}
      <div className="card p-8">
        <div className="flex flex-col items-center gap-6">
          {/* 大啟動按鈕 */}
          <button
            onClick={toggleConversion}
            disabled={!selectedProfileId}
            className={clsx(
              "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed",
              isActive
                ? "bg-red-500/20 border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.3)] animate-pulse-slow"
                : "bg-surface-800 border-2 border-surface-600 hover:border-accent/60 hover:shadow-[0_0_30px_rgba(124,111,247,0.2)]"
            )}
          >
            {isActive ? (
              <MicOff size={36} className="text-red-400" />
            ) : (
              <Mic size={36} className="text-surface-300" />
            )}
          </button>

          <p className="text-sm text-surface-400">
            {!selectedProfileId
              ? "請先選擇聲音輪廓"
              : isActive
                ? "轉換中 · 點擊停止"
                : "點擊開始即時轉換"}
          </p>

          {/* 音量視覺化 */}
          {isActive && (
            <div className="w-full grid grid-cols-2 gap-4 animate-fade-in">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-surface-500">
                  <Mic size={12} />
                  <span>原聲輸入</span>
                </div>
                <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-75"
                    style={{ width: `${inputLevel}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-surface-500">
                  <Volume2 size={12} />
                  <span>轉換輸出</span>
                </div>
                <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-75"
                    style={{ width: `${outputLevel}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 設定 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 聲音輪廓選擇 */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-accent-light" />
            <span className="label">目標聲音輪廓</span>
          </div>
          {profiles.length === 0 ? (
            <p className="text-xs text-surface-500 text-center py-4">
              請先至「語音複製」建立聲音輪廓
            </p>
          ) : (
            <div className="space-y-1">
              {profiles.map((p) => (
                <label
                  key={p.id}
                  className={clsx(
                    "flex items-center gap-3 rounded-lg p-2.5 cursor-pointer transition-colors",
                    selectedProfileId === p.id
                      ? "bg-accent/15 border border-accent/30"
                      : "hover:bg-surface-800 border border-transparent"
                  )}
                >
                  <input
                    type="radio"
                    name="rt-profile"
                    value={p.id}
                    checked={selectedProfileId === p.id}
                    onChange={() => setSelectedProfileId(p.id)}
                    className="sr-only"
                  />
                  <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs text-accent-light">
                    {p.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-100 truncate">{p.name}</p>
                    <p className="text-xs text-surface-500">{p.language}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 音訊設定 */}
        <div className="card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 size={14} className="text-accent-light" />
            <span className="label">音訊設定</span>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-surface-400">輸入設備</label>
              <select className="input text-sm">
                <option>預設麥克風</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-surface-400">輸出設備</label>
              <select className="input text-sm">
                <option>預設揚聲器</option>
                <option>虛擬音訊設備（VB-Cable）</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-surface-400">
                <span>輸出音量</span>
                <span>100%</span>
              </div>
              <input type="range" min={0} max={100} defaultValue={100} className="w-full accent-accent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
