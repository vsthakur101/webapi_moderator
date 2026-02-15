"""Spider manager for web crawling."""

import asyncio
import re
import time
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.spider import SpiderSession, SpiderURL


class SpiderManager:
    """Manages spider crawl sessions."""

    def __init__(self):
        self.active_sessions: dict[str, asyncio.Task] = {}
        self.session_locks: dict[str, asyncio.Lock] = {}
        self.robots_cache: dict[str, RobotFileParser] = {}
        self.db_session_factory = None
        self.websocket_manager = None

    def set_dependencies(self, db_session_factory, websocket_manager):
        """Set dependencies after initialization."""
        self.db_session_factory = db_session_factory
        self.websocket_manager = websocket_manager

    async def start_crawl(self, session_id: str, db: AsyncSession) -> None:
        """Start a spider crawl session."""
        result = await db.execute(
            select(SpiderSession).where(SpiderSession.id == session_id)
        )
        session = result.scalar_one_or_none()

        if not session:
            raise ValueError("Session not found")

        if session.status == "running":
            raise ValueError("Session already running")

        # Initialize the session
        session.status = "running"
        session.started_at = datetime.utcnow()
        session.error_message = None
        await db.commit()

        # Add start URLs to queue
        for url in session.start_urls:
            await self._add_url_to_queue(session_id, url, 0, None, db)

        await db.commit()

        # Create background task for crawling
        self.session_locks[session_id] = asyncio.Lock()
        task = asyncio.create_task(self._run_crawl(session_id))
        self.active_sessions[session_id] = task

    async def pause_crawl(self, session_id: str, db: AsyncSession) -> None:
        """Pause a spider crawl session."""
        result = await db.execute(
            select(SpiderSession).where(SpiderSession.id == session_id)
        )
        session = result.scalar_one_or_none()

        if not session:
            raise ValueError("Session not found")

        session.status = "paused"
        await db.commit()

        # Cancel the background task
        if session_id in self.active_sessions:
            self.active_sessions[session_id].cancel()
            del self.active_sessions[session_id]

    async def resume_crawl(self, session_id: str, db: AsyncSession) -> None:
        """Resume a paused spider crawl session."""
        result = await db.execute(
            select(SpiderSession).where(SpiderSession.id == session_id)
        )
        session = result.scalar_one_or_none()

        if not session:
            raise ValueError("Session not found")

        if session.status != "paused":
            raise ValueError("Session is not paused")

        session.status = "running"
        await db.commit()

        # Restart the background task
        self.session_locks[session_id] = asyncio.Lock()
        task = asyncio.create_task(self._run_crawl(session_id))
        self.active_sessions[session_id] = task

    async def stop_crawl(self, session_id: str, db: AsyncSession) -> None:
        """Stop a spider crawl session."""
        result = await db.execute(
            select(SpiderSession).where(SpiderSession.id == session_id)
        )
        session = result.scalar_one_or_none()

        if not session:
            raise ValueError("Session not found")

        session.status = "completed"
        session.completed_at = datetime.utcnow()
        await db.commit()

        # Cancel the background task
        if session_id in self.active_sessions:
            self.active_sessions[session_id].cancel()
            del self.active_sessions[session_id]

    async def _run_crawl(self, session_id: str) -> None:
        """Main crawl loop running in background."""
        try:
            while True:
                async with self.db_session_factory() as db:
                    # Get session status
                    result = await db.execute(
                        select(SpiderSession).where(SpiderSession.id == session_id)
                    )
                    session = result.scalar_one_or_none()

                    if not session or session.status != "running":
                        break

                    # Check if we've reached max pages
                    if session.pages_crawled >= session.max_pages:
                        session.status = "completed"
                        session.completed_at = datetime.utcnow()
                        await db.commit()
                        await self._send_progress(session)
                        break

                    # Get next URL to crawl
                    url_result = await db.execute(
                        select(SpiderURL)
                        .where(SpiderURL.session_id == session_id)
                        .where(SpiderURL.status == "queued")
                        .where(SpiderURL.depth <= session.max_depth)
                        .order_by(SpiderURL.depth)
                        .limit(1)
                    )
                    spider_url = url_result.scalar_one_or_none()

                    if not spider_url:
                        # No more URLs to crawl
                        session.status = "completed"
                        session.completed_at = datetime.utcnow()
                        await db.commit()
                        await self._send_progress(session)
                        break

                    # Crawl the URL
                    await self._crawl_url(session, spider_url, db)

                    # Delay between requests
                    await asyncio.sleep(session.delay_ms / 1000.0)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            async with self.db_session_factory() as db:
                result = await db.execute(
                    select(SpiderSession).where(SpiderSession.id == session_id)
                )
                session = result.scalar_one_or_none()
                if session:
                    session.status = "error"
                    session.error_message = str(e)
                    await db.commit()
        finally:
            if session_id in self.active_sessions:
                del self.active_sessions[session_id]
            if session_id in self.session_locks:
                del self.session_locks[session_id]

    async def _crawl_url(
        self, session: SpiderSession, spider_url: SpiderURL, db: AsyncSession
    ) -> None:
        """Crawl a single URL."""
        spider_url.status = "crawling"
        await db.commit()

        parsed_url = urlparse(spider_url.url)
        base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"

        # Check robots.txt
        if session.respect_robots_txt:
            if not await self._is_allowed_by_robots(base_url, spider_url.url):
                spider_url.status = "skipped"
                spider_url.error_message = "Blocked by robots.txt"
                await db.commit()
                return

        # Check include/exclude patterns
        if not self._matches_patterns(
            spider_url.url, session.include_patterns, session.exclude_patterns
        ):
            spider_url.status = "skipped"
            spider_url.error_message = "Filtered by patterns"
            await db.commit()
            return

        start_time = time.time()

        try:
            async with httpx.AsyncClient(
                timeout=30.0, follow_redirects=True, verify=False
            ) as client:
                response = await client.get(spider_url.url)

            elapsed_ms = int((time.time() - start_time) * 1000)

            spider_url.response_status = response.status_code
            spider_url.content_type = response.headers.get("content-type", "")
            spider_url.content_length = len(response.content)
            spider_url.response_time_ms = elapsed_ms
            spider_url.status = "crawled"
            spider_url.crawled_at = datetime.utcnow()

            # Parse HTML and extract links
            if "text/html" in spider_url.content_type:
                links, forms, title = self._parse_html(
                    response.text, spider_url.url, session.follow_external_links
                )
                spider_url.links_found = len(links)
                spider_url.forms_found = forms
                spider_url.title = title

                # Add discovered links to queue
                for link in links:
                    await self._add_url_to_queue(
                        session.id, link, spider_url.depth + 1, spider_url.url, db
                    )

            # Update session stats
            session.pages_crawled += 1

            # Count queued pages
            queued_result = await db.execute(
                select(SpiderURL)
                .where(SpiderURL.session_id == session.id)
                .where(SpiderURL.status == "queued")
            )
            session.pages_queued = len(queued_result.scalars().all())

            await db.commit()
            await self._send_progress(session, spider_url.url)
            await self._send_url_discovered(session.id, spider_url)

        except Exception as e:
            spider_url.status = "error"
            spider_url.error_message = str(e)
            session.error_count += 1
            await db.commit()

    async def _add_url_to_queue(
        self,
        session_id: str,
        url: str,
        depth: int,
        source_url: Optional[str],
        db: AsyncSession,
    ) -> None:
        """Add a URL to the crawl queue if not already present."""
        # Normalize URL
        url = url.split("#")[0]  # Remove fragment
        if not url:
            return

        # Check if URL already exists
        existing = await db.execute(
            select(SpiderURL)
            .where(SpiderURL.session_id == session_id)
            .where(SpiderURL.url == url)
        )
        if existing.scalar_one_or_none():
            return

        spider_url = SpiderURL(
            session_id=session_id,
            url=url,
            depth=depth,
            source_url=source_url,
            status="queued",
        )
        db.add(spider_url)

    def _parse_html(
        self, html: str, base_url: str, follow_external: bool
    ) -> tuple[list[str], int, Optional[str]]:
        """Parse HTML and extract links, form count, and title."""
        soup = BeautifulSoup(html, "html.parser")

        # Extract title
        title_tag = soup.find("title")
        title = title_tag.get_text(strip=True) if title_tag else None

        # Extract links
        links = []
        base_parsed = urlparse(base_url)

        for a in soup.find_all("a", href=True):
            href = a["href"]
            full_url = urljoin(base_url, href)
            parsed = urlparse(full_url)

            # Only include HTTP(S) URLs
            if parsed.scheme not in ("http", "https"):
                continue

            # Check if external
            if not follow_external and parsed.netloc != base_parsed.netloc:
                continue

            links.append(full_url)

        # Count forms
        forms = len(soup.find_all("form"))

        return links, forms, title

    def _matches_patterns(
        self, url: str, include_patterns: list[str], exclude_patterns: list[str]
    ) -> bool:
        """Check if URL matches include patterns and doesn't match exclude patterns."""
        # If include patterns exist, URL must match at least one
        if include_patterns:
            matched = False
            for pattern in include_patterns:
                try:
                    if re.search(pattern, url):
                        matched = True
                        break
                except re.error:
                    continue
            if not matched:
                return False

        # URL must not match any exclude pattern
        for pattern in exclude_patterns:
            try:
                if re.search(pattern, url):
                    return False
            except re.error:
                continue

        return True

    async def _is_allowed_by_robots(self, base_url: str, url: str) -> bool:
        """Check if URL is allowed by robots.txt."""
        if base_url in self.robots_cache:
            rp = self.robots_cache[base_url]
        else:
            rp = RobotFileParser()
            robots_url = f"{base_url}/robots.txt"
            try:
                async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
                    response = await client.get(robots_url)
                    if response.status_code == 200:
                        rp.parse(response.text.splitlines())
                    else:
                        # No robots.txt or error, allow everything
                        return True
            except Exception:
                # Error fetching robots.txt, allow everything
                return True

            self.robots_cache[base_url] = rp

        return rp.can_fetch("*", url)

    async def _send_progress(
        self, session: SpiderSession, current_url: Optional[str] = None
    ) -> None:
        """Send progress update via WebSocket."""
        if self.websocket_manager:
            await self.websocket_manager.broadcast(
                {
                    "type": "spider_progress",
                    "data": {
                        "session_id": session.id,
                        "status": session.status,
                        "pages_crawled": session.pages_crawled,
                        "pages_queued": session.pages_queued,
                        "error_count": session.error_count,
                        "current_url": current_url,
                    },
                }
            )

    async def _send_url_discovered(
        self, session_id: str, spider_url: SpiderURL
    ) -> None:
        """Send URL discovered event via WebSocket."""
        if self.websocket_manager:
            await self.websocket_manager.broadcast(
                {
                    "type": "spider_url",
                    "data": {
                        "session_id": session_id,
                        "url": {
                            "id": spider_url.id,
                            "url": spider_url.url,
                            "depth": spider_url.depth,
                            "status": spider_url.status,
                            "response_status": spider_url.response_status,
                            "content_type": spider_url.content_type,
                            "title": spider_url.title,
                            "links_found": spider_url.links_found,
                        },
                    },
                }
            )


# Global spider manager instance
spider_manager = SpiderManager()
