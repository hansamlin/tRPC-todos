import { SignJWT, jwtVerify } from "jose";
import { env } from "../env";

const encoder = new TextEncoder();

/** access 與 refresh 用不同 secret，即使其中一把外洩也無法偽造另一種 token */
const ACCESS_SECRET = encoder.encode(env.JWT_ACCESS_SECRET);
const REFRESH_SECRET = encoder.encode(env.JWT_REFRESH_SECRET);

const ALG = "HS256";

export type TokenType = "access" | "refresh";

export interface TokenClaims {
  /** userId */
  sub: string;
  email: string;
  type: TokenType;
}

export interface TokenSubject {
  id: string;
  email: string;
}

function signToken(
  user: TokenSubject,
  type: TokenType,
  secret: Uint8Array,
  ttl: string,
): Promise<string> {
  return new SignJWT({ email: user.email, type })
    .setProtectedHeader({ alg: ALG })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secret);
}

export function signAccessToken(user: TokenSubject): Promise<string> {
  return signToken(user, "access", ACCESS_SECRET, env.ACCESS_TOKEN_TTL);
}

export function signRefreshToken(user: TokenSubject): Promise<string> {
  return signToken(user, "refresh", REFRESH_SECRET, env.REFRESH_TOKEN_TTL);
}

/**
 * 驗證 token 並確認 type 相符。
 * 一律回傳 null 而非丟例外，讓 createContext 不會把過期 token 變成 500。
 * 檢查 type 是為了擋掉「拿 refresh token 當 access token 用」——
 * 光靠不同 secret 還不夠，因為未來若共用 secret 就會破功。
 */
async function verifyToken(
  token: string,
  expectedType: TokenType,
  secret: Uint8Array,
): Promise<TokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
    const { sub, email, type } = payload;
    if (typeof sub !== "string" || typeof email !== "string" || type !== expectedType) {
      return null;
    }
    return { sub, email, type: expectedType };
  } catch {
    return null;
  }
}

export function verifyAccessToken(token: string): Promise<TokenClaims | null> {
  return verifyToken(token, "access", ACCESS_SECRET);
}

export function verifyRefreshToken(token: string): Promise<TokenClaims | null> {
  return verifyToken(token, "refresh", REFRESH_SECRET);
}

/** 一次簽發成對的 access / refresh token */
export async function issueTokens(user: TokenSubject): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user),
    signRefreshToken(user),
  ]);
  return { accessToken, refreshToken };
}
