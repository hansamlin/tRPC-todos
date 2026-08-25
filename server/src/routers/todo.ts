import { TRPCError } from "@trpc/server";
import type { Todo } from "@todos/shared";
import { createTodoInputSchema, deleteTodoInputSchema, updateTodoInputSchema } from "@todos/shared";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { todos } from "../db/schema";
import { toTodo } from "../lib/mappers";
import { protectedProcedure, router } from "../trpc";

/**
 * ⚠️ 每一個查詢 / 更新 / 刪除都必須同時以 userId 過濾。
 * 只用 todo.id 會讓 A 能改到 B 的資料；把 ownership 併進 WHERE，
 * 更新/刪除影響 0 筆就是 NOT_FOUND，一個條件同時涵蓋「不存在」與「不屬於你」。
 */
export const todoRouter = router({
  list: protectedProcedure.query(async ({ ctx }): Promise<Todo[]> => {
    const rows = await db
      .select()
      .from(todos)
      .where(eq(todos.userId, ctx.user.id))
      .orderBy(desc(todos.createdAt));
    return rows.map(toTodo);
  }),

  create: protectedProcedure
    .input(createTodoInputSchema)
    .mutation(async ({ ctx, input }): Promise<Todo> => {
      const [row] = await db
        .insert(todos)
        .values({ userId: ctx.user.id, title: input.title })
        .returning();
      if (!row) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "CREATE_TODO_FAILED" });
      }
      return toTodo(row);
    }),

  update: protectedProcedure
    .input(updateTodoInputSchema)
    .mutation(async ({ ctx, input }): Promise<Todo> => {
      const patch: { title?: string; completed?: boolean; updatedAt: Date } = {
        updatedAt: new Date(),
      };
      if (input.title !== undefined) patch.title = input.title;
      if (input.completed !== undefined) patch.completed = input.completed;

      const [row] = await db
        .update(todos)
        .set(patch)
        .where(and(eq(todos.id, input.id), eq(todos.userId, ctx.user.id)))
        .returning();

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "TODO_NOT_FOUND" });
      }
      return toTodo(row);
    }),

  delete: protectedProcedure
    .input(deleteTodoInputSchema)
    .mutation(async ({ ctx, input }): Promise<{ id: string }> => {
      const [row] = await db
        .delete(todos)
        .where(and(eq(todos.id, input.id), eq(todos.userId, ctx.user.id)))
        .returning({ id: todos.id });

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "TODO_NOT_FOUND" });
      }
      return { id: row.id };
    }),
});
