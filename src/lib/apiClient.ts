import axios from "axios";

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8765";

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 60_000,
  headers: { "Content-Type": "application/json" },
});

// ──────────────────────── 型別定義 ────────────────────────

export interface VoiceProfile {
  id: string;
  name: string;
  language: string;
  duration: number;
  transcript: string | null;
  cloud_voice_id: string | null;
  created_at: string;
  audio_preview_url?: string;
}

export interface TTSRequest {
  text: string;
  engine: "qwen3_cloud" | "qwen3_local" | "chatterbox" | "cosyvoice";
  voice_profile_id?: string;
  speed?: number;   // 0.5 ~ 2.0
  pitch?: number;   // -12 ~ 12 semitones
}

export interface TTSJob {
  job_id: string;
  status: "queued" | "processing" | "done" | "error";
  audio_url?: string;
  error?: string;
  created_at: string;
}

export interface StoryScript {
  id: string;
  name: string;
  lines: ScriptLine[];
  created_at: string;
}

export interface ScriptLine {
  id: string;
  character_id: string;
  text: string;
  audio_url?: string;
  duration?: number;
  order: number;
}

// ──────────────────────── API 方法 ────────────────────────

export interface EngineStatus {
  id: string;
  label: string;
  available: boolean;
}

export const apiClient = {
  // 健康檢查
  async health(): Promise<boolean> {
    const res = await http.get("/health");
    return res.data.status === "ok";
  },

  // 引擎狀態
  async engineStatus(): Promise<EngineStatus[]> {
    const res = await http.get("/api/engines/status");
    return res.data.engines;
  },

  // ── TTS ──
  tts: {
    async generate(req: TTSRequest): Promise<TTSJob> {
      const res = await http.post("/api/tts/generate", req);
      return res.data;
    },
    async getJob(jobId: string): Promise<TTSJob> {
      const res = await http.get(`/api/tts/jobs/${jobId}`);
      return res.data;
    },
    async listJobs(): Promise<TTSJob[]> {
      const res = await http.get("/api/tts/jobs");
      return res.data;
    },
  },

  // ── 語音複製 ──
  clone: {
    async createProfile(
      name: string,
      language: string,
      audioBlob: Blob
    ): Promise<VoiceProfile> {
      const form = new FormData();
      form.append("name", name);
      form.append("language", language);
      form.append("audio", audioBlob, "sample.wav");
      const res = await http.post("/api/clone/profiles", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    async listProfiles(): Promise<VoiceProfile[]> {
      const res = await http.get("/api/clone/profiles");
      return res.data;
    },
    async deleteProfile(id: string): Promise<void> {
      await http.delete(`/api/clone/profiles/${id}`);
    },
  },

  // ── 劇本 ──
  story: {
    async list(): Promise<StoryScript[]> {
      const res = await http.get("/api/story/scripts");
      return res.data;
    },
    async create(name: string): Promise<StoryScript> {
      const res = await http.post("/api/story/scripts", { name });
      return res.data;
    },
    async update(id: string, data: Partial<StoryScript>): Promise<StoryScript> {
      const res = await http.patch(`/api/story/scripts/${id}`, data);
      return res.data;
    },
    async delete(id: string): Promise<void> {
      await http.delete(`/api/story/scripts/${id}`);
    },
    async generateAll(id: string): Promise<void> {
      await http.post(`/api/story/scripts/${id}/generate`);
    },
  },
};
