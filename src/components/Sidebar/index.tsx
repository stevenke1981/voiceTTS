import { NavLink } from "react-router-dom";
import clsx from "clsx";
import {
  Mic2,
  Type,
  Radio,
  BookOpen,
  Library,
  Settings,
  AudioWaveform,
} from "lucide-react";

const NAV_ITEMS = [
  {
    to: "/tts",
    icon: Type,
    label: "文字轉語音",
    description: "TTS",
  },
  {
    to: "/voice-clone",
    icon: Mic2,
    label: "語音複製",
    description: "Voice Clone",
  },
  {
    to: "/realtime",
    icon: Radio,
    label: "即時轉換",
    description: "Real-Time",
  },
  {
    to: "/story",
    icon: BookOpen,
    label: "劇本編輯器",
    description: "Story Editor",
  },
  {
    to: "/library",
    icon: Library,
    label: "聲音輪廓庫",
    description: "Voice Library",
  },
] as const;

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-56 shrink-0 bg-surface-900 border-r border-surface-800">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-surface-800">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/20">
          <AudioWaveform size={16} className="text-accent-light" />
        </div>
        <div>
          <p className="text-sm font-semibold text-surface-100">VoiceTTS</p>
          <p className="text-[10px] text-surface-500">語音合成工作室</p>
        </div>
      </div>

      {/* 導覽選單 */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        <p className="label px-3 pt-3 pb-1.5">功能</p>
        {NAV_ITEMS.map(({ to, icon: Icon, label, description }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx("nav-item", isActive && "active")
            }
          >
            <Icon size={16} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-sm leading-tight">{label}</p>
              <p className="text-[10px] text-surface-500 leading-tight">
                {description}
              </p>
            </div>
          </NavLink>
        ))}
      </nav>

      {/* 底部設定 */}
      <div className="p-2 border-t border-surface-800">
        <NavLink
          to="/settings"
          className={({ isActive }) => clsx("nav-item", isActive && "active")}
        >
          <Settings size={16} className="shrink-0" />
          <span>設定</span>
        </NavLink>
      </div>
    </aside>
  );
}
