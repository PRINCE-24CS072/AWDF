# Practical 11: Backend Dockerfile (Node.js/Express Task Management API)
FROM node:18

# Define working directory inside container
WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
COPY package*.json ./

# Install clean dependencies inside the container using lockfile
RUN npm ci || npm install --omit=dev

# Copy backend application source code (node_modules and .env excluded via .dockerignore)
COPY . .

# Expose backend API port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Start backend server
CMD ["node", "server.js"]
