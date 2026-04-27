# Plan C-1: 本地预装 node_modules 和 dist，Docker 层只做 COPY
# 彻底绕开云托管 builder 不稳定的 npm ci 行为。
FROM node:20
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80

# 本地已装好的 production 依赖（包含 cors/express/etc）
COPY package.json package-lock.json ./
COPY node_modules ./node_modules

# 本地已编译的 TS 产物
COPY dist ./dist

# 静态资源（含字体）
COPY public ./public

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:80/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" || exit 1

CMD ["node", "dist/index.js"]
# rebuild trigger 2026-04-27 plan-c1 full-node-modules
