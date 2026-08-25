#!/bin/sh
set -e

# nginx 以 daemon 方式退到背景，讓 API server 成為 PID 1，
# 這樣容器存活狀態就綁在 API 上：server 掛掉，容器跟著結束（才會被 restart policy 接手）。
nginx

# 直接用 bun 執行，不透過 pnpm。
#
# 為什麼不是 `pnpm run start`：pnpm 跑 script 前會驗證 node_modules 與 lockfile 是否同步、
# 並向 registry 查驗供應鏈政策（實測每次啟動多花約 7 秒且需要外網）。
# 而 `pnpm run start` 追到底也只是執行 `bun src/index.ts`，這裡直接跑它。
# 現在 runtime 映像檔裡根本沒有裝 pnpm。
exec bun src/index.ts
