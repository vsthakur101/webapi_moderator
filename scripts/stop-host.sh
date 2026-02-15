#!/usr/bin/env bash
set -euo pipefail

kill_by_port() {
  local port="$1"
  local pids
  pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "Killing processes on port $port: $pids"
    kill $pids
  else
    echo "No listener on port $port"
  fi
}

kill_by_port 8000
kill_by_port 3000
