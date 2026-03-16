import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Play,
  Download,
  Loader2,
  Sparkles,
  Trash2,
  GripVertical,
  UserPlus,
} from "lucide-react";
import { apiClient, type StoryScript, type ScriptLine } from "@/lib/apiClient";
import clsx from "clsx";

const COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

interface Character {
  id: string;
  name: string;
  profileId: string | null;
  color: string;
}

export default function StoryEditorPage() {
  const queryClient = useQueryClient();
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [lines, setLines] = useState<Array<{ charId: string; text: string }>>([]);
  const [newScriptName, setNewScriptName] = useState("");

  const { data: scripts = [], isLoading } = useQuery({
    queryKey: ["story-scripts"],
    queryFn: () => apiClient.story.list(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["voice-profiles"],
    queryFn: () => apiClient.clone.listProfiles(),
  });

  const { mutate: createScript } = useMutation({
    mutationFn: () => apiClient.story.create(newScriptName || "未命名劇本"),
    onSuccess: (script) => {
      queryClient.invalidateQueries({ queryKey: ["story-scripts"] });
      setActiveScriptId(script.id);
      setNewScriptName("");
    },
  });

  const { mutate: generateAll, isPending: isGenerating } = useMutation({
    mutationFn: (id: string) => apiClient.story.generateAll(id),
  });

  const addCharacter = () => {
    const newChar: Character = {
      id: crypto.randomUUID(),
      name: `角色 ${characters.length + 1}`,
      profileId: null,
      color: COLORS[characters.length % COLORS.length],
    };
    setCharacters((prev) => [...prev, newChar]);
  };

  const addLine = () => {
    if (characters.length === 0) return;
    setLines((prev) => [
      ...prev,
      { charId: characters[0].id, text: "" },
    ]);
  };

  const updateLine = (
    index: number,
    field: "charId" | "text",
    value: string
  ) => {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    );
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="h-full flex flex-col space-y-4 animate-fade-in">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-surface-100">劇本編輯器</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            多角色對白生成，時間軸排列後整軌匯出
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="input w-40 text-sm"
            placeholder="劇本名稱"
            value={newScriptName}
            onChange={(e) => setNewScriptName(e.target.value)}
          />
          <button className="btn-primary" onClick={() => createScript()}>
            <Plus size={16} />
            新增劇本
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* 左：劇本列表 */}
        <div className="w-44 shrink-0 card p-3 space-y-1 overflow-y-auto">
          <p className="label px-1 pb-1">劇本</p>
          {isLoading ? (
            <Loader2 size={16} className="animate-spin text-surface-500 mx-auto mt-4" />
          ) : scripts.length === 0 ? (
            <p className="text-xs text-surface-500 text-center py-6">尚無劇本</p>
          ) : (
            scripts.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveScriptId(s.id)}
                className={clsx(
                  "w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors",
                  activeScriptId === s.id
                    ? "bg-accent/15 text-accent-light"
                    : "text-surface-300 hover:bg-surface-800"
                )}
              >
                {s.name}
              </button>
            ))
          )}
        </div>

        {/* 中：劇本編輯 */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* 角色列表 */}
          <div className="card p-3 flex items-center gap-2 flex-wrap shrink-0">
            <span className="label">角色：</span>
            {characters.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 bg-surface-800 text-sm"
              >
                <span className={clsx("w-2 h-2 rounded-full", c.color)} />
                <span className="text-surface-200">{c.name}</span>
              </div>
            ))}
            <button
              className="btn-ghost py-1 px-2.5 text-xs"
              onClick={addCharacter}
            >
              <UserPlus size={13} />
              新增角色
            </button>
          </div>

          {/* 對白行 */}
          <div className="card flex-1 overflow-y-auto p-3 space-y-2">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-surface-500">
                <p className="text-sm">尚無對白</p>
                <button className="btn-ghost" onClick={addLine}>
                  <Plus size={14} />
                  加入第一行
                </button>
              </div>
            ) : (
              <>
                {lines.map((line, i) => {
                  const char = characters.find((c) => c.id === line.charId);
                  return (
                    <div key={i} className="flex items-start gap-2 group">
                      <GripVertical
                        size={14}
                        className="text-surface-600 mt-2.5 shrink-0 cursor-grab"
                      />
                      {/* 角色選擇 */}
                      <select
                        className="input w-28 text-xs shrink-0 py-1.5"
                        value={line.charId}
                        onChange={(e) => updateLine(i, "charId", e.target.value)}
                      >
                        {characters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {/* 文字輸入 */}
                      <input
                        className="input flex-1 py-1.5 text-sm"
                        placeholder="輸入對白..."
                        value={line.text}
                        onChange={(e) => updateLine(i, "text", e.target.value)}
                      />
                      <button
                        className="p-1.5 rounded text-surface-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        onClick={() => removeLine(i)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
                <button
                  className="btn-ghost w-full mt-2"
                  onClick={addLine}
                >
                  <Plus size={14} />
                  加入對白
                </button>
              </>
            )}
          </div>

          {/* 操作列 */}
          <div className="flex gap-2 shrink-0">
            <button
              className="btn-primary flex-1"
              disabled={isGenerating || lines.length === 0 || !activeScriptId}
              onClick={() => activeScriptId && generateAll(activeScriptId)}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  批次生成中...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  批次生成所有語音
                </>
              )}
            </button>
            <button className="btn-ghost">
              <Play size={16} />
              預覽
            </button>
            <button className="btn-ghost">
              <Download size={16} />
              匯出整軌
            </button>
          </div>
        </div>

        {/* 右：時間軸（簡化版） */}
        <div className="w-56 shrink-0 card p-3 flex flex-col gap-2">
          <p className="label">時間軸</p>
          {lines.length === 0 ? (
            <p className="text-xs text-surface-500 text-center mt-4">
              生成語音後顯示時間軸
            </p>
          ) : (
            <div className="space-y-2 overflow-y-auto flex-1">
              {characters.map((c) => (
                <div key={c.id}>
                  <p className="text-xs text-surface-500 mb-1">{c.name}</p>
                  <div className="h-6 bg-surface-800 rounded relative overflow-hidden">
                    {lines
                      .filter((l) => l.charId === c.id)
                      .map((_, i) => (
                        <div
                          key={i}
                          className={clsx(
                            "absolute top-1 bottom-1 rounded",
                            c.color,
                            "opacity-70"
                          )}
                          style={{
                            left: `${(i * 20) % 80}%`,
                            width: "18%",
                          }}
                        />
                      ))}
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
