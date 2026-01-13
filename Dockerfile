# Stage 1: Build the Next.js application
FROM node:18-alpine AS builder

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package.json and lock file
COPY package*.json ./

# Install dependencies (use npm install to update lock file if needed)
RUN npm install

# Copy the rest of the application source code
COPY . .

# Ensure public directory exists (create if it doesn't)
RUN mkdir -p public

# Build the application
RUN npm run build

# Stage 2: Production image
FROM node:18-alpine

# Install runtime dependencies for native modules and PDF processing
RUN apk add --no-cache \
    libc6-compat \
    cairo \
    pango \
    giflib \
    libjpeg-turbo \
    pixman \
    wget

# Set working directory
WORKDIR /app

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy package files
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/package-lock.json ./package-lock.json

# Install production dependencies
RUN npm install --omit=dev && npm cache clean --force

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Copy source files needed for server actions and API routes
COPY --from=builder --chown=nextjs:nodejs /app/src ./src

# Switch to non-root user
USER nextjs

# Expose the port the app runs on
EXPOSE 9002

# Set environment variable for Next.js
ENV NODE_ENV=production
ENV PORT=9002
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Set the command to start the server
CMD ["npm", "start", "--", "-p", "9002"]
