import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vite-plus/test";

// globals 維持關閉（避免污染 tsconfig 的 types），所以 RTL 的自動 cleanup 不會生效，手動註冊。
afterEach(() => {
  cleanup();
});
