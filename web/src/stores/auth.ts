import type { AuthPayload, PublicUser } from "@todos/shared";
import { create } from "zustand";
import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from "@/lib/cookies";

interface AuthState {
  user: PublicUser | null;
  isAuthenticated: boolean;
  /** 登入 / 註冊成功後呼叫：寫入 cookie 並更新 store */
  setAuth: (payload: AuthPayload) => void;
  /** 登出：清掉 access + refresh cookie 並重設 store */
  logout: () => void;
}

/**
 * 初始狀態直接看 cookie：重新整理後只要 token 還在就視為已登入，
 * access token 過期會由 trpc 的 authLink 自動換發。
 */
function hasStoredSession() {
  return getAccessToken() !== null || getRefreshToken() !== null;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: hasStoredSession(),

  setAuth: (payload) => {
    setAuthCookies({ accessToken: payload.accessToken, refreshToken: payload.refreshToken });
    set({ user: payload.user, isAuthenticated: true });
  },

  logout: () => {
    clearAuthCookies();
    set({ user: null, isAuthenticated: false });
  },
}));

/** 供非 React 環境（例如 trpc link）使用 */
export const authStore = useAuthStore;
