#!/bin/sh

# Define the main application directory
APP_DIR="/home/app/clypse"

# Ensure persistent storage directories exist for videos and data
mkdir -p /videos
mkdir -p /data
mkdir -p /uploads

# Ensure correct ownership on the actual volume mount points
chown -R clypse:clypse /videos
chown -R clypse:clypse /data
chown -R clypse:clypse /uploads

# Execute the main command as the clypse user
exec /usr/bin/dumb-init -- su-exec clypse "$@"