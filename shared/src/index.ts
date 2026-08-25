import { z } from 'zod';

/**
 * 前後端共用的驗證規則。
 * 註冊 / 登入 / Todo 的 schema 只在這裡定義一次，避免兩端規則悄悄分歧。
 */

/** email 一律 trim + 轉小寫，避免同一個帳號用大小寫差異重複註冊 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { message: '請輸入 Email' })
  .pipe(z.email({ message: 'Email 格式不正確' }));

/** 註冊用的強密碼規則：至少 8 碼，大寫、小寫、符號各至少 1 個（規格未要求數字） */
export const strongPasswordSchema = z
  .string()
  .min(8, { message: '密碼至少 8 碼' })
  .refine((value) => /[A-Z]/.test(value), { message: '密碼需包含至少 1 個大寫字母' })
  .refine((value) => /[a-z]/.test(value), { message: '密碼需包含至少 1 個小寫字母' })
  .refine((value) => /[^A-Za-z0-9]/.test(value), { message: '密碼需包含至少 1 個符號' });

export const registerInputSchema = z.object({
  email: emailSchema,
  password: strongPasswordSchema,
});

/**
 * 登入只檢查「帳號密碼都有填」——不可套用強密碼規則，
 * 否則舊帳號或不符新規則的密碼會連送出都無法送出。
 */
export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: '請輸入密碼' }),
});

export const refreshInputSchema = z.object({
  refreshToken: z.string().min(1),
});

export const todoTitleSchema = z
  .string()
  .trim()
  .min(1, { message: '請輸入待辦內容' })
  .max(200, { message: '待辦內容最多 200 字' });

export const createTodoInputSchema = z.object({
  title: todoTitleSchema,
});

export const updateTodoInputSchema = z
  .object({
    id: z.uuid(),
    title: todoTitleSchema.optional(),
    completed: z.boolean().optional(),
  })
  .refine((value) => value.title !== undefined || value.completed !== undefined, {
    message: '沒有要更新的欄位',
  });

export const deleteTodoInputSchema = z.object({
  id: z.uuid(),
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type CreateTodoInput = z.infer<typeof createTodoInputSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoInputSchema>;
export type DeleteTodoInput = z.infer<typeof deleteTodoInputSchema>;

export interface PublicUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthPayload extends AuthTokens {
  user: PublicUser;
}

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 刪除彈窗必須輸入的確認字串 */
export const DELETE_CONFIRMATION_WORD = 'delete';
