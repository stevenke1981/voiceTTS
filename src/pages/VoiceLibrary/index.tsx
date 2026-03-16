import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, Trash2, Download, Search } from "lucide-react";
import { useState } from "react";
import { apiClient } from "@/lib/apiClient";

export default function VoiceLibraryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["voice-profiles"],
    queryFn: () => apiClient.clone.listProfiles(),
  });

  const { mutate: deleteProfile } = useMutation({
    mutationFn: (id: string) => apiClient.clone.deleteProfile(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["voice-profiles"] }),
  });

  const filtered = profiles.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-surface-100">聲音輪廓庫</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            管理所有聲音輪廓，{profiles.length} 個輪廓
          </p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input
            className="input pl-8 w-52"
            placeholder="搜尋輪廓..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-surface-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-surface-500">
          {search ? "找不到符合的聲音輪廓" : "尚無聲音輪廓，前往「語音複製」建立"}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-base font-semibold text-accent-light">
                  {p.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-surface-100 truncate">{p.name}</p>
                  <p className="text-xs text-surface-500">
                    {p.language} · {p.duration.toFixed(1)}s 樣本
                  </p>
                </div>
              </div>

              {p.audio_preview_url && (
                <audio controls src={p.audio_preview_url} className="w-full h-8" />
              )}

              <p className="text-xs text-surface-600">
                建立於 {new Date(p.created_at).toLocaleDateString("zh-TW")}
              </p>

              <div className="flex gap-2">
                <button className="btn-ghost flex-1 text-xs py-1.5">
                  <Play size={12} />
                  預覽
                </button>
                <button className="btn-ghost flex-1 text-xs py-1.5">
                  <Download size={12} />
                  匯出
                </button>
                <button
                  className="btn-ghost text-xs py-1.5 px-2 text-red-400 hover:bg-red-500/10"
                  onClick={() => deleteProfile(p.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
