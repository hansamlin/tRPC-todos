import { hash, verify } from "@node-rs/argon2";
import type { Algorithm } from "@node-rs/argon2";

/**
 * @node-rs/argon2 的 `Algorithm` 是 ambient const enum，
 * 在 verbatimModuleSyntax / isolatedModules 下無法當「值」匯入，
 * 因此改以其數值常數表示 Argon2id（見套件 index.d.ts：`Argon2id = 2`）。
 */
const ARGON2ID = 2 as Algorithm;

/** 以 Argon2id 雜湊密碼（回傳含參數與 salt 的 PHC 字串，不需另存 salt） */
export function hashPassword(password: string): Promise<string> {
  return hash(password, { algorithm: ARGON2ID });
}

/**
 * 驗證密碼。雜湊字串損毀時 @node-rs/argon2 會丟例外，
 * 這裡統一收斂成 false，讓呼叫端只需處理「對 / 不對」。
 */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
