# =============================================================
# 單一容器：nginx 提供前端靜態檔 + 反向代理，bun 跑 tRPC server
# =============================================================

# ---------- builder：安裝依賴、建置前端、產出 server 的部署包 ----------
FROM oven/bun:1.4-alpine AS builder

WORKDIR /app

# 只先複製 manifest，讓依賴這層能被 layer cache 重複使用。
# ⚠️ 每個 workspace 的 package.json 都要複製到「自己的目錄」，
#    因為 COPY 多來源時複製的是目錄「內容」，寫成 shared/ server/ web/ ./ 會全被攤平互相覆蓋。
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/

# 這個映像檔本身沒有 pnpm，用官方安裝腳本裝一個與 package.json 的
# packageManager 欄位相同的版本，避免兩邊版本兜不起來。
# 不用 `bun add -g`：pnpm 12 靠 postinstall 把 native binary 換掉 placeholder，
# 但 Bun 預設會擋 postinstall build script，官方腳本則不受此限制。
RUN PNPM_VERSION="$(bun -e "console.log(require('./package.json').packageManager.split('@')[1])")" && \
    wget -qO- https://get.pnpm.io/install.sh | \
    ENV="$HOME/.shrc" SHELL="$(which sh)" PNPM_VERSION="$PNPM_VERSION" sh -
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME/bin:$PATH"

RUN pnpm install --frozen-lockfile

COPY . .

# VITE_API_URL 是「建置時」就被編進 bundle 的，不是執行時才讀。
# 同容器內走 nginx 反向代理，所以用相對路徑即可，順便免掉 CORS。
ARG VITE_API_URL=/trpc
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm build

# 把 server 打包成可獨立執行的目錄：只含 production 依賴，
# workspace 依賴（@todos/shared）會被實體複製進去，不再是指回 monorepo 的 symlink。
# --legacy：pnpm 10 起預設要求 inject-workspace-packages，用這個旗標維持既有的 symlink 開發體驗。
RUN pnpm deploy --legacy --filter @todos/server --prod /out

# ---------- runtime：nginx + bun（不需要 pnpm） ----------
FROM oven/bun:1.4-alpine

RUN apk add --no-cache nginx
RUN apk add --no-cache openssl

WORKDIR /app

# server 的部署包（package.json / src / node_modules 都在 /out 根層）
COPY --from=builder /out ./

# 前端只帶編譯後的靜態檔，原始碼與建置依賴都留在 builder
COPY --from=builder /app/web/dist /usr/share/nginx/html

# ⚠️ 用 apk 裝的 nginx 讀的是 /etc/nginx/http.d/，不是官方 nginx 映像檔的 /etc/nginx/conf.d/
COPY nginx/default.conf /etc/nginx/http.d/default.conf

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV PORT=3000
ENV CORS_ORIGIN=http://localhost:5173
ENV ACCESS_TOKEN_TTL=1h
ENV REFRESH_TOKEN_TTL=1d

EXPOSE 80

CMD ["/docker-entrypoint.sh"]
