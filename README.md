# Web API Moderator

Web-based API intercepting proxy similar to Burp Suite. Provides a FastAPI backend with a proxy service, real-time updates over WebSocket, and a Next.js frontend for viewing and moderating requests.

## Features
- Intercept and review HTTP requests via a proxy service
- Real-time updates using WebSocket
- Rules and request management APIs
- Web UI built with Next.js and Tailwind CSS

## Architecture
- Backend: FastAPI + async PostgreSQL
- Proxy: managed by the backend and auto-started on app startup
- Frontend: Next.js app consuming REST and WebSocket endpoints

## Quick start (Docker)
1. Start all services:
   ```bash
   docker compose up --build
   ```
2. Open the UI: http://localhost:3000
3. API health check: http://localhost:8000/health

## Services and ports
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Proxy: http://localhost:8080
- Postgres: localhost:5432

## Environment variables (Docker defaults)
Backend:
- `DATABASE_URL`: postgresql+asyncpg://postgres:postgres@postgres:5432/webapi_moderator
- `API_HOST`: 0.0.0.0
- `API_PORT`: 8000
- `PROXY_HOST`: 0.0.0.0
- `PROXY_PORT`: 8080
- `CORS_ORIGINS`: ["http://localhost:3000"]

Frontend:
- `NEXT_PUBLIC_API_URL`: http://localhost:8000
- `NEXT_PUBLIC_WS_URL`: ws://localhost:8000

## Development (without Docker)
Backend (from `backend/`):
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend (from `frontend/`):
```bash
npm install
npm run dev
```

## Host mode quick start (system proxy)
If you want to enable system-wide interception (Burp-style), run the backend on the host OS.

```bash
bash scripts/dev-host.sh
```

To stop everything:
```bash
bash scripts/stop-host.sh
```

Notes:
- The host-mode script stops any running `webapi_moderator_backend`/`webapi_moderator_frontend` Docker containers.
- Use the Settings page to enable/disable the system proxy once the host backend is running.

## Notes
- The backend auto-starts the proxy at startup.
- WebSocket endpoint: `/ws`

## License
MIT
