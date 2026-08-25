import type { AppRouter } from "@todos/server/router";
import { createTRPCContext } from "@trpc/tanstack-react-query";

/**
 * @trpc/tanstack-react-query 的 React context。
 * 單獨放一個檔案（而不是塞進 lib/trpc.ts），
 * 避免同一個模組同時匯出元件與非元件而讓 Vite 退回整頁重載。
 */
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
