import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

/** postgres.js 連線池；整個程序共用一份 */
export const sql = postgres(env.DATABASE_URL);

export const db = drizzle(sql, { schema });
