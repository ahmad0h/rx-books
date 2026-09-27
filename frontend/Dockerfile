# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app

# Dependencies only, so they are cached until package*.json changes.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Development: Vite dev server with hot reload (used by docker-compose.dev.yml).
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Production build.
FROM deps AS build
COPY . .
RUN npm run build

# Runtime: nginx serving the static files and proxying /api.
FROM nginx:stable-alpine AS runtime
ENV API_UPSTREAM=http://backend:3000 \
    NGINX_RESOLVER=127.0.0.11
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
