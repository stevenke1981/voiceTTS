import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Play, Download, Loader2, Sparkles, Trash2,
  UserPlus, Settings, ChevronDown, CheckCircle, AlertCircle,
  GripVertical, Volume2,
} from "lucide-react";
import { apiClient, type StoryScript, type StoryCharacter, type ScriptLine } from "@/lib/apiClient";
import clsx from "clsx";

const CHAR_COLORS = [
  { value: "bg-violet-500", label: "紫" },
  { value: "bg-blue-500", label: "藍" },
  { value: "bg-emerald-500", label: "綠" },
  { value: "bg-amber-500", label: "橘" },
  { value: "bg-rose-500", label: "粉" },
  { value: "bg-cyan-500", label: "青" },
];

const ENGINES = ["qwen3_cloud", "qwen3_local", "chatterbox", "cosyvoice"] as const;

// SSE 進度事件
interface SseEvent {
  type: "start" | "progress" | "done" | "heartbeat";
  line_id?: string;
  index?: number;
  total?: number;
  status?: string;
  audio_url?: string;
  duration?: number;
  error?: string;
}

export default function StoryEditorPage() {
  const queryClient = useQueryClient();
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [engine, setEngine] = useState<string>("qwen3_cloud");
  const [genProgress, setGenProgress] = useState<Record<string, string>>({}); // lineId → status
  const [isGenerating, setIsGenerating] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  const { data: scripts = [], isLoading } = useQuery({
    queryKey: ["story-scripts"],
    queryFn: () => apiClient.story.list(),
  });

  const activeScript = scripts.find((s) => s.id === activeScriptId) ?? null;

  const { data: profiles = [] } = useQuery({
    queryKey: ["voice-profiles"],
    queryFn: () => apiClient.clone.listProfiles(),
  });

  // ── 劇本 CRUD ──
  const { mutate: createScript } = useMutation({
    mutationFn: () => apiClient.story.create(newName || "未命名劇本"),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ["story-scripts"] });
      setActiveScriptId(s.id);
      setNewName("");
    },
  });

  const { mutate: deleteScript } = useMutation({
    mutationFn: (id: string) => apiClient.story.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["story-scripts"] });
      if (activeScriptId === id) setActiveScriptId(null);
    },
  });

  // ── 角色 CRUD ──
  const { mutate: addCharacter } = useMutation({
    mutationFn: () => {
      const count = activeScript?.characters.length ?? 0;
      return apiClient.story.addCharacter(activeScriptId!, {
        name: `角色 ${count + 1}`,
        color: CHAR_COLORS[count % CHAR_COLORS.length].value,
        voice_profile_id: null,
        order: count,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["story-scripts"] }),
  });

  const { mutate: updateCharacter } = useMutation({
    mutationFn: ({ charId, data }: { charId: string; data: Omit<StoryCharacter, "id" | "voice_profile_name"> }) =>
      apiClient.story.updateCharacter(activeScriptId!, charId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["story-scripts"] }),
  });

  const { mutate: deleteCharacter } = useMutation({
    mutationFn: (charId: string) => apiClient.story.deleteCharacter(activeScriptId!, charId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["story-scripts"] }),
  });

  // ── 對白 CRUD ──
  const { mutate: addLine } = useMutation({
    mutationFn: () => {
      const chars = activeScript?.characters ?? [];
      if (chars.length === 0) return Promise.reject("請先新增角色");
      return apiClient.story.addLine(activeScriptId!, {
        character_id: chars[0].id,
        text: "",
        order: activeScript?.lines.length ?? 0,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["story-scripts"] }),
  });

  const { mutate: updateLine } = useMutation({
    mutationFn: ({ lineId, data }: { lineId: string; data: { character_id: string; text: string; order: number } }) =>
      apiClient.story.updateLine(activeScriptId!, lineId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["story-scripts"] }),
  });

  const { mutate: deleteLine } = useMutation({
    mutationFn: (lineId: string) => apiClient.story.deleteLine(activeScriptId!, lineId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["story-scripts"] }),
  });

  // ── 批次生成（SSE） ──
  const startGeneration = async () => {
    if (!activeScriptId || isGenerating) return;
    setIsGenerating(true);
    setGenProgress({});

    // 觸發後端批次生成
    await apiClient.story.generateAll(activeScriptId, engine);

    // 訂閱 SSE 進度
    const es = new EventSource(
      `http://localhost:8765/api/story/scripts/${activeScriptId}/progress`
    );
    sseRef.current = es;

    es.onmessage = (e) => {
      const evt: SseEvent = JSON.parse(e.data);

      if (evt.type === "progress" && evt.line_id) {
        setGenProgress((prev) => ({ ...prev, [evt.line_id!]: evt.status! }));
        if (evt.status === "done") {
          queryClient.invalidateQueries({ queryKey: ["story-scripts"] });
        }
      }

      if (evt.type === "done") {
        es.close();
        setIsGenerating(false);
        queryClient.invalidateQueries({ queryKey: ["story-scripts"] });
      }
    };

    es.onerror = () => {
      es.close();
      setIsGenerating(false);
    };
  };

  useEffect(() => () => sseRef.current?.close(), []);

  const totalDuration = activeScript?.lines
    .reduce((s, l) => s + (l.duration ?? 0), 0) ?? 0;

  const doneCount = activeScript?.lines.filter((l) => l.gen_status === "done").length ?? 0;

  return (
    <div className="flex flex-col h-full gap-4 animate-fade-in">
      {/* 頂部欄 */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-surface-100">劇本編輯器</h1>
          <p className="text-sm text-surface-500 mt-0.5">多角色配音，整軌匯出</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="input w-36 text-sm"
            placeholder="劇本名稱..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createScript()}
          />
          <button className="btn-primary text-sm" onClick={() => createScript()}>
            <Plus size={15} />新增劇本
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* ── 劇本列表 ── */}
        <div className="w-44 shrink-0 card p-2 flex flex-col gap-1 overflow-y-auto">
          <p className="label px-2 py-1.5">劇本列表</p>
          {isLoading ? (
            <Loader2 size={16} className="animate-spin text-surface-500 mx-auto mt-4" />
          ) : scripts.length === 0 ? (
            <p className="text-xs text-surface-600 text-center py-6">尚無劇本</p>
          ) : (
            scripts.map((s) => (
              <div
                key={s.id}
                className={clsx(
                  "group flex items-center gap-1 rounded-lg px-2.5 py-2 cursor-pointer transition-colors",
                  activeScriptId === s.id
                    ? "bg-accent/15 text-accent-light"
                    : "text-surface-400 hover:bg-surface-800 hover:text-surface-100"
                )}
                onClick={() => setActiveScriptId(s.id)}
              >
                <span className="text-sm flex-1 truncate">{s.name}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-surface-600 hover:text-red-400 transition-all"
                  onClick={(e) => { e.stopPropagation(); deleteScript(s.id); }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        {!activeScript ? (
          <div className="flex-1 flex items-center justify-center text-surface-600 text-sm">
            選擇或新增劇本以開始編輯
          </div>
        ) : (
          <>
            {/* ── 中央編輯區 ── */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              {/* 角色列 */}
              <div className="card p-3 flex items-center gap-2 flex-wrap shrink-0">
                <span className="label">角色：</span>
                {activeScript.characters.map((c) => (
                  <CharacterChip
                    key={c.id}
                    char={c}
                    profiles={profiles}
                    onUpdate={(data) => updateCharacter({ charId: c.id, data })}
                    onDelete={() => deleteCharacter(c.id)}
                  />
                ))}
                <button className="btn-ghost py-1 px-2.5 text-xs" onClick={() => addCharacter()}>
                  <UserPlus size={13} />新增角色
                </button>
              </div>

              {/* 對白列表 */}
              <div className="card flex-1 overflow-y-auto p-3 space-y-1.5">
                {activeScript.lines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-surface-600">
                    <p className="text-sm">尚無對白</p>
                    {activeScript.characters.length === 0 && (
                      <p className="text-xs">請先新增角色</p>
                    )}
                    <button
                      className="btn-ghost"
                      onClick={() => addLine()}
                      disabled={activeScript.characters.length === 0}
                    >
                      <Plus size={14} />加入第一行
                    </button>
                  </div>
                ) : (
                  <>
                    {activeScript.lines.map((line) => (
                      <LineRow
                        key={line.id}
                        line={line}
                        characters={activeScript.characters}
                        genStatus={genProgress[line.id] ?? line.gen_status}
                        onUpdate={(data) => updateLine({ lineId: line.id, data })}
                        onDelete={() => deleteLine(line.id)}
                      />
                    ))}
                    <button className="btn-ghost w-full mt-1 text-sm" onClick={() => addLine()}>
                      <Plus size={14} />加入對白
                    </button>
                  </>
                )}
              </div>

              {/* 操作列 */}
              <div className="flex items-center gap-2 shrink-0">
                {/* 引擎選擇 */}
                <select
                  className="input text-xs w-36"
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                  disabled={isGenerating}
                >
                  <option value="qwen3_cloud">Qwen3 雲端</option>
                  <option value="qwen3_local">Qwen3 本地</option>
                  <option value="cosyvoice">CosyVoice2</option>
                  <option value="chatterbox">Chatterbox</option>
                </select>

                <button
                  className="btn-primary flex-1"
                  onClick={startGeneration}
                  disabled={isGenerating || activeScript.lines.length === 0}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      生成中 {doneCount}/{activeScript.lines.length}
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} />
                      批次生成語音
                    </>
                  )}
                </button>

                <a
                  href={apiClient.story.exportUrl(activeScript.id)}
                  download={`${activeScript.name}.wav`}
                  className={clsx(
                    "btn-ghost text-sm",
                    doneCount === 0 && "opacity-40 pointer-events-none"
                  )}
                >
                  <Download size={15} />
                  匯出整軌
                </a>
              </div>
            </div>

            {/* ── 右側時間軸 ── */}
            <Timeline script={activeScript} />
          </>
        )}
      </div>
    </div>
  );
}

// ── 角色 Chip 元件 ──
function CharacterChip({
  char, profiles, onUpdate, onDelete,
}: {
  char: StoryCharacter;
  profiles: { id: string; name: string }[];
  onUpdate: (data: Omit<StoryCharacter, "id" | "voice_profile_name">) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(char.name);

  return (
    <div className="relative">
      <button
        className={clsx(
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
          "bg-surface-800 hover:bg-surface-700 border border-surface-700"
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={clsx("w-2 h-2 rounded-full shrink-0", char.color)} />
        <span className="text-surface-200">{char.name}</span>
        {char.voice_profile_name && (
          <span className="text-surface-500">· {char.voice_profile_name}</span>
        )}
        <ChevronDown size={10} className="text-surface-500" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 card p-3 space-y-2 w-56 shadow-xl animate-fade-in">
          <div className="space-y-1">
            <label className="text-[10px] text-surface-500">名稱</label>
            <input
              className="input text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => onUpdate({ ...char, name })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-surface-500">顏色</label>
            <div className="flex gap-1.5">
              {CHAR_COLORS.map((c) => (
                <button
                  key={c.value}
                  className={clsx(
                    "w-5 h-5 rounded-full transition-transform",
                    c.value,
                    char.color === c.value && "ring-2 ring-white scale-110"
                  )}
                  onClick={() => onUpdate({ ...char, name, color: c.value })}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-surface-500">聲音輪廓</label>
            <select
              className="input text-xs"
              value={char.voice_profile_id ?? ""}
              onChange={(e) => onUpdate({ ...char, name, voice_profile_id: e.target.value || null })}
            >
              <option value="">（預設聲音）</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button
            className="btn-ghost w-full text-xs text-red-400 hover:bg-red-500/10"
            onClick={() => { onDelete(); setOpen(false); }}
          >
            <Trash2 size={12} />刪除角色
          </button>
        </div>
      )}
    </div>
  );
}

// ── 對白行元件 ──
function LineRow({
  line, characters, genStatus, onUpdate, onDelete,
}: {
  line: ScriptLine;
  characters: StoryCharacter[];
  genStatus: string;
  onUpdate: (data: { character_id: string; text: string; order: number }) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(line.text);
  const [charId, setCharId] = useState(line.character_id);
  const char = characters.find((c) => c.id === charId);

  const save = () => {
    if (text !== line.text || charId !== line.character_id) {
      onUpdate({ character_id: charId, text, order: line.order });
    }
  };

  return (
    <div className="flex items-start gap-2 group">
      <GripVertical size={14} className="text-surface-700 mt-2.5 shrink-0 cursor-grab" />

      {/* 角色選擇 */}
      <select
        className="input w-28 text-xs shrink-0 py-1.5"
        value={charId}
        onChange={(e) => { setCharId(e.target.value); }}
        onBlur={save}
      >
        {characters.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {/* 色條 */}
      {char && (
        <div className={clsx("w-1 self-stretch rounded-full shrink-0 mt-1", char.color)} />
      )}

      {/* 文字輸入 */}
      <input
        className="input flex-1 py-1.5 text-sm"
        placeholder="輸入對白..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
      />

      {/* 生成狀態 */}
      <div className="shrink-0 flex items-center gap-1 mt-1.5">
        {genStatus === "generating" && (
          <Loader2 size={14} className="text-yellow-400 animate-spin" />
        )}
        {genStatus === "done" && (
          <CheckCircle size={14} className="text-green-400" />
        )}
        {genStatus === "error" && (
          <AlertCircle size={14} className="text-red-400" />
        )}
        {line.audio_url && genStatus === "done" && (
          <button
            className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-accent-light"
            onClick={() => new Audio(line.audio_url!).play()}
          >
            <Volume2 size={12} />
          </button>
        )}
      </div>

      {/* 刪除 */}
      <button
        className="p-1.5 rounded opacity-0 group-hover:opacity-100 text-surface-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0 mt-0.5"
        onClick={onDelete}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── 時間軸元件 ──
function Timeline({ script }: { script: StoryScript }) {
  const totalDuration = script.lines.reduce((s, l) => s + (l.duration ?? 0), 0);
  const charMap = Object.fromEntries(script.characters.map((c) => [c.id, c]));

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="w-52 shrink-0 card p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="label">時間軸</p>
        {totalDuration > 0 && (
          <span className="text-xs text-surface-500">{fmt(totalDuration)}</span>
        )}
      </div>

      {totalDuration === 0 ? (
        <p className="text-xs text-surface-600 text-center mt-4">
          生成語音後顯示時間軸
        </p>
      ) : (
        <div className="space-y-2.5 overflow-y-auto flex-1">
          {script.characters.map((char) => {
            const charLines = script.lines.filter(
              (l) => l.character_id === char.id && l.duration
            );
            if (charLines.length === 0) return null;

            let offset = 0;
            return (
              <div key={char.id}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={clsx("w-2 h-2 rounded-full", char.color)} />
                  <p className="text-xs text-surface-400 truncate">{char.name}</p>
                </div>
                <div className="h-5 bg-surface-800 rounded relative overflow-hidden">
                  {script.lines.map((line) => {
                    const lineOffset = offset;
                    const dur = line.duration ?? 0;
                    if (totalDuration > 0) {
                      offset += dur / totalDuration * 100;
                    }
                    if (line.character_id !== char.id || !dur) return null;
                    return (
                      <div
                        key={line.id}
                        title={`${line.text.slice(0, 20)} (${dur.toFixed(1)}s)`}
                        className={clsx(
                          "absolute top-0.5 bottom-0.5 rounded-sm opacity-80 hover:opacity-100 transition-opacity",
                          char.color
                        )}
                        style={{
                          left: `${(lineOffset / 100) * 100}%`,
                          width: `${(dur / totalDuration) * 100}%`,
                          minWidth: "3px",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
