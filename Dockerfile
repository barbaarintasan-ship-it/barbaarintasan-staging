# Barbaarintasan Academy - Fly.io Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/dist/public/course-images
COPY --from=builder /app/client/public/course-images ./dist/public/course-images
COPY --from=builder /app/attached_assets ./attached_assets
EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1
CMD ["node", "dist/index.js"]
