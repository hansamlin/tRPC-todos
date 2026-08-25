import { defineConfig } from "vite-plus";

/** monorepo 根層的 Vite+ 設定：只負責 fmt / lint 的範圍，前端建置設定在 web/vite.config.ts */
export default defineConfig({
  fmt: {
    ignorePatterns: ["data/**", "**/dist/**", "web/src/routeTree.gen.ts", "pnpm-lock.yaml"],
  },
});
