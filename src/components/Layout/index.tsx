import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import BackendStatus from "@/components/BackendStatus";

export default function Layout() {
  return (
    <div className="flex h-full bg-surface-950">
      {/* 側邊欄 */}
      <Sidebar />

      {/* 主內容區 */}
      <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* 頂部狀態列 */}
        <header className="flex items-center justify-end px-4 h-10 border-b border-surface-800 shrink-0">
          <BackendStatus />
        </header>

        {/* 頁面內容 */}
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
