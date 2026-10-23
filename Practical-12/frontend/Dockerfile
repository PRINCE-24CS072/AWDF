# Practical 11: Frontend Multi-Stage Dockerfile (React + Vite)

# ── Stage 1: Build Stage ─────────────────────────────────────────
FROM node:18 AS build

WORKDIR /app

# Copy dependency manifests first to optimize layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies required for Vite build)
RUN npm ci || npm install

# Copy frontend source code and configuration files
COPY . .

# Build the production bundle into /app/dist
RUN npm run build

# ── Stage 2: Production Runtime Stage ─────────────────────────────
# Uses a slim Node.js 18 image to keep final image size minimal and production-ready
FROM node:18-slim AS runner

WORKDIR /app

# Copy package manifests and installed node_modules required for Vite preview
COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/vite.config.js ./vite.config.js

# Expose Vite preview port
EXPOSE 5173

# Default environment configuration
ENV PORT=5173
ENV HOST=0.0.0.0

# Serve built application on 0.0.0.0:5173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
