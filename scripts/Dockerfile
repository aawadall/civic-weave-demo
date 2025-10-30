FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    cron \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the batch matching script
COPY batch_matching.py .
COPY app.py .

# Create a script to run the batch matching
RUN echo '#!/bin/bash\ncd /app && /usr/local/bin/python batch_matching.py' > /usr/local/bin/run-batch-matching.sh
RUN chmod +x /usr/local/bin/run-batch-matching.sh

# Create crontab file
RUN echo '* * * * * /usr/local/bin/run-batch-matching.sh >> /var/log/batch-matching.log 2>&1' > /etc/cron.d/batch-matching
RUN chmod 0644 /etc/cron.d/batch-matching
RUN crontab /etc/cron.d/batch-matching

# Create log file
RUN touch /var/log/batch-matching.log

# Start cron and the HTTP trigger API
EXPOSE 5000
CMD ["bash", "-lc", "cron -f & python /app/app.py"]
