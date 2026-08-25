import { TRPCError, initTRPC } from "@trpc/server";
import { verifyAccessToken } from "./lib/jwt";

export interface ContextUser {
  id: string;
  email: string;
}

export interface Context {
  user: ContextUser | null;
}

const BEARER_PREFIX = "Bearer ";

/**
 * 由 Authorization: Bearer <token> 解析目前使用者。
 * ⚠️ 這裡絕對不能丟例外——token 過期若讓例外逸出，
 * tRPC 會把整個請求變成 INTERNAL_SERVER_ERROR，而不是契約要求的 UNAUTHORIZED。
 * 因此無論缺 header、格式錯、簽章錯還是過期，一律回 user: null，
 * 由 protectedProcedure 統一丟 UNAUTHORIZED。
 */
export async function createContext({ req }: { req: Request }): Promise<Context> {
  const header = req.headers.get("authorization");
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    return { user: null };
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (token.length === 0) {
    return { user: null };
  }

  const claims = await verifyAccessToken(token);
  if (!claims) {
    return { user: null };
  }

  return { user: { id: claims.sub, email: claims.email } };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/** 需要登入的 procedure：ctx.user 在下游被收窄成非 null */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { user: ctx.user } });
});
