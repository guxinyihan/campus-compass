FROM node:24.18.0-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
ARG VITE_API_URL=http://localhost:4000
ARG VITE_ROUTING_API_URL=http://localhost:5001
ARG VITE_TRACKING_API_URL=http://localhost:8081
ARG VITE_TRACKING_WS_URL=ws://localhost:8081/ws/vehicles
ARG VITE_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
ENV VITE_API_URL=$VITE_API_URL VITE_ROUTING_API_URL=$VITE_ROUTING_API_URL VITE_TRACKING_API_URL=$VITE_TRACKING_API_URL VITE_TRACKING_WS_URL=$VITE_TRACKING_WS_URL VITE_TILE_URL=$VITE_TILE_URL
RUN npm run build

FROM nginx:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 5173
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:5173/health || exit 1
