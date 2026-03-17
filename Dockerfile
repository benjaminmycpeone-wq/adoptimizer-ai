# Stage 1: Build React frontend
FROM node:20-alpine AS frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN echo "build-v2-$(date +%s)" > .buildstamp && npm run build

# Stage 2: Python runtime with Playwright
FROM python:3.12-slim
WORKDIR /app

# Install system deps for Playwright Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2 libatspi2.0-0 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium
RUN playwright install chromium --with-deps

# Copy backend
COPY server/ ./server/

# Copy built frontend into Flask static folder
COPY --from=frontend /app/client/dist ./server/static/

ENV FLASK_ENV=production
ENV PORT=5055
EXPOSE 5055

CMD gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 "server.app:create_app()"
