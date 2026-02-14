import base64
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx

from app.database import get_db
from app.models.request import Request
from app.schemas.proxy import (
    ProxyStatus,
    ProxyState,
    InterceptAction,
    InterceptActionType,
    ReplayRequest,
)
from app.proxy import proxy_manager

router = APIRouter()


@router.get("/status", response_model=ProxyStatus)
async def get_proxy_status():
    """Get current proxy status"""
    return proxy_manager.get_status()


@router.post("/start")
async def start_proxy():
    """Start the proxy server"""
    try:
        await proxy_manager.start()
        return {"status": "started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop")
async def stop_proxy():
    """Stop the proxy server"""
    try:
        await proxy_manager.stop()
        return {"status": "stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/intercept/toggle")
async def toggle_intercept():
    """Toggle intercept mode"""
    enabled = proxy_manager.toggle_intercept()
    return {"intercept_enabled": enabled}


@router.post("/intercept/action")
async def handle_intercept_action(action: InterceptAction):
    """Handle action for an intercepted request"""
    try:
        if action.action == InterceptActionType.FORWARD:
            await proxy_manager.forward_request(action.request_id)
        elif action.action == InterceptActionType.DROP:
            await proxy_manager.drop_request(action.request_id)
        elif action.action == InterceptActionType.FORWARD_MODIFIED:
            modified_body = None
            if action.modified_body_b64:
                modified_body = base64.b64decode(action.modified_body_b64)
            await proxy_manager.forward_modified(
                action.request_id,
                headers=action.modified_headers,
                body=modified_body,
                status=action.modified_status,
            )
        return {"status": "ok"}
    except KeyError:
        raise HTTPException(status_code=404, detail="Intercepted request not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/replay")
async def replay_request(
    replay: ReplayRequest,
    db: AsyncSession = Depends(get_db),
):
    """Replay a captured request with optional modifications"""
    result = await db.execute(select(Request).where(Request.id == replay.request_id))
    original = result.scalar_one_or_none()

    if not original:
        raise HTTPException(status_code=404, detail="Request not found")

    # Build the request
    method = replay.modified_method or original.method
    url = replay.modified_url or original.url
    headers = replay.modified_headers or dict(original.request_headers)

    body = None
    if replay.modified_body_b64:
        body = base64.b64decode(replay.modified_body_b64)
    elif original.request_body:
        body = original.request_body

    # Remove host header as httpx will set it
    headers.pop("host", None)
    headers.pop("Host", None)

    try:
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                content=body,
                timeout=30.0,
            )

            return {
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "body_b64": base64.b64encode(response.content).decode(),
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Replay failed: {str(e)}")


@router.get("/certificate")
async def get_certificate():
    """Get the CA certificate for HTTPS interception"""
    from app.proxy.certificate import get_ca_certificate_content

    try:
        cert_content = get_ca_certificate_content()
        return {
            "certificate": cert_content,
            "instructions": "Install this certificate in your browser/system to intercept HTTPS traffic.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate certificate: {str(e)}")
