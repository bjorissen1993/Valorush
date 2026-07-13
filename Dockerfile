FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite bakes VITE_* into the client bundle at build time. Railway injects service
# variables as Docker build args when declared here (see DEPLOY.md).
ARG VITE_TWITCH_CLIENT_ID
ARG VITE_TWITCH_CLIENT_SECRET
ARG VITE_TWITCH_REDIRECT_URI
ENV VITE_TWITCH_CLIENT_ID=$VITE_TWITCH_CLIENT_ID
ENV VITE_TWITCH_CLIENT_SECRET=$VITE_TWITCH_CLIENT_SECRET
ENV VITE_TWITCH_REDIRECT_URI=$VITE_TWITCH_REDIRECT_URI

RUN node scripts/build-production.mjs

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

# Railway injects PORT at runtime and health-checks via TCP on that port.
# Do not add HEALTHCHECK here — Railway can misparse it as a start command.
CMD ["node", "dist-server/index.cjs"]
