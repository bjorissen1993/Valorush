FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

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
