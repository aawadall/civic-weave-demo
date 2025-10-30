#!/bin/bash

# Script to manually run batch matching
# This can be used for testing or manual execution

echo "Starting batch matching process..."

# Set environment variables
export DB_HOST=${DB_HOST:-localhost}
export DB_PORT=${DB_PORT:-5432}
export DB_USER=${DB_USER:-postgres}
export DB_PASSWORD=${DB_PASSWORD:-postgres}
export DB_NAME=${DB_NAME:-civic_weave}

# Run the batch matching script
cd /home/arashad/src/civic-weave-demo/scripts
python3 batch_matching.py

echo "Batch matching completed."
