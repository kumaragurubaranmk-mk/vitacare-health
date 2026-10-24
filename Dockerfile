# Multi-stage Dockerfile for VitaCare AI Full-Stack Platform

# Stage 1: Build the React client
FROM node:20-bullseye-slim AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# Stage 2: Production Server Runner
FROM node:20-bullseye-slim
WORKDIR /app

# Install native compilation dependencies for SQLite
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package descriptors
COPY package*.json ./
COPY server/package*.json ./server/

# Install server dependencies
WORKDIR /app/server
RUN npm install --production

# Copy server application files
COPY server/ /app/server/

# Copy built frontend assets
COPY --from=client-builder /app/client/dist /app/client/dist

# Default environment configuration
ENV NODE_ENV=production
ENV PORT=10000
ENV ACTIVE_AI_PROVIDER=builtin
ENV JWT_SECRET=vitacare_production_jwt_secret_render_2026
ENV ADMIN_JWT_SECRET=vitacare_production_admin_secret_render_2026

# Expose Render application port
EXPOSE 10000

# Start server
WORKDIR /app
CMD ["npm", "start"]
