# Use Node.js LTS as the base image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy the .env file (only use this for demonstration, in real environments use environment variables)
COPY .env ./

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"] 