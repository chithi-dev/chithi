FROM node:25-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
# Pass PUBLIC_BACKEND_API at build time, e.g.:
#   docker build --build-arg PUBLIC_BACKEND_API=https://api.example.com -t myimage .
ARG PUBLIC_BACKEND_API
ENV PUBLIC_BACKEND_API=${PUBLIC_BACKEND_API}
RUN npm run build:node
RUN npm prune --production

FROM node:25-alpine
WORKDIR /app
ARG PUBLIC_BACKEND_API
ENV PUBLIC_BACKEND_API=${PUBLIC_BACKEND_API}
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .
EXPOSE 3000
ENV NODE_ENV=production
CMD [ "node", "build" ]