import type { AppRouter } from "@todos/server/router";
import { createTRPCClient, httpBatchLink, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from "@/lib/cookies";
import { authStore } from "@/stores/auth";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000/trpc";

/** auth.refresh 本身是 public procedure，絕對不能讓它再觸發一次 refresh（會無限遞迴） */
const REFRESH_PATH = "auth.refresh";

/**
 * single-flight 鎖：同一時間只允許一個 refresh 在飛。
 * 多個請求同時收到 401 時全部等待同一個 promise，避免打爆 server 也避免 refresh token 競態失效。
 */
let refreshInFlight: Promise<boolean> | null = null;

/**
 * 取出 tRPC 錯誤碼。用 duck typing 而非 instanceof，
 * 因為錯誤可能來自不同的 @trpc/client 實例（batch 拆解後重建）。
 */
function extractErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidates = [
    (error as { data?: unknown }).data,
    (error as { shape?: { data?: unknown } }).shape?.data,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "object" && candidate !== null) {
      const code = (candidate as { code?: unknown }).code;
      if (typeof code === "string") return code;
    }
  }
  return undefined;
}

function isUnauthorized(error: unknown): boolean {
  if (extractErrorCode(error) === "UNAUTHORIZED") return true;
  // 保險：某些情況只拿得到 HTTP response
  if (typeof error !== "object" || error === null) return false;
  const response = (error as { meta?: Record<string, unknown> }).meta?.["response"];
  return response instanceof Response && response.status === 401;
}

/** refresh 徹底失敗：清 cookie、清 store、導回登入頁 */
function forceLogout() {
  clearAuthCookies();
  authStore.getState().logout();
  if (globalThis.location.pathname !== "/login") {
    globalThis.location.href = "/login";
  }
}

async function requestNewTokens(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (refreshToken === null) {
    forceLogout();
    return false;
  }
  try {
    const tokens = await trpc.auth.refresh.mutate({ refreshToken });
    setAuthCookies(tokens);
    return true;
  } catch {
    forceLogout();
    return false;
  }
}

function refreshTokens(): Promise<boolean> {
  refreshInFlight ??= requestNewTokens().finally(() => {
    // 一定要在 settle 後解鎖，否則失敗一次之後所有 401 都會被舊 promise 短路
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/**
 * 收到 UNAUTHORIZED 時自動換發 token，並「重試原本那一次呼叫一次」。
 * 重試時 httpBatchLink 的 headers() 會重新讀 cookie，因此自然帶上新的 access token。
 */
const authRefreshLink: TRPCLink<AppRouter> = () => {
  return ({ op, next }) =>
    observable((observer) => {
      let retried = false;
      let cancelled = false;
      let subscription: { unsubscribe: () => void } | null = null;

      const run = () => {
        subscription = next(op).subscribe({
          next: (value) => {
            observer.next(value);
          },
          error: (error) => {
            if (retried || op.path === REFRESH_PATH || !isUnauthorized(error)) {
              observer.error(error);
              return;
            }
            retried = true;
            void refreshTokens().then((refreshed) => {
              if (cancelled) return;
              if (refreshed) {
                run();
              } else {
                observer.error(error);
              }
            });
          },
          complete: () => {
            observer.complete();
          },
        });
      };

      run();

      return () => {
        cancelled = true;
        subscription?.unsubscribe();
      };
    });
};

export const trpc = createTRPCClient<AppRouter>({
  links: [
    authRefreshLink,
    httpBatchLink({
      url: API_URL,
      headers() {
        const accessToken = getAccessToken();
        return accessToken === null ? {} : { Authorization: `Bearer ${accessToken}` };
      },
    }),
  ],
});

/** 供頁面顯示錯誤訊息用：把 tRPC 錯誤轉成可讀中文 */
export function toErrorMessage(error: unknown, fallback = "發生未知錯誤，請稍後再試"): string {
  const code = extractErrorCode(error);
  if (code === "CONFLICT") return "此 Email 已被註冊";
  if (code === "UNAUTHORIZED") return "Email 或密碼錯誤";
  if (code === "NOT_FOUND") return "找不到這筆待辦，可能已被刪除";
  if (error instanceof Error && error.message !== "") {
    if (error.message.includes("Failed to fetch")) return "無法連線到伺服器，請確認 API 是否啟動";
    return error.message;
  }
  return fallback;
}

export { extractErrorCode };
