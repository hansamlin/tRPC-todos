# tRPC Todos

一個以 JWT 驗證的 Todo 應用：登入 / 註冊後進入待辦清單，支援新增、行內編輯、完成勾選與二次確認刪除。

## 技術棧

**前端**

- React 19（已開啟 [React Compiler](https://oxc.rs/blog/2026-08-18-react-compiler-support.html)，由 `@vitejs/plugin-react` 的 `compiler: true` + `oxc-transform-react` 提供）
- TanStack Router（file-based routing）
- TanStack Query + `@trpc/tanstack-react-query`（伺服器狀態、樂觀更新）
- shadcn/ui + Tailwind CSS v4
- Zustand（auth 狀態）、zod（驗證）、react-hook-form（表單）

**後端**

- Bun runtime
- tRPC v11（fetch adapter）
- PostgreSQL 17（Docker，資料掛載於 `./data/postgres`）
- Drizzle ORM + postgres.js
- jose（JWT）、@node-rs/argon2（密碼雜湊）

**工具鏈**

- [Vite+](https://viteplus.dev)（`vp`：內建 Vite 8 / oxlint / oxfmt / vitest）
- TypeScript 7（native `tsc`）
- pnpm workspace

## 專案結構

```
.
├── shared/        # 前後端共用的 zod schema 與型別（單一事實來源）
├── server/        # Bun + tRPC + Drizzle
├── web/           # React + TanStack Router + shadcn/ui
├── data/postgres/ # Postgres 資料掛載點（已 gitignore，不進版控）
└── docker-compose.yml
```

## 開始使用

需求：Node 22+、[pnpm](https://pnpm.io) 11、[Bun](https://bun.sh) 1.4+、Docker。

```bash
# 1. 安裝依賴
pnpm install

# 2. 建立環境變數（JWT secret 請自行重新產生）
cp .env.example .env
# 產生 secret: openssl rand -base64 48

# 3. 啟動 Postgres（資料會掛載到 ./data/postgres）
pnpm db:up

# 4. 建立資料表
pnpm db:push

# 5. 同時啟動前後端
pnpm dev
```

- 前端：http://localhost:5173
- 後端：http://localhost:3000（tRPC 掛在 `/trpc`，健康檢查 `GET /health`）

## 可用指令

| 指令                               | 說明                         |
| ---------------------------------- | ---------------------------- |
| `pnpm dev`                         | 同時啟動 server 與 web       |
| `pnpm dev:server` / `pnpm dev:web` | 個別啟動                     |
| `pnpm build`                       | 建置前端                     |
| `pnpm db:up` / `pnpm db:down`      | 啟停 Postgres 容器           |
| `pnpm db:push`                     | 將 Drizzle schema 推到資料庫 |
| `pnpm lint` / `pnpm format`        | oxlint / oxfmt               |
| `pnpm typecheck`                   | 全 workspace 型別檢查        |
| `pnpm check`                       | 格式 + lint + 型別一次跑完   |

## 驗證機制

- 登入 / 註冊成功後由**前端**把 `accessToken`、`refreshToken` 寫入 cookie。
- 需要驗證的 API 一律以 `Authorization: Bearer <accessToken>` 呼叫。
- Access token 效期 1 小時、refresh token 效期 1 天（皆由 `.env` 的 `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` 控制）。
- Access token 過期時，前端會自動以 refresh token 換發新 token 並重試原請求；換發採 single-flight，避免同時多個請求重複換發。
- 登出會清除所有 cookie 與查詢快取，並導回登入頁。
- 密碼以 Argon2id 雜湊後存入資料庫，不以任何形式回傳給前端。

## 待辦清單

新增、勾選完成與刪除都採樂觀更新：畫面立即反映，失敗時自動回滾並顯示錯誤提示。
`QueryClient` 的 `retry` 關閉，讓 401 的重試完全交由 tRPC link 的 single-flight 換發處理，避免兩層重試疊加。

## 密碼規則

註冊密碼至少 8 碼，且需各包含至少 1 個大寫字母、1 個小寫字母、1 個符號。
登入表單僅檢查帳號密碼皆已填寫。

## 授權

MIT
