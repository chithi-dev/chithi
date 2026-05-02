# Use a global ARG so it can be shared across stages
ARG NODE_VERSION=25-slim

# Stage 0: Base setup to avoid repeating work
FROM node:${NODE_VERSION} AS base
WORKDIR /app
# Enable corepack for pnpm/yarn management automatically
RUN corepack enable

# ============================================
# Stage 1: Dependencies Installation
# ============================================
FROM base AS dependencies

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./

# Use secret mount for GITHUB_TOKEN and cache mounts for speed
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/usr/local/share/.cache/yarn \
    --mount=type=cache,target=/root/.local/share/pnpm/store \
    --mount=type=secret,id=github_token \
    export GITHUB_TOKEN=$(cat /run/secrets/github_token 2>/dev/null || echo "") && \
    if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
    else echo "No lockfile found." && exit 1; \
    fi

# ============================================
# Stage 2: Build Next.js application
# ============================================
FROM base AS builder

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# CRITICAL: Re-inject secret here if your build script needs to fetch private assets
RUN --mount=type=secret,id=github_token \
    export GITHUB_TOKEN=$(cat /run/secrets/github_token 2>/dev/null || echo "") && \
    if [ -f package-lock.json ]; then npm run build; \
    elif [ -f yarn.lock ]; then yarn build; \
    elif [ -f pnpm-lock.yaml ]; then pnpm build; \
    else echo "No lockfile found." && exit 1; \
    fi

# ============================================
# Stage 3: Run Next.js application
# ============================================
FROM node:${NODE_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Security: Use the built-in 'node' user provided by the official image
RUN mkdir .next && chown node:node .next

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000

CMD ["node", "server.js"]