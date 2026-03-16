import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mic, MicOff, Radio, Volume2, Settings2, Circle } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import clsx from "clsx";

type ConvStatus = "idle" | "connecting" | "ready" | "converting" | "error";

const BACKEND_WS = "ws://localhost:8765";

export default function RealTimePage() {
  const [status, setStatus] = useState<ConvStatus>("idle");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedEngine, setSelectedEngine] = useState("cosyvoice");
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [outputVolume, setOutputVolume] = useState(1.0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ["voice-profiles"],
    queryFn: () => apiClient.clone.listProfiles(),
  });

  const stopConversion = useCallback(() => {
    wsRef.current?.close();
    processorRef.current?.disconnect();
    audioCtxRef.current?.close();
    if (levelTimerRef.current) clearInterval(levelTimerRef.current);
    wsRef.current = null;
    audioCtxRef.current = null;
    processorRef.current = null;
    setStatus("idle");
    setInputLevel(0);
    setOutputLevel(0);
    setStatusMsg("");
  }, []);

  const startConversion = useCallback(async () => {
    if (!selectedProfileId) return;
    setStatus("connecting");
    setStatusMsg("連線中...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;

      const gainNode = ctx.createGain();
      gainNode.gain.value = outputVolume;
      gainNodeRef.current = gainNode;
      gainNode.connect(ctx.destination);

      // WebSocket 連線
      const url = `${BACKEND_WS}/ws/realtime?profile_id=${selectedProfileId}&engine=${selectedEngine}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setStatusMsg("等待後端就緒...");

      ws.onmessage = async (evt) => {
        // 文字訊息 = 控制訊號
        if (typeof evt.data === "string") {
          const msg = JSON.parse(evt.data);
          if (msg.type === "ready") {
            setStatus("converting");
            setStatusMsg(msg.msg);
          } else if (msg.type === "error") {
            setStatusMsg(`錯誤：${msg.msg}`);
            setStatus("error");
            stopConversion();
          }
          return;
        }

        // Binary = 轉換後的 WAV 音訊，播放出來
        const blob = new Blob([evt.data], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.volume = outputVolume;
        audio.onended = () => URL.revokeObjectURL(url);
        audio.play().catch(() => {});

        // 輸出音量動畫
        setOutputLevel(75 + Math.random() * 25);
        setTimeout(() => setOutputLevel(0), 500);
      };

      ws.onclose = () => {
        if (status !== "idle") stopConversion();
      };

      ws.onerror = () => {
        setStatusMsg("WebSocket 連線錯誤");
        setStatus("error");
        stopConversion();
      };

      // 麥克風音訊 → WebSocket
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        // 音量計算
        const rms = Math.sqrt(input.reduce((s, v) => s + v * v, 0) / input.length);
        setInputLevel(Math.min(rms * 300, 100));

        if (ws.readyState === WebSocket.OPEN) {
          const int16 = new Int16Array(input.map((v) => Math.max(-1, Math.min(1, v)) * 32767));
          ws.send(int16.buffer);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      // 音量衰減動畫
      levelTimerRef.current = setInterval(() => {
        setInputLevel((v) => Math.max(0, v - 8));
        setOutputLevel((v) => Math.max(0, v - 15));
      }, 100);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMsg(`啟動失敗：${msg}`);
      setStatus("error");
    }
  }, [selectedProfileId, selectedEngine, outputVolume, status, stopConversion]);

  const toggle = () => {
    if (status === "idle" || status === "error") {
      startConversion();
    } else {
      stopConversion();
    }
  };

  useEffect(() => () => stopConversion(), [stopConversion]);

  // 音量變化即時更新
  useEffect(() => {
    if (gainNodeRef.current) gainNodeRef.current.gain.value = outputVolume;
  }, [outputVolume]);

  const isActive = status === "converting" || status === "connecting";

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-surface-100">即時語音轉換</h1>
        <p className="text-sm text-surface-500 mt-0.5">
          麥克風輸入即時轉換成目標聲音
        </p>
      </div>

      {/* 主控制區 */}
      <div className="card p-8 flex flex-col items-center gap-6">
        {/* 大按鈕 */}
        <button
          onClick={toggle}
          disabled={!selectedProfileId && status === "idle"}
          className={clsx(
            "w-36 h-36 rounded-full flex flex-col items-center justify-center gap-2 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed",
            isActive
              ? "bg-red-500/20 border-2 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.25)] animate-pulse-slow"
              : status === "error"
                ? "bg-red-900/20 border-2 border-red-700"
                : "bg-surface-800 border-2 border-surface-600 hover:border-accent/60 hover:shadow-[0_0_30px_rgba(124,111,247,0.15)]"
          )}
        >
          {isActive ? (
            <>
              <MicOff size={34} className="text-red-400" />
              <span className="text-xs text-red-400">點擊停止</span>
            </>
          ) : (
            <>
              <Mic size={34} className="text-surface-300" />
              <span className="text-xs text-surface-500">
                {!selectedProfileId ? "選擇輪廓" : "開始轉換"}
              </span>
            </>
          )}
        </button>

        {/* 狀態 */}
        <div className="flex items-center gap-2 text-sm">
          <Circle
            size={8}
            className={clsx(
              "fill-current",
              status === "converting" ? "text-green-400"
                : status === "connecting" ? "text-yellow-400 animate-pulse"
                  : status === "error" ? "text-red-400"
                    : "text-surface-600"
            )}
          />
          <span className={clsx(
            status === "error" ? "text-red-400"
              : status === "converting" ? "text-green-400"
                : "text-surface-500"
          )}>
            {statusMsg || (selectedProfileId ? "待機中" : "請先選擇聲音輪廓")}
          </span>
        </div>

        {/* 音量計 */}
        {isActive && (
          <div className="w-full max-w-sm grid grid-cols-2 gap-4 animate-fade-in">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-surface-500">
                <Mic size={11} /><span>原聲</span>
              </div>
              <div className="h-3 bg-surface-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-75"
                  style={{ width: `${inputLevel}%` }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-surface-500">
                <Volume2 size={11} /><span>轉換輸出</span>
              </div>
              <div className="h-3 bg-surface-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-accent-light rounded-full transition-all duration-150"
                  style={{ width: `${outputLevel}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 聲音輪廓選擇 */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-accent-light" />
            <span className="label">目標聲音輪廓</span>
          </div>
          {profiles.length === 0 ? (
            <p className="text-xs text-surface-500 text-center py-5">
              請先至「語音複製」建立聲音輪廓
            </p>
          ) : (
            <div className="space-y-1">
              {profiles.map((p) => (
                <label
                  key={p.id}
                  className={clsx(
                    "flex items-center gap-2.5 rounded-lg p-2.5 cursor-pointer transition-colors",
                    selectedProfileId === p.id
                      ? "bg-accent/15 border border-accent/30"
                      : "hover:bg-surface-800 border border-transparent"
                  )}
                >
                  <input
                    type="radio"
                    name="rt-profile"
                    className="sr-only"
                    value={p.id}
                    checked={selectedProfileId === p.id}
                    onChange={() => setSelectedProfileId(p.id)}
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

        {/* 設定 */}
        <div className="card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 size={14} className="text-accent-light" />
            <span className="label">轉換設定</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-surface-400">轉換引擎</label>
            <select
              className="input text-sm"
              value={selectedEngine}
              onChange={(e) => setSelectedEngine(e.target.value)}
              disabled={isActive}
            >
              <option value="cosyvoice">CosyVoice2（中文最佳）</option>
              <option value="qwen3_cloud">Qwen3-TTS 雲端</option>
              <option value="chatterbox">Chatterbox</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-surface-400">
              <span>輸出音量</span>
              <span>{Math.round(outputVolume * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.05}
              value={outputVolume}
              onChange={(e) => setOutputVolume(Number(e.target.value))}
              className="w-full accent-accent h-1.5 cursor-pointer"
            />
          </div>

          {/* 延遲提示 */}
          <div className="rounded-lg bg-surface-800 p-3 space-y-1">
            <p className="text-xs text-surface-400 font-medium">延遲說明</p>
            <p className="text-[11px] text-surface-500 leading-relaxed">
              轉換延遲取決於引擎與 GPU 速度。
              CosyVoice2 本地模式約 300~600ms，
              雲端 API 模式約 200~400ms。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
