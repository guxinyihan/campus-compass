FROM python:3.12-slim-bookworm
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 CAMPUS_DATA_DIR=/data
COPY routing-backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home routing
COPY routing-backend/api /app/api
USER routing
EXPOSE 5001
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=12 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5001/health', timeout=4)"
CMD ["python", "-m", "uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "5001", "--no-access-log"]
