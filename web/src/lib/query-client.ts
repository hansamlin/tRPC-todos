import { QueryClient } from "@tanstack/react-query";

/**
 * 全站共用的 QueryClient。
 *
 * ⚠️ retry 一律關閉。401 的重試由 `lib/trpc.ts` 的 authRefreshLink 負責
 *（single-flight 換發 token 後只重試原本那一次呼叫），
 * React Query 預設的 3 次 query 重試會疊加在 link 層之上，
 * 讓一次 401 變成好幾輪請求、也讓 refresh 被重複觸發。
 * 重構前的程式碼本來就只呼叫一次、完全不重試，關掉 retry 等於維持原本行為。
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    // mutation 預設本來就不重試，這裡明寫一次避免日後被預設值改動影響
    mutations: { retry: false },
  },
});
