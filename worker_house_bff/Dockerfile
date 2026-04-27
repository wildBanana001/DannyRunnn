# ------------------------------
# Single-stage build (rebuild trigger 2026-04-27 19:10)
# dist/ 已本地编译好并提交 git，这里只装 production 依赖
# 云托管 builder 外层强塞 NODE_ENV=production，无法跑 tsc，所以绕开
# ------------------------------
FROM node:20
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80

# 装 production 依赖
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# 拷编译产物（本地 tsc 输出）
COPY dist ./dist

# 拷静态资源（字体文件）
COPY public ./public

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:80/api/health || exit 1

CMD ["node", "dist/index.js"]