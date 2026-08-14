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
# El build no consulta la base, pero `next build` evalúa los route handlers para
# recolectar sus datos y src/db valida la variable al importarse. Es un valor de
# relleno: en ejecución lo reemplaza el DATABASE_URL real del entorno. Sin esto
# el build de producción falla al llegar a /api/reportes/mensual.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build
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
# Las migraciones NO corren aquí. El build standalone solo empaqueta lo que la
# aplicación importa —ni tsx ni el ejecutor de migraciones—, y engordar esta
# imagen para poder migrar desperdiciaría lo que la hace pequeña. Corren en un
# servicio aparte, de un solo uso, que usa la etapa `builder`: ver
# docker/compose.prod.yml.
CMD ["node", "server.js"]
