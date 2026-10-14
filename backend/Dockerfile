FROM node:22-alpine
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

COPY backend/ ./
# Seuls les fichiers de public/ sont servis au navigateur.
COPY public/ ../public/

EXPOSE 3000
CMD ["node", "src/server.js"]
