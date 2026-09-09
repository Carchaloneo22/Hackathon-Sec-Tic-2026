# Build context is Trazo/ (not Trazo/frontend/) so this stage can also see ../shared,
# which the frontend imports via the "@shared/*" alias (see vite.config.ts).

# Build stage
FROM node:20-alpine AS build

WORKDIR /app
COPY shared ./shared
COPY frontend/package*.json ./frontend/

WORKDIR /app/frontend
RUN npm ci

COPY frontend/ ./

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# Production stage
FROM nginx:alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
