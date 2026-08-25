import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { env } from "./env";
import { appRouter } from "./router";
import { createContext } from "./trpc";

/** 此檔是唯一允許使用 Bun 專屬 API 的地方（見 router.ts 的說明） */

const TRPC_ENDPOINT = "/trpc";

const corsHeaders: Record<string, string> = {
  "access-control-allow-origin": env.CORS_ORIGIN,
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-credentials": "true",
  "access-control-max-age": "86400",
  vary: "Origin",
};

/** CORS header 必須落在「每一個」回應上，包含 tRPC 回應、/health 與 preflight */
function withCors(response: Response): Response {
  const merged = new Response(response.body, response);
  for (const [key, value] of Object.entries(corsHeaders)) {
    merged.headers.set(key, value);
  }
  return merged;
}

const server = Bun.serve({
  port: env.PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // preflight
    if (req.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    if (url.pathname === "/health") {
      return withCors(Response.json({ ok: true }));
    }

    if (url.pathname === TRPC_ENDPOINT || url.pathname.startsWith(`${TRPC_ENDPOINT}/`)) {
      const response = await fetchRequestHandler({
        endpoint: TRPC_ENDPOINT,
        req,
        router: appRouter,
        createContext,
      });
      return withCors(response);
    }

    return withCors(new Response("Not Found", { status: 404 }));
  },
});

console.log(
  `[server] 已啟動 http://localhost:${server.port}${TRPC_ENDPOINT}（CORS: ${env.CORS_ORIGIN}）`,
);
