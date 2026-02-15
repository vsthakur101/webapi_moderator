"""Spider API routes for web crawling."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.spider import SpiderSession, SpiderURL
from app.spider.manager import spider_manager
from app.schemas.spider import (
    SpiderSessionCreate,
    SpiderSessionUpdate,
    SpiderSessionResponse,
    SpiderSessionDetailResponse,
    SpiderURLResponse,
)

router = APIRouter()


@router.get("/sessions", response_model=list[SpiderSessionResponse])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    """List all spider sessions."""
    result = await db.execute(
        select(SpiderSession).order_by(SpiderSession.created_at.desc())
    )
    sessions = result.scalars().all()
    return sessions


@router.post("/sessions", response_model=SpiderSessionResponse)
async def create_session(
    session: SpiderSessionCreate, db: AsyncSession = Depends(get_db)
):
    """Create a new spider session."""
    db_session = SpiderSession(
        name=session.name,
        target_id=session.target_id,
        start_urls=session.start_urls,
        max_depth=session.max_depth,
        max_pages=session.max_pages,
        threads=session.threads,
        delay_ms=session.delay_ms,
        include_patterns=session.include_patterns,
        exclude_patterns=session.exclude_patterns,
        respect_robots_txt=session.respect_robots_txt,
        follow_external_links=session.follow_external_links,
    )

    db.add(db_session)
    await db.commit()
    await db.refresh(db_session)

    return db_session


@router.get("/sessions/{session_id}", response_model=SpiderSessionDetailResponse)
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get spider session details with discovered URLs."""
    result = await db.execute(
        select(SpiderSession).where(SpiderSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get discovered URLs
    urls_result = await db.execute(
        select(SpiderURL)
        .where(SpiderURL.session_id == session_id)
        .order_by(SpiderURL.depth, SpiderURL.discovered_at)
    )
    urls = urls_result.scalars().all()

    return SpiderSessionDetailResponse(
        id=session.id,
        name=session.name,
        target_id=session.target_id,
        status=session.status,
        start_urls=session.start_urls or [],
        max_depth=session.max_depth,
        max_pages=session.max_pages,
        threads=session.threads,
        delay_ms=session.delay_ms,
        include_patterns=session.include_patterns or [],
        exclude_patterns=session.exclude_patterns or [],
        respect_robots_txt=session.respect_robots_txt,
        follow_external_links=session.follow_external_links,
        pages_crawled=session.pages_crawled,
        pages_queued=session.pages_queued,
        error_count=session.error_count,
        error_message=session.error_message,
        created_at=session.created_at,
        started_at=session.started_at,
        completed_at=session.completed_at,
        discovered_urls=[
            SpiderURLResponse(
                id=url.id,
                session_id=url.session_id,
                url=url.url,
                depth=url.depth,
                status=url.status,
                source_url=url.source_url,
                response_status=url.response_status,
                content_type=url.content_type,
                content_length=url.content_length,
                response_time_ms=url.response_time_ms,
                title=url.title,
                links_found=url.links_found,
                forms_found=url.forms_found,
                error_message=url.error_message,
                discovered_at=url.discovered_at,
                crawled_at=url.crawled_at,
            )
            for url in urls
        ],
    )


@router.patch("/sessions/{session_id}", response_model=SpiderSessionResponse)
async def update_session(
    session_id: str,
    session_update: SpiderSessionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a spider session."""
    result = await db.execute(
        select(SpiderSession).where(SpiderSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == "running":
        raise HTTPException(status_code=400, detail="Cannot modify running session")

    update_data = session_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(session, key, value)

    await db.commit()
    await db.refresh(session)

    return session


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a spider session."""
    result = await db.execute(
        select(SpiderSession).where(SpiderSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == "running":
        raise HTTPException(status_code=400, detail="Cannot delete running session")

    await db.delete(session)
    await db.commit()

    return {"message": "Session deleted"}


@router.post("/sessions/{session_id}/start")
async def start_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Start a spider crawl session."""
    try:
        await spider_manager.start_crawl(session_id, db)
        return {"message": "Spider started"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sessions/{session_id}/pause")
async def pause_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Pause a spider crawl session."""
    try:
        await spider_manager.pause_crawl(session_id, db)
        return {"message": "Spider paused"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sessions/{session_id}/resume")
async def resume_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Resume a paused spider crawl session."""
    try:
        await spider_manager.resume_crawl(session_id, db)
        return {"message": "Spider resumed"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sessions/{session_id}/stop")
async def stop_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Stop a spider crawl session."""
    try:
        await spider_manager.stop_crawl(session_id, db)
        return {"message": "Spider stopped"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sessions/{session_id}/urls", response_model=list[SpiderURLResponse])
async def get_session_urls(
    session_id: str,
    status: str = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Get discovered URLs for a session with optional filtering."""
    result = await db.execute(
        select(SpiderSession).where(SpiderSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    query = select(SpiderURL).where(SpiderURL.session_id == session_id)

    if status:
        query = query.where(SpiderURL.status == status)

    query = query.order_by(SpiderURL.depth, SpiderURL.discovered_at)
    query = query.offset(offset).limit(limit)

    urls_result = await db.execute(query)
    urls = urls_result.scalars().all()

    return urls
