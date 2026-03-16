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

export interface StoryCharacter {
  id: string;
  name: string;
  color: string;
  voice_profile_id: string | null;
  voice_profile_name: string | null;
  order: number;
}

export interface ScriptLine {
  id: string;
  character_id: string;
  text: string;
  audio_url?: string;
  duration?: number;
  order: number;
  gen_status: "queued" | "generating" | "done" | "error";
}

export interface StoryScript {
  id: string;
  name: string;
  characters: StoryCharacter[];
  lines: ScriptLine[];
  created_at: string;
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
      const res = await http.post(`/api/story/scripts?name=${encodeURIComponent(name)}`);
      return res.data;
    },
    async rename(id: string, name: string): Promise<StoryScript> {
      const res = await http.patch(`/api/story/scripts/${id}/name?name=${encodeURIComponent(name)}`);
      return res.data;
    },
    async delete(id: string): Promise<void> {
      await http.delete(`/api/story/scripts/${id}`);
    },
    // 角色
    async addCharacter(scriptId: string, data: Omit<StoryCharacter, "id" | "voice_profile_name">): Promise<StoryCharacter> {
      const res = await http.post(`/api/story/scripts/${scriptId}/characters`, data);
      return res.data;
    },
    async updateCharacter(scriptId: string, charId: string, data: Omit<StoryCharacter, "id" | "voice_profile_name">): Promise<StoryCharacter> {
      const res = await http.patch(`/api/story/scripts/${scriptId}/characters/${charId}`, data);
      return res.data;
    },
    async deleteCharacter(scriptId: string, charId: string): Promise<void> {
      await http.delete(`/api/story/scripts/${scriptId}/characters/${charId}`);
    },
    // 對白
    async addLine(scriptId: string, data: { character_id: string; text: string; order: number }): Promise<ScriptLine> {
      const res = await http.post(`/api/story/scripts/${scriptId}/lines`, data);
      return res.data;
    },
    async updateLine(scriptId: string, lineId: string, data: { character_id: string; text: string; order: number }): Promise<ScriptLine> {
      const res = await http.patch(`/api/story/scripts/${scriptId}/lines/${lineId}`, data);
      return res.data;
    },
    async deleteLine(scriptId: string, lineId: string): Promise<void> {
      await http.delete(`/api/story/scripts/${scriptId}/lines/${lineId}`);
    },
    async reorderLines(scriptId: string, orders: { id: string; order: number }[]): Promise<StoryScript> {
      const res = await http.post(`/api/story/scripts/${scriptId}/lines/reorder`, orders);
      return res.data;
    },
    // 生成
    async generateAll(scriptId: string, engine = "qwen3_cloud"): Promise<void> {
      await http.post(`/api/story/scripts/${scriptId}/generate?engine=${engine}`);
    },
    exportUrl(scriptId: string): string {
      return `${BASE_URL}/api/story/scripts/${scriptId}/export`;
    },
  },
};
