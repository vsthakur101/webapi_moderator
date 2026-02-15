#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

stop_project_containers() {
  if ! command -v docker >/dev/null 2>&1; then
    return
  fi

  local running
  running=$(docker ps --format "{{.Names}}" | grep -E '^webapi_moderator_(backend|frontend)$' || true)
  if [[ -n "$running" ]]; then
    echo "Stopping running Docker containers: $running"
    docker stop $running >/dev/null
  fi
}

kill_port_listeners() {
  local port="$1"
  local pids
  pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "Killing processes on port $port: $pids"
    kill $pids >/dev/null 2>&1 || true
  fi
}

start_backend() {
  echo "Starting backend (host mode)..."
  cd "$ROOT_DIR/backend"
  python3 -m pip install -r requirements.txt
  python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
  BACKEND_PID=$!
}

start_frontend() {
  echo "Starting frontend (host mode)..."
  cd "$ROOT_DIR/frontend"
  npm install
  npm run dev -- --port 3000 &
  FRONTEND_PID=$!
}

cleanup() {
  echo "Stopping host services..."
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
}

stop_project_containers
kill_port_listeners 8000
kill_port_listeners 8080
kill_port_listeners 3000
start_backend
start_frontend

trap cleanup EXIT

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop."

wait "$BACKEND_PID" "$FRONTEND_PID"
