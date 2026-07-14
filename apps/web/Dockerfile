FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Coolify may inject NODE_ENV=production; still install typescript/eslint for next build.
RUN npm install --legacy-peer-deps --include=dev

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Coolify injects ARGs/ENV earlier in the stage; pin build-only DB + skip bootstrap seed.
ENV DATABASE_URL=file:/tmp/build.db
ENV BOOTSTRAP_ADMIN_EMAIL=
ENV BOOTSTRAP_ADMIN_PASSWORD=
ENV ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
ENV BETTER_AUTH_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
# Fonts are committed under public/fonts - skip setup:fonts in CI/Coolify builds.
RUN npm rebuild better-sqlite3 && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y wget python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN mkdir -p /app/data

EXPOSE 3000
CMD ["node", "server.js"]
