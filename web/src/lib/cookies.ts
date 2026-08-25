/**
 * Cookie 讀寫工具。
 * ⚠️ set 與 delete 必須使用「完全相同」的 path，否則刪不掉（瀏覽器會視為不同 cookie）。
 * 全站統一用 path=/。
 */

/** access token 存活 1 小時 */
export const ACCESS_TOKEN_MAX_AGE = 60 * 60;
/** refresh token 存活 1 天 */
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24;

export const ACCESS_TOKEN_COOKIE = "todos_access_token";
export const REFRESH_TOKEN_COOKIE = "todos_refresh_token";

const COOKIE_PATH = "/";

function securityAttributes() {
  // 只有 https 才能加 Secure，否則本機 http 開發會直接寫不進去
  const secure = globalThis.location?.protocol === "https:" ? "; Secure" : "";
  return `; Path=${COOKIE_PATH}; SameSite=Lax${secure}`;
}

export function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${securityAttributes()}; Max-Age=${maxAgeSeconds}`;
}

export function getCookie(name: string): string | null {
  const escaped = encodeURIComponent(name).replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matched = new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`).exec(document.cookie);
  if (matched === null) return null;
  const raw = matched[1];
  if (raw === undefined || raw === "") return null;
  return decodeURIComponent(raw);
}

export function deleteCookie(name: string) {
  // 與 setCookie 相同的 path / SameSite，並把 Max-Age 設為 0 立即失效
  document.cookie = `${encodeURIComponent(name)}=${securityAttributes()}; Max-Age=0`;
}

export function getAccessToken() {
  return getCookie(ACCESS_TOKEN_COOKIE);
}

export function getRefreshToken() {
  return getCookie(REFRESH_TOKEN_COOKIE);
}

export function setAuthCookies(tokens: { accessToken: string; refreshToken: string }) {
  setCookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, ACCESS_TOKEN_MAX_AGE);
  setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, REFRESH_TOKEN_MAX_AGE);
}

export function clearAuthCookies() {
  deleteCookie(ACCESS_TOKEN_COOKIE);
  deleteCookie(REFRESH_TOKEN_COOKIE);
}
