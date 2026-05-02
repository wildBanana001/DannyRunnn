# 运行时镜像（node_modules 和 dist 均由本地预先构建好打入 zip）
# 云托管 builder 环境的 npm install 行为不可靠（已观测：typescript 装不上、
# cors 装上但 ESM resolve 报错），改为本地装好所有依赖后直接 COPY。
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80

COPY package.json ./
COPY node_modules ./node_modules
COPY dist ./dist
COPY public ./public

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:80/api/health || exit 1

CMD ["node", "dist/index.js"]
