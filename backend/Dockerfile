# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app

# Dependencies only, so they are cached until package*.json changes.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Development: watch mode with hot reload (used by docker-compose.dev.yml).
FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# Production build, then drop development-only packages.
FROM deps AS build
COPY . .
RUN npm run build \
 && npm prune --omit=dev

# Runtime: compiled app and production packages only, running as a non-root user.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
