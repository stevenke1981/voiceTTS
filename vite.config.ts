import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Tauri 設定：開發時監聽固定 port
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  // 防止 Vite 遮蔽 Tauri 的 rust error
  clearScreen: false,
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    // Tauri 在 Windows 使用 Chromium，可支援 ES2021+
    target: ["es2021", "chrome100", "safari13"],
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
