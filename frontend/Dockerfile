# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22

# ---------------------------------------------------------------- deps: install once, reuse below
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# `npm ci` when a lockfile is committed (reproducible), `npm install` otherwise.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---------------------------------------------------------------- dev: Vite dev server with HMR
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# ---------------------------------------------------------------- build: static bundle
FROM deps AS build
# Vite inlines VITE_* values at build time, so the API URL is a build argument, not a runtime setting.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
COPY . .
RUN npm run build

# ---------------------------------------------------------------- prod: nginx serves the bundle
FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
