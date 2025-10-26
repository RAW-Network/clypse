#!/bin/sh

# Define the main application directory
APP_DIR="/home/app/clypse"

# Ensure persistent storage directories exist for videos and data
mkdir -p /videos
mkdir -p /data
mkdir -p /uploads

# Create symbolic links from app storage to persistent Docker volumes
ln -sfn /videos ${APP_DIR}/videos
ln -sfn /data ${APP_DIR}/data
ln -sfn /uploads ${APP_DIR}/uploads

# Set ownership for persistent storage directories
chown -R clypse:clypse /videos
chown -R clypse:clypse /data
chown -R clypse:clypse /uploads

# Start the application using dumb-init
exec /usr/bin/dumb-init -- su-exec clypse "$@"