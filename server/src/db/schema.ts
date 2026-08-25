import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** 使用者。email 於 DB 層加 unique constraint，重複註冊的競態由 23505 攔截 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 待辦事項。userId 外鍵串接使用者，使用者被刪除時一併級聯刪除 */
export const todos = pgTable(
  "todos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("todos_user_id_idx").on(table.userId)],
);

export type UserRow = typeof users.$inferSelect;
export type TodoRow = typeof todos.$inferSelect;
