# syntax=docker/dockerfile:1

##############################
# Base con pnpm via corepack
##############################
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# Store fijo: sin esto pnpm lo reubica bajo /app al entrar por el bind mount y
# deja de reconocer el node_modules que instaló la imagen.
ENV npm_config_store_dir=/pnpm/store
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

##############################
# Dependencias (capa cacheada)
##############################
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

##############################
# Desarrollo — HMR con bind mount
##############################
FROM base AS dev
ENV NODE_ENV=development
# Los watchers inotify no ven los cambios a través del bind mount de Windows.
ENV WATCHPACK_POLLING=true
ENV CHOKIDAR_USEPOLLING=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]

##############################
# Build de producción
##############################
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

##############################
# Runtime de producción (standalone, ~150MB)
##############################
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
