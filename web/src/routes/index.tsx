import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth";

/** 首頁本身不渲染內容，只依登入狀態轉導 */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: useAuthStore.getState().isAuthenticated ? "/todos" : "/login" });
  },
});
