import { useAppStore } from "@/stores/appStore";
import { Save } from "lucide-react";

export default function SettingsPage() {
  const { defaultEngine, backendUrl, setDefaultEngine, setBackendUrl } = useAppStore();

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-surface-100">設定</h1>
        <p className="text-sm text-surface-500 mt-0.5">應用程式設定與引擎設定</p>
      </div>

      {/* 後端設定 */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-surface-200">後端連線</h2>
        <div className="space-y-2">
          <label className="label">FastAPI 後端 URL</label>
          <input
            className="input"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
          />
          <p className="text-xs text-surface-500">預設：http://localhost:8765</p>
        </div>
      </div>

      {/* TTS 引擎設定 */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-surface-200">TTS 引擎</h2>
        <div className="space-y-2">
          <label className="label">預設引擎</label>
          <select
            className="input"
            value={defaultEngine}
            onChange={(e) =>
              setDefaultEngine(e.target.value as typeof defaultEngine)
            }
          >
            <option value="qwen3_cloud">Qwen3-TTS（雲端 API）</option>
            <option value="qwen3_local">Qwen3-TTS（本地）</option>
            <option value="chatterbox">Chatterbox（本地）</option>
            <option value="cosyvoice">CosyVoice2（本地·中文）</option>
          </select>
        </div>
      </div>

      {/* API 金鑰 */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-surface-200">API 金鑰</h2>
        <div className="space-y-2">
          <label className="label">Qwen3 DashScope API Key</label>
          <input
            className="input font-mono text-sm"
            type="password"
            placeholder="sk-..."
          />
          <p className="text-xs text-surface-500">
            使用雲端 API 模式時需要。金鑰儲存於本地，不會上傳。
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary">
          <Save size={16} />
          儲存設定
        </button>
      </div>
    </div>
  );
}
