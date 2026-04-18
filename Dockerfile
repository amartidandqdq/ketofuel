FROM python:3.12-slim

WORKDIR /app

# POURQUOI: curl needed for HEALTHCHECK; clean apt lists to keep image small
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# POURQUOI: app writes to data/ and logs/ — pre-create so first boot works on fresh volumes
RUN mkdir -p data logs

ENV APP_HOST=0.0.0.0 \
    APP_PORT=8086 \
    PYTHONUNBUFFERED=1

EXPOSE 8086

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:8086/api/health || exit 1

CMD ["python", "main.py"]
