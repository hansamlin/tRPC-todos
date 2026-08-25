import path from "node:path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // .env 放在 monorepo 根目錄，讓 web 與 server 共用同一份設定
  envDir: "..",
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      // 用絕對路徑，讓從 monorepo 根目錄執行的 oxlint 也能正確找到 routes
      routesDirectory: path.resolve(import.meta.dirname, "./src/routes"),
      generatedRouteTree: path.resolve(import.meta.dirname, "./src/routeTree.gen.ts"),
    }),
    // React Compiler（oxc 版）
    react({ compiler: true }),
    tailwindcss(),
  ],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: { port: 5173 },
  test: {
    // 純元件測試：用 jsdom 的 DOM 語意（移除聚焦中的元素「不會」觸發 blur、
    // 焦點移動才會），這正是本檔要鎖住的 skipBlur 行為所依賴的前提。
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // 不需要真的處理 Tailwind CSS，省掉每個測試檔的編譯成本
    css: false,
  },
});
