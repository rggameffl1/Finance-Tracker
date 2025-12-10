# {{CODE-Cycle-Integration:
#   Task_ID: #Docker-001
#   Timestamp: 2025-12-10
#   Phase: D-Develop
#   Context-Analysis: "Docker 配置 - 处理 better-sqlite3 原生模块编译"
#   Principle_Applied: "Multi-stage build, Security, Optimization"
# }}

# ============================================
# Stage 1: Builder - 编译原生模块
# ============================================
FROM node:20-alpine AS builder

# 安装编译 better-sqlite3 所需的依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    libc-dev

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装所有依赖（包括开发依赖，用于编译）
RUN npm ci --build-from-source

# ============================================
# Stage 2: Production - 生产环境镜像
# ============================================
FROM node:20-alpine AS production

# 安装运行时依赖
RUN apk add --no-cache \
    # better-sqlite3 运行时需要
    libstdc++ \
    # 时区支持
    tzdata

# 设置时区为上海
ENV TZ=Asia/Shanghai

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# 从 builder 阶段复制 node_modules
COPY --from=builder /app/node_modules ./node_modules

# 复制应用代码
COPY --chown=nodejs:nodejs . .

# 创建数据目录并设置权限
RUN mkdir -p /app/database && \
    chown -R nodejs:nodejs /app/database

# 切换到非 root 用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 启动命令
CMD ["sh", "-c", "node database/init.js && node server.js"]