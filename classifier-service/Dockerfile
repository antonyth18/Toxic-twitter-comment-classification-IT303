FROM python:3.10-slim

WORKDIR /app

COPY requirements-serve.txt .

RUN pip install --no-cache-dir -r requirements-serve.txt

COPY . .

EXPOSE 8000

# Render injects PORT; locally (docker-compose) it defaults to 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
