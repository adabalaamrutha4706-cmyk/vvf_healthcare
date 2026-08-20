# Stage 1: Base stage for package installation
FROM node:20-alpine AS base
WORKDIR /usr/src/app
COPY package*.json ./

# Stage 2: Development stage (with devDependencies for hot-reloading)
FROM base AS dev
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install --no-audit --no-fund --prefer-offline
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev"]

# Stage 3: Production builder
FROM base AS builder
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install --no-audit --no-fund --prefer-offline
COPY . .
RUN npm run build

# Stage 4: Production runner (lightweight, no devDependencies)
FROM node:20-alpine AS prod
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install --omit=dev --no-audit --no-fund --prefer-offline
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/schema.sql ./schema.sql
EXPOSE 5000
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
