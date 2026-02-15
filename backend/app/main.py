from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db, async_session_maker
from app.api import api_router
from app.websocket import manager
from app.proxy import proxy_manager
from app.intruder import intruder_manager
from app.spider.manager import spider_manager
from app.scanner.manager import scanner_manager

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()

    # Set dependencies for proxy manager
    proxy_manager.set_dependencies(async_session_maker, manager)

    # Set dependencies for intruder manager
    intruder_manager.set_dependencies(async_session_maker, manager)

    # Set dependencies for spider manager
    spider_manager.set_dependencies(async_session_maker, manager)

    # Set dependencies for scanner manager
    scanner_manager.set_dependencies(async_session_maker, manager)

    # Auto-start proxy
    await proxy_manager.start()

    yield

    # Shutdown
    await proxy_manager.stop()


app = FastAPI(
    title=settings.app_name,
    description="Web-based API intercepting proxy similar to Burp Suite",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, receive any client messages
            data = await websocket.receive_json()

            # Handle client messages if needed
            if data.get("type") == "ping":
                await manager.send_personal_message({"type": "pong"}, websocket)

    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
    )
