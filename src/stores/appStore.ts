import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TTSRequest } from "@/lib/apiClient";

interface AppState {
  // 後端連線
  backendUrl: string;

  // TTS 預設設定
  defaultEngine: TTSRequest["engine"];

  // 目前選取的聲音輪廓
  selectedVoiceProfileId: string | null;

  // Actions
  setBackendUrl: (url: string) => void;
  setDefaultEngine: (engine: TTSRequest["engine"]) => void;
  setSelectedVoiceProfileId: (id: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      backendUrl: "http://localhost:8765",
      defaultEngine: "qwen3_cloud",
      selectedVoiceProfileId: null,

      setBackendUrl: (backendUrl) => set({ backendUrl }),
      setDefaultEngine: (defaultEngine) => set({ defaultEngine }),
      setSelectedVoiceProfileId: (selectedVoiceProfileId) =>
        set({ selectedVoiceProfileId }),
    }),
    {
      name: "voicetts-settings",
    }
  )
);

// ─── TTS 佇列 store ───────────────────────────────────────────

interface QueueItem {
  jobId: string;
  text: string;
  status: "queued" | "processing" | "done" | "error";
  audioUrl?: string;
  createdAt: number;
}

interface TTSQueueState {
  queue: QueueItem[];
  addJob: (jobId: string, text: string) => void;
  updateJob: (jobId: string, update: Partial<QueueItem>) => void;
  removeJob: (jobId: string) => void;
  clearDone: () => void;
}

export const useTTSQueue = create<TTSQueueState>((set) => ({
  queue: [],
  addJob: (jobId, text) =>
    set((s) => ({
      queue: [
        ...s.queue,
        { jobId, text, status: "queued", createdAt: Date.now() },
      ],
    })),
  updateJob: (jobId, update) =>
    set((s) => ({
      queue: s.queue.map((q) =>
        q.jobId === jobId ? { ...q, ...update } : q
      ),
    })),
  removeJob: (jobId) =>
    set((s) => ({ queue: s.queue.filter((q) => q.jobId !== jobId) })),
  clearDone: () =>
    set((s) => ({
      queue: s.queue.filter((q) => q.status !== "done"),
    })),
}));
