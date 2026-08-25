// ⚠️ 這行必須排在 './src/env' 之前：ESM 依 import 出現順序求值，
// 先把根目錄 .env 讀進 process.env，env.ts 才驗得過（drizzle-kit 子行程沒有這些變數）。
import "./src/load-dotenv";

import { defineConfig } from "drizzle-kit";
import { env } from "./src/env";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: env.DATABASE_URL },
});
