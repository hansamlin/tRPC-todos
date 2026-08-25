/**
 * 端對端煙霧測試（用 bun 跑，可重複執行）。
 *
 *   bun scripts/smoke.ts
 *   BASE_URL=http://localhost:3000 bun scripts/smoke.ts
 *
 * 每次執行都用時間戳產生新的 email，所以重跑不會撞到「重複註冊」。
 * 情境 7（過期換發）只在偵測到 access token TTL <= 5 秒時執行，
 * 也就是 server 需以 ACCESS_TOKEN_TTL=1s 啟動；否則自動跳過並註明。
 */

const BASE_URL = process.env.SMOKE_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3000";
const TRPC = `${BASE_URL}/trpc`;

interface TrpcResult<T> {
  status: number;
  /** tRPC 錯誤碼，例如 UNAUTHORIZED / CONFLICT / NOT_FOUND / BAD_REQUEST */
  errorCode: string | null;
  message: string | null;
  data: T | null;
  raw: string;
}

async function call<T>(
  path: string,
  options: { method: "GET" | "POST"; input?: unknown; token?: string },
): Promise<TrpcResult<T>> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.token) headers.authorization = `Bearer ${options.token}`;

  const url =
    options.method === "GET" && options.input !== undefined
      ? `${TRPC}/${path}?input=${encodeURIComponent(JSON.stringify(options.input))}`
      : `${TRPC}/${path}`;

  const response = await fetch(url, {
    method: options.method,
    headers,
    body: options.method === "POST" ? JSON.stringify(options.input ?? {}) : undefined,
  });

  const raw = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  const body = parsed as {
    result?: { data?: T };
    error?: { message?: string; data?: { code?: string } };
  } | null;

  return {
    status: response.status,
    errorCode: body?.error?.data?.code ?? null,
    message: body?.error?.message ?? null,
    data: body?.result?.data ?? null,
    raw,
  };
}

let failures = 0;

function report(scenario: string, ok: boolean, detail: string): void {
  if (!ok) failures += 1;
  console.log(`\n[${ok ? "PASS" : "FAIL"}] ${scenario}`);
  console.log(detail);
}

function short(value: string, max = 220): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** 從 JWT payload 讀 exp - iat，用來判斷 server 目前的 access TTL */
function tokenTtlSeconds(token: string): number | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const payload = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as {
      exp?: number;
      iat?: number;
    };
    if (typeof payload.exp !== "number" || typeof payload.iat !== "number") return null;
    return payload.exp - payload.iat;
  } catch {
    return null;
  }
}

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

interface AuthPayloadLike {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; createdAt: string };
}

interface TodoLike {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

async function main(): Promise<void> {
  const stamp = Date.now();
  const emailA = `smoke-a-${stamp}@example.com`;
  const emailB = `smoke-b-${stamp}@example.com`;
  const password = "SmokeTest!1";

  // --- 0. health ---
  const health = await fetch(`${BASE_URL}/health`);
  report(
    "0. GET /health",
    health.status === 200,
    `status=${health.status} body=${await health.text()}`,
  );

  // --- 1. 註冊成功 ---
  const register = await call<AuthPayloadLike>("auth.register", {
    method: "POST",
    input: { email: emailA, password },
  });
  const registered = Boolean(register.data?.accessToken && register.data?.refreshToken);
  report(
    "1. auth.register 成功並回 access + refresh token",
    register.status === 200 && registered,
    `status=${register.status}\nuser=${JSON.stringify(register.data?.user)}\n` +
      `accessToken=${short(register.data?.accessToken ?? "(none)", 60)}\n` +
      `refreshToken=${short(register.data?.refreshToken ?? "(none)", 60)}\n` +
      `hasPasswordHash=${register.raw.includes("passwordHash")}`,
  );
  if (!register.data) {
    console.log("\n註冊失敗，後續情境無法進行。");
    process.exit(1);
  }
  let { accessToken, refreshToken } = register.data;

  // 情境 7 會把 ACCESS_TOKEN_TTL 設成 1s，此時 token 可能在測試跑到一半就過期。
  // 因此凡是「需要 A 的有效 access token」的地方，短 TTL 模式下都臨時重新登入取得，
  // 以免測到的是 token 過期，而不是該情境本身。
  const accessTtlSeconds = tokenTtlSeconds(accessToken);
  const shortTtl = accessTtlSeconds !== null && accessTtlSeconds <= 5;

  async function accessTokenA(): Promise<string> {
    if (!shortTtl) return accessToken;
    const relogin = await call<AuthPayloadLike>("auth.login", {
      method: "POST",
      input: { email: emailA, password },
    });
    return relogin.data?.accessToken ?? accessToken;
  }

  // --- 2. 重複註冊 → CONFLICT ---
  const duplicate = await call("auth.register", {
    method: "POST",
    input: { email: emailA.toUpperCase(), password },
  });
  report(
    "2. 重複註冊（故意用大寫 email 測正規化）→ CONFLICT",
    duplicate.errorCode === "CONFLICT",
    `status=${duplicate.status} code=${duplicate.errorCode}\nraw=${short(duplicate.raw)}`,
  );

  // --- 3. 弱密碼 → 驗證錯誤 ---
  const weak = await call("auth.register", {
    method: "POST",
    input: { email: `weak-${stamp}@example.com`, password: "abc" },
  });
  report(
    "3. 弱密碼註冊 → BAD_REQUEST（zod 驗證錯誤）",
    weak.errorCode === "BAD_REQUEST",
    `status=${weak.status} code=${weak.errorCode}\nraw=${short(weak.raw, 400)}`,
  );

  // --- 4. login ---
  const login = await call<AuthPayloadLike>("auth.login", {
    method: "POST",
    input: { email: emailA, password },
  });
  report(
    "4a. auth.login 正確帳密 → 成功",
    login.status === 200 && Boolean(login.data?.accessToken),
    `status=${login.status} user=${JSON.stringify(login.data?.user)}`,
  );

  const badPassword = await call("auth.login", {
    method: "POST",
    input: { email: emailA, password: "WrongPass!9" },
  });
  const noSuchUser = await call("auth.login", {
    method: "POST",
    input: { email: `ghost-${stamp}@example.com`, password },
  });
  report(
    "4b. 錯密碼 / 帳號不存在 → 都是 UNAUTHORIZED + INVALID_CREDENTIALS（不洩漏帳號是否存在）",
    badPassword.errorCode === "UNAUTHORIZED" &&
      badPassword.message === "INVALID_CREDENTIALS" &&
      noSuchUser.errorCode === "UNAUTHORIZED" &&
      noSuchUser.message === "INVALID_CREDENTIALS",
    `錯密碼:     status=${badPassword.status} code=${badPassword.errorCode} message=${badPassword.message}\n` +
      `帳號不存在: status=${noSuchUser.status} code=${noSuchUser.errorCode} message=${noSuchUser.message}`,
  );

  // --- 5. 帶 token 的 todo CRUD ---
  const tokenForCrud = await accessTokenA();
  const created = await call<TodoLike>("todo.create", {
    method: "POST",
    input: { title: "  買牛奶  " },
    token: tokenForCrud,
  });
  const todoId = created.data?.id ?? "";
  const listAfterCreate = await call<TodoLike[]>("todo.list", {
    method: "GET",
    token: tokenForCrud,
  });
  const updated = await call<TodoLike>("todo.update", {
    method: "POST",
    input: { id: todoId, completed: true, title: "買牛奶與麵包" },
    token: tokenForCrud,
  });
  const me = await call<{ id: string; email: string }>("auth.me", {
    method: "GET",
    token: tokenForCrud,
  });
  report(
    "5. 帶 Authorization 呼叫 todo.create / list / update 與 auth.me",
    created.status === 200 &&
      created.data?.title === "買牛奶" &&
      listAfterCreate.data?.length === 1 &&
      updated.data?.completed === true &&
      me.data?.email === emailA,
    `create: ${created.raw}\nlist:   ${listAfterCreate.raw}\nupdate: ${updated.raw}\nme:     ${me.raw}`,
  );

  // --- 5b. list 排序：createdAt 由新到舊 ---
  // 前面的情境 list 只有 0~1 筆，驗不到排序；這裡刻意多建兩筆才測得出 desc()。
  const extraIds: string[] = [];
  for (const title of ["第二筆", "第三筆"]) {
    await sleep(50); // 錯開 created_at，避免兩筆時間戳相同導致排序不可判定
    const extra = await call<TodoLike>("todo.create", {
      method: "POST",
      input: { title },
      // 每次呼叫前才取 token：ACCESS_TOKEN_TTL=1s 時，跨越 sleep 重用同一顆 token 會過期，
      // 讓這個情境變成在測 token 效期而不是排序。
      token: await accessTokenA(),
    });
    if (extra.data) extraIds.push(extra.data.id);
  }

  const ordered = await call<TodoLike[]>("todo.list", {
    method: "GET",
    token: await accessTokenA(),
  });
  const rows = ordered.data ?? [];
  let sortedDesc = true;
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1];
    const current = rows[i];
    if (!prev || !current) continue;
    if (Date.parse(prev.createdAt) < Date.parse(current.createdAt)) sortedDesc = false;
  }
  const newestId = extraIds[extraIds.length - 1];

  report(
    "5b. todo.list 依 createdAt 由新到舊排序",
    rows.length === 3 &&
      extraIds.length === 2 &&
      sortedDesc &&
      Boolean(newestId) &&
      rows[0]?.id === newestId,
    `筆數=${rows.length} 排序遞減=${sortedDesc} 最新一筆在索引 0=${rows[0]?.id === newestId}\n` +
      rows.map((row, i) => `  [${i}] ${row.createdAt}  ${row.title}`).join("\n"),
  );

  // 刪掉多建的兩筆，讓後續情境維持「A 只有 1 筆」的前提，也保持腳本可重複執行
  for (const id of extraIds) {
    await call("todo.delete", { method: "POST", input: { id }, token: await accessTokenA() });
  }

  // --- 6. 不帶 token → UNAUTHORIZED ---
  const anonymous = await call("todo.list", { method: "GET" });
  const bogusToken = await call("todo.list", { method: "GET", token: "not-a-real-token" });
  const refreshAsAccess = await call("todo.list", { method: "GET", token: refreshToken });
  report(
    "6. 不帶 token / 亂給 token / 拿 refresh token 當 access → 都是 UNAUTHORIZED",
    anonymous.errorCode === "UNAUTHORIZED" &&
      bogusToken.errorCode === "UNAUTHORIZED" &&
      refreshAsAccess.errorCode === "UNAUTHORIZED",
    `無 token:          status=${anonymous.status} code=${anonymous.errorCode}\n` +
      `亂給 token:        status=${bogusToken.status} code=${bogusToken.errorCode}\n` +
      `refresh 當 access: status=${refreshAsAccess.status} code=${refreshAsAccess.errorCode}`,
  );

  // --- 7. 過期換發（需 server 以 ACCESS_TOKEN_TTL=1s 啟動）---
  const ttl = accessTtlSeconds;
  if (shortTtl && ttl !== null) {
    console.log(`\n偵測到 access token TTL = ${ttl}s，執行過期換發情境…`);
    await sleep((ttl + 1) * 1000);

    const expired = await call("todo.list", { method: "GET", token: accessToken });
    const refreshed = await call<{ accessToken: string; refreshToken: string }>("auth.refresh", {
      method: "POST",
      input: { refreshToken },
    });
    const rotatedAccess = refreshed.data?.accessToken ?? "";
    const rotatedRefresh = refreshed.data?.refreshToken ?? "";
    const afterRefresh = await call<TodoLike[]>("todo.list", {
      method: "GET",
      token: rotatedAccess,
    });
    const badRefresh = await call("auth.refresh", {
      method: "POST",
      input: { refreshToken: accessToken },
    });

    report(
      "7. access token 過期 → UNAUTHORIZED → auth.refresh 換新 → 再呼叫成功",
      expired.errorCode === "UNAUTHORIZED" &&
        Boolean(rotatedAccess) &&
        Boolean(rotatedRefresh) &&
        rotatedAccess !== accessToken &&
        afterRefresh.status === 200 &&
        badRefresh.errorCode === "UNAUTHORIZED",
      `過期後 todo.list:   status=${expired.status} code=${expired.errorCode}\n` +
        `auth.refresh:       status=${refreshed.status} 新 access=${short(rotatedAccess, 50)}\n` +
        `                    新 refresh=${short(rotatedRefresh, 50)}\n` +
        `                    access 有換新=${rotatedAccess !== accessToken} refresh 有換新=${rotatedRefresh !== refreshToken}\n` +
        `換新後 todo.list:   status=${afterRefresh.status} 筆數=${afterRefresh.data?.length}\n` +
        `拿 access 當 refresh: status=${badRefresh.status} code=${badRefresh.errorCode}`,
    );

    if (rotatedAccess) accessToken = rotatedAccess;
    if (rotatedRefresh) refreshToken = rotatedRefresh;
  } else {
    console.log(
      `\n[SKIP] 7. 過期換發 —— 目前 access token TTL = ${ttl ?? "?"}s，` +
        "需以 ACCESS_TOKEN_TTL=1s 重啟 server 才會執行此情境。",
    );
  }

  // --- 8. 跨使用者隔離 ---
  const registerB = await call<AuthPayloadLike>("auth.register", {
    method: "POST",
    input: { email: emailB, password },
  });
  const tokenB = registerB.data?.accessToken ?? "";

  const crossUpdate = await call("todo.update", {
    method: "POST",
    input: { id: todoId, completed: false },
    token: tokenB,
  });
  const crossDelete = await call("todo.delete", {
    method: "POST",
    input: { id: todoId },
    token: tokenB,
  });
  const listB = await call<TodoLike[]>("todo.list", { method: "GET", token: tokenB });
  const listAStillThere = await call<TodoLike[]>("todo.list", {
    method: "GET",
    token: await accessTokenA(),
  });

  report(
    "8. 跨使用者隔離：B 動 A 的 todo → NOT_FOUND，且 A 的資料未受影響",
    crossUpdate.errorCode === "NOT_FOUND" &&
      crossDelete.errorCode === "NOT_FOUND" &&
      listB.data?.length === 0 &&
      listAStillThere.data?.length === 1 &&
      listAStillThere.data[0]?.completed === true,
    `B update A 的 todo: status=${crossUpdate.status} code=${crossUpdate.errorCode}\n` +
      `B delete A 的 todo: status=${crossDelete.status} code=${crossDelete.errorCode}\n` +
      `B 的 list:          ${listB.raw}\n` +
      `A 的 list（應原封不動）: ${listAStillThere.raw}`,
  );

  // --- 9. A 自己刪得掉（收尾，順便把測試資料清掉）---
  const ownDelete = await call<{ id: string }>("todo.delete", {
    method: "POST",
    input: { id: todoId },
    token: await accessTokenA(),
  });
  report(
    "9. A 刪自己的 todo → 成功回 { id }",
    ownDelete.status === 200 && ownDelete.data?.id === todoId,
    `status=${ownDelete.status} raw=${ownDelete.raw}`,
  );

  // --- 10. CORS preflight ---
  const preflight = await fetch(`${TRPC}/todo.list`, {
    method: "OPTIONS",
    headers: {
      origin: "http://localhost:5173",
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization, content-type",
    },
  });
  const allowOrigin = preflight.headers.get("access-control-allow-origin");
  const allowHeaders = preflight.headers.get("access-control-allow-headers") ?? "";
  report(
    "10. CORS preflight（OPTIONS）",
    (preflight.status === 204 || preflight.status === 200) &&
      allowOrigin === "http://localhost:5173" &&
      allowHeaders.includes("authorization") &&
      allowHeaders.includes("content-type"),
    `status=${preflight.status}\nallow-origin=${allowOrigin}\nallow-headers=${allowHeaders}\n` +
      `allow-methods=${preflight.headers.get("access-control-allow-methods")}`,
  );

  console.log(`\n${"=".repeat(60)}`);
  console.log(failures === 0 ? "全部情境通過。" : `有 ${failures} 個情境失敗。`);
  process.exit(failures === 0 ? 0 : 1);
}

await main();
