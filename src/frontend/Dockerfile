FROM node:25-alpine AS builder
WORKDIR /app
COPY package*.json .
COPY .npmrc .
RUN npm i
COPY . .
# Read version from GIT
RUN apk add --no-cache git
RUN npm run build:node
RUN npm prune --production
# Remove git
RUN rm -rf .git


FROM node:25-alpine
WORKDIR /app
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .
EXPOSE 3000
ENV NODE_ENV=production
CMD [ "node", "build" ]