# ---- Builder ----
FROM node:25-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy only lock + manifest first (better caching)
COPY package.json pnpm-lock.yaml .npmrc ./

# Install deps 
RUN pnpm install

# Copy rest of source
COPY . .

# Build
RUN pnpm build

# Prune dev deps
RUN pnpm prune --prod


# ---- Runner ----
FROM node:25-alpine

WORKDIR /app

# Copy only what's needed
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/package.json package.json

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "build"]
