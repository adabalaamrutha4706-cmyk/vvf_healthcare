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
EXPOSE 5173
ENV PORT=5173
ENV HOSTNAME=0.0.0.0
CMD ["npm", "run", "dev"]

# Stage 3: Production builder
FROM base AS builder
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install --no-audit --no-fund --prefer-offline
COPY . .
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
RUN npm run build

# Stage 4: Production runner (lightweight, no devDependencies)
FROM node:20-alpine AS prod
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install --omit=dev --no-audit --no-fund --prefer-offline

# Copy built artifacts
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/next.config.ts ./next.config.ts

EXPOSE 5173
ENV PORT=5173
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
CMD ["npm", "run", "start"]
