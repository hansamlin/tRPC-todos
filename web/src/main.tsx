import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { queryClient } from "@/lib/query-client";
import { initTheme } from "@/lib/theme";
import { trpc } from "@/lib/trpc";
import { TRPCProvider } from "@/lib/trpc-react";
import { routeTree } from "./routeTree.gen";

initTheme();

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("找不到 #root 節點");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* trpc 仍是原本那顆 vanilla client（含 single-flight 換發 link），只是改由 React Query 驅動 */}
      <TRPCProvider queryClient={queryClient} trpcClient={trpc}>
        <RouterProvider router={router} />
      </TRPCProvider>
    </QueryClientProvider>
  </StrictMode>,
);
