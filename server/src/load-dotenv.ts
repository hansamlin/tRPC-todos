import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 只給 drizzle-kit 用的 .env 載入器（副作用模組）。
 *
 * 一般啟動走 `bun --env-file=../.env`，不需要這支；
 * 但 drizzle-kit 是在自己的子行程裡評估 drizzle.config.ts，
 * 那個行程拿不到 bun --env-file 注入的變數（實測 process.env 內只剩 PATH 類），
 * 所以設定檔要自己把根目錄的 .env 讀進來。
 *
 * ⚠️ 不可被 src/router.ts 的 import 鏈引用（會把 node:fs 帶進前端的 TS program）。
 */
const ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../.env");

function loadDotenv(path: string): void {
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    // 已存在的環境變數優先，不覆蓋外部注入的值（例如 CI 或 ACCESS_TOKEN_TTL=1s 覆寫）
    if (process.env[key] !== undefined) continue;

    let value = line.slice(separator + 1).trim();
    if (value.length >= 2 && (value.startsWith('"') || value.startsWith("'"))) {
      const quote = value.charAt(0);
      if (value.endsWith(quote)) value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotenv(ENV_PATH);
