# Base image with Python
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy app code
COPY . /app

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Install huggingface_hub for downloading checkpoints
RUN pip install huggingface_hub

# Download model checkpoints before running app
COPY download_checkpoints.py /app/
RUN python /app/download_checkpoints.py

# Expose port 5000 for Flask app
EXPOSE 5000

# Start the Flask app
CMD ["python", "app.py"]
