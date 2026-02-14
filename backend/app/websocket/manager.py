import asyncio
import json
from typing import Any
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except Exception:
            await self.disconnect(websocket)

    async def broadcast(self, message: dict):
        async with self._lock:
            connections = self.active_connections.copy()

        disconnected = []
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            await self.disconnect(conn)

    async def broadcast_request(self, request_data: dict):
        """Broadcast a new request to all connected clients"""
        await self.broadcast({
            "type": "new_request",
            "data": request_data
        })

    async def broadcast_intercept(self, intercept_data: dict):
        """Broadcast an intercepted request requiring user action"""
        await self.broadcast({
            "type": "intercept",
            "data": intercept_data
        })

    async def broadcast_proxy_status(self, status: dict):
        """Broadcast proxy status update"""
        await self.broadcast({
            "type": "proxy_status",
            "data": status
        })


# Global manager instance
manager = ConnectionManager()
