FROM node:24.18.0-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src ./src
USER node
EXPOSE 4000
CMD ["node", "src/index.js"]
