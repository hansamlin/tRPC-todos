import { TRPCError } from "@trpc/server";
import type { AuthPayload, AuthTokens, PublicUser } from "@todos/shared";
import { loginInputSchema, refreshInputSchema, registerInputSchema } from "@todos/shared";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { isUniqueViolation } from "../lib/errors";
import { issueTokens, verifyRefreshToken } from "../lib/jwt";
import { toPublicUser } from "../lib/mappers";
import { hashPassword, verifyPassword } from "../lib/password";
import { protectedProcedure, publicProcedure, router } from "../trpc";

/** 帳號不存在與密碼錯誤共用同一個錯誤，避免被拿來探測哪些 email 已註冊 */
function invalidCredentials(): TRPCError {
  return new TRPCError({ code: "UNAUTHORIZED", message: "INVALID_CREDENTIALS" });
}

export const authRouter = router({
  register: publicProcedure
    .input(registerInputSchema)
    .mutation(async ({ input }): Promise<AuthPayload> => {
      // email 已由 shared 的 emailSchema trim + 轉小寫
      const passwordHash = await hashPassword(input.password);

      let row;
      try {
        [row] = await db.insert(users).values({ email: input.email, passwordHash }).returning();
      } catch (error) {
        // 只做應用層預檢會有競態，真正的守門員是 DB 的 unique constraint
        if (isUniqueViolation(error)) {
          throw new TRPCError({ code: "CONFLICT", message: "EMAIL_ALREADY_EXISTS" });
        }
        throw error;
      }

      if (!row) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "REGISTER_FAILED" });
      }

      const tokens = await issueTokens({ id: row.id, email: row.email });
      return { ...tokens, user: toPublicUser(row) };
    }),

  login: publicProcedure
    .input(loginInputSchema)
    .mutation(async ({ input }): Promise<AuthPayload> => {
      const [row] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (!row) {
        throw invalidCredentials();
      }

      const ok = await verifyPassword(row.passwordHash, input.password);
      if (!ok) {
        throw invalidCredentials();
      }

      const tokens = await issueTokens({ id: row.id, email: row.email });
      return { ...tokens, user: toPublicUser(row) };
    }),

  refresh: publicProcedure
    .input(refreshInputSchema)
    .mutation(async ({ input }): Promise<AuthTokens> => {
      const claims = await verifyRefreshToken(input.refreshToken);
      if (!claims) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "INVALID_REFRESH_TOKEN" });
      }

      // token 有效不代表使用者還在，帳號被刪掉就不該再換發
      const [row] = await db.select().from(users).where(eq(users.id, claims.sub)).limit(1);
      if (!row) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "INVALID_REFRESH_TOKEN" });
      }

      // access 與 refresh 一起換新（rotation）
      return await issueTokens({ id: row.id, email: row.email });
    }),

  me: protectedProcedure.query(async ({ ctx }): Promise<PublicUser> => {
    const [row] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!row) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return toPublicUser(row);
  }),
});
