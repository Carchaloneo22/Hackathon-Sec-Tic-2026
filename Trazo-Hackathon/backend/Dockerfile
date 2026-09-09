# Build context is Trazo/ (not Trazo/backend/) so this stage can also see ../shared,
# which backend/src imports directly from source (see tsconfig.json's "include").

# Build stage
FROM node:20-alpine AS build

WORKDIR /app
COPY shared ./shared
COPY backend/package*.json ./backend/

WORKDIR /app/backend
RUN npm ci

COPY backend/ ./
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/backend/dist ./dist

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:4000/api/health || exit 1

CMD ["npm", "start"]
