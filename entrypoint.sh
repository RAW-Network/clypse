#!/bin/sh

# Define the main application directory
APP_DIR="/home/app/clypse"

# Ensure persistent storage directories exist for videos and data
mkdir -p /videos
mkdir -p /data

# Create symbolic links from app storage to persistent Docker volumes
ln -sfn /videos ${APP_DIR}/videos
ln -sfn /data ${APP_DIR}/data

# Set ownership for persistent storage directories
chown -R clypse:clypse /videos
chown -R clypse:clypse /data

# Start the application using dumb-init
exec /usr/bin/dumb-init -- su-exec clypse "$@"