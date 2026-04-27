# ------------------------------
# Stage 1: builder
# 使用完整 node:20 镜像（非 alpine），避免 alpine 上 typescript/cors 等原生/ESM
# resolve 问题。在构建阶段跑 npm ci + tsc 生成 dist/。
# ------------------------------
FROM node:20 AS builder
WORKDIR /build

# 先只拷 lockfile 和 package.json 以最大化缓存命中
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

# 再拷源码和配置
COPY tsconfig.json ./
COPY src ./src

# 编译 TypeScript 到 dist/
RUN npm run build

# ------------------------------
# Stage 2: runtime
# 同样使用完整 node:20（用户明确选 B，放弃 alpine，换取稳定性）。
# 只装 production 依赖，从 stage 1 拷 dist/，从仓库拷 public/。
# ------------------------------
FROM node:20
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80

# 装 prod 依赖（同样用 lockfile 保证一致性）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# 从 builder 拷编译产物
COPY --from=builder /build/dist ./dist

# 拷静态资源（字体文件所在目录）
COPY public ./public

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:80/api/health || exit 1

CMD ["node", "dist/index.js"]