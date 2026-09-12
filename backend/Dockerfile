FROM node:22-alpine
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

COPY backend/ ./
COPY foods-data.js ../foods-data.js
COPY CaloTrack.dc.html ../CaloTrack.dc.html
COPY support.js ../support.js

EXPOSE 3000
CMD ["sh", "-c", "node scripts/seed-foods.js && node src/server.js"]
