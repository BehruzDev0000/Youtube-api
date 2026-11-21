FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY nest-cli.json tsconfig*.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates && rm -rf /var/lib/apt/lists/* && pip3 install --break-system-packages --no-cache-dir 'yt-dlp[pin]==2026.10.26'
WORKDIR /app
ENV NODE_ENV=production PORT=3003
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3003
CMD ["node", "dist/main.js"]
