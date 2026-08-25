import { defineConfig } from "vite-plus";

/**
 * monorepo 根層的 Vite+ 設定：集中管理 lint / fmt。
 * 前端的建置設定（React Compiler、Tailwind、TanStack Router）在 web/vite.config.ts。
 */
export default defineConfig({
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    plugins: ["react", "typescript", "import"],
    categories: { correctness: "error", suspicious: "warn" },
    env: { browser: true, es2024: true },
    ignorePatterns: [
      "data/**",
      "**/dist/**",
      "web/src/routeTree.gen.ts",
      // shadcn/ui 是外部產生的 vendor 程式碼，不套自家 lint 規則
      "web/src/components/ui/**",
    ],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "no-console": "off",
      // React 19 用 automatic JSX runtime，不需要把 React 帶進 scope
      "react/react-in-jsx-scope": "off",
      // 副作用 import（CSS、dotenv 載入）本來就不該有回傳值
      "import/no-unassigned-import": "off",
    },
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    ignorePatterns: ["data/**", "**/dist/**", "web/src/routeTree.gen.ts", "pnpm-lock.yaml"],
  },
});
