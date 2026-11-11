# KarLab: build the UI with Node, then serve it and the API from one Python container.

FROM node:20-alpine AS ui
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend/src \
    KARLAB_WORKSPACE=/app/workspace
WORKDIR /app
RUN pip install --no-cache-dir \
    numpy==2.4.6 scipy==1.17.1 pydantic==2.14.1 fastapi==0.162.0 "uvicorn[standard]==0.54.0"
COPY backend/src/ backend/src/
# api.py serves the UI from <repo>/frontend/dist, so keep the same layout
COPY --from=ui /app/frontend/dist/ frontend/dist/
COPY workspace/ workspace/
EXPOSE 8000
# Hosts such as Render set PORT; locally it defaults to 8000
CMD ["sh", "-c", "exec uvicorn karlab.api:app --host 0.0.0.0 --port ${PORT:-8000}"]
