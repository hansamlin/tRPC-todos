import { authRouter } from "./routers/auth";
import { todoRouter } from "./routers/todo";
import { router } from "./trpc";

/**
 * ⚠️ 這個檔案與它 import 到的所有檔案都不可以使用 Bun 專屬全域（Bun.* / bun:*），
 * 因為 web 會 `import type { AppRouter } from '@todos/server/router'`，
 * 這條 import 鏈會被拉進前端的 TS program。Bun 專屬程式只放在 src/index.ts。
 */
export const appRouter = router({
  auth: authRouter,
  todo: todoRouter,
});

export type AppRouter = typeof appRouter;
