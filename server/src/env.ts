import { z } from "zod";

/**
 * 伺服器環境變數。
 * 一律在啟動時（模組載入時）就驗證完畢，缺值或格式錯誤直接讓程序失敗，
 * 避免跑到一半才發現 JWT secret 是 undefined。
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, { message: "缺少 DATABASE_URL" }),
  PORT: z
    .string()
    .default("3000")
    .transform((value) => Number(value))
    .pipe(z.number().int().positive({ message: "PORT 必須是正整數" })),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  JWT_ACCESS_SECRET: z.string().min(1, { message: "缺少 JWT_ACCESS_SECRET" }),
  JWT_REFRESH_SECRET: z.string().min(1, { message: "缺少 JWT_REFRESH_SECRET" }),
  /** vercel/ms 格式（例如 '1h'、'15m'、'1s'）；驗收要能用 1s 測過期換發，所以不可寫死 */
  ACCESS_TOKEN_TTL: z.string().min(1).default("1h"),
  REFRESH_TOKEN_TTL: z.string().min(1).default("1d"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`環境變數驗證失敗：\n${details}`);
  }
  return parsed.data;
}

export const env = loadEnv();
