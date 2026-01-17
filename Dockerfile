# ----------- Stage 1: Builder -----------
# Install Node.js dependencies and prepare the application code
FROM node:24-alpine AS builder

# Set working directory for builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./

RUN npm install

# Copy all application source code to builder
COPY . .

# ----------- Stage 2: Production -----------
# Create a clean, secure production image
FROM node:24-alpine

# Install required system dependencies
RUN apk update && apk upgrade && apk add --no-cache \
    ffmpeg \
    dumb-init \
    su-exec \
    tzdata

# Create a non-root user and group for security
RUN addgroup -S clypse && adduser -S clypse -G clypse

# Set main working directory for the app
WORKDIR /home/app/clypse

# Copy production files from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh

# Make entrypoint script executable
RUN chmod +x ./entrypoint.sh

# Set ownership of all app files to non-root user
RUN chown -R clypse:clypse /home/app/clypse

# Expose application port
EXPOSE 3000

# Set entrypoint script and execute the application
ENTRYPOINT ["/home/app/clypse/entrypoint.sh"]
CMD ["node", "src/index.js"]