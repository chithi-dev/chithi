FROM node:26-alpine AS builder
WORKDIR /app

# Stage 1: install dev deps (needed for the build toolchain) and build.
COPY package*.json .
COPY .npmrc .
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: install only production deps for the runtime image.
# A clean --omit=dev install is safer than `npm prune --production`, which can
# drop packages the runtime actually imports (e.g. @apollo/client's peer rxjs).
RUN npm ci --omit=dev

FROM node:26-alpine
WORKDIR /app
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .
EXPOSE 3000
ENV NODE_ENV=production
CMD [ "node", "build" ]
