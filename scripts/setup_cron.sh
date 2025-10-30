#!/bin/bash
# Setup cron job for batch matching

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Create a wrapper script for the cron job
cat > "$SCRIPT_DIR/run_batch_matching.sh" << EOF
#!/bin/bash
# Wrapper script for batch matching cron job

# Set environment variables
export DB_HOST=\${DB_HOST:-localhost}
export DB_PORT=\${DB_PORT:-5432}
export DB_USER=\${DB_USER:-postgres}
export DB_PASSWORD=\${DB_PASSWORD:-postgres}
export DB_NAME=\${DB_NAME:-civic_weave}

# Change to project directory
cd "$PROJECT_ROOT"

# Activate virtual environment if it exists
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

# Run the batch matching script
python3 "$SCRIPT_DIR/batch_matching.py" --skill-weight 0.7 --distance-weight 0.3 --max-distance 100 --batch-size 1000

# Log completion
echo "\$(date): Batch matching completed" >> "$SCRIPT_DIR/batch_matching.log"
EOF

# Make the wrapper script executable
chmod +x "$SCRIPT_DIR/run_batch_matching.sh"

echo "Cron job setup complete!"
echo ""
echo "To add the cron job, run:"
echo "crontab -e"
echo ""
echo "And add one of these lines:"
echo "# Run every 6 hours"
echo "0 */6 * * * $SCRIPT_DIR/run_batch_matching.sh"
echo ""
echo "# Run every 12 hours"
echo "0 */12 * * * $SCRIPT_DIR/run_batch_matching.sh"
echo ""
echo "# Run daily at 2 AM"
echo "0 2 * * * $SCRIPT_DIR/run_batch_matching.sh"
echo ""
echo "To test the batch matching manually:"
echo "$SCRIPT_DIR/run_batch_matching.sh"
