from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_
from app.database import get_db
from app.models.request import Request
from app.schemas.request import RequestResponse, RequestListResponse, RequestFilter

router = APIRouter()


@router.get("/", response_model=list[RequestListResponse])
async def list_requests(
    method: Optional[str] = Query(None),
    host: Optional[str] = Query(None),
    status_code: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    is_websocket: Optional[bool] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    """List all captured requests with optional filtering"""
    query = select(Request).order_by(desc(Request.timestamp))

    if method:
        query = query.where(Request.method == method.upper())
    if host:
        query = query.where(Request.host.ilike(f"%{host}%"))
    if status_code:
        query = query.where(Request.response_status == status_code)
    if is_websocket is not None:
        query = query.where(Request.is_websocket == is_websocket)
    if search:
        query = query.where(
            or_(
                Request.url.ilike(f"%{search}%"),
                Request.host.ilike(f"%{search}%"),
                Request.path.ilike(f"%{search}%"),
            )
        )

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    requests = result.scalars().all()

    return [RequestListResponse.model_validate(r) for r in requests]


@router.get("/{request_id}", response_model=RequestResponse)
async def get_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get detailed information about a specific request"""
    result = await db.execute(select(Request).where(Request.id == request_id))
    request = result.scalar_one_or_none()

    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    return RequestResponse.from_orm_with_body(request)


@router.delete("/{request_id}")
async def delete_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a specific request from history"""
    result = await db.execute(select(Request).where(Request.id == request_id))
    request = result.scalar_one_or_none()

    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    await db.delete(request)
    await db.commit()

    return {"status": "deleted"}


@router.delete("/")
async def clear_requests(
    db: AsyncSession = Depends(get_db),
):
    """Clear all request history"""
    await db.execute(Request.__table__.delete())
    await db.commit()

    return {"status": "cleared"}


@router.post("/{request_id}/tags")
async def add_tags(
    request_id: UUID,
    tags: list[str],
    db: AsyncSession = Depends(get_db),
):
    """Add tags to a request"""
    result = await db.execute(select(Request).where(Request.id == request_id))
    request = result.scalar_one_or_none()

    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    existing_tags = request.tags or []
    request.tags = list(set(existing_tags + tags))
    await db.commit()

    return {"tags": request.tags}
