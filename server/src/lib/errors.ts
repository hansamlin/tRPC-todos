/** postgres 的 unique_violation 錯誤碼 */
const UNIQUE_VIOLATION = "23505";

function readCode(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const code = (value as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * 判斷是否為 unique constraint 衝突。
 * drizzle-orm 可能把 postgres.js 的原始錯誤包在 cause 裡，
 * 所以要沿著 cause 鏈往下找，不能只看最外層。
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current !== undefined && current !== null; depth += 1) {
    if (readCode(current) === UNIQUE_VIOLATION) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
