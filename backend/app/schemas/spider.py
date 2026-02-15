"""Spider schemas for request/response models."""

from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class SpiderSessionCreate(BaseModel):
    """Schema for creating a spider session."""

    name: str
    target_id: Optional[str] = None
    start_urls: list[str]
    max_depth: int = 3
    max_pages: int = 100
    threads: int = 5
    delay_ms: int = 100
    include_patterns: list[str] = []
    exclude_patterns: list[str] = []
    respect_robots_txt: bool = True
    follow_external_links: bool = False


class SpiderSessionUpdate(BaseModel):
    """Schema for updating a spider session."""

    name: Optional[str] = None
    start_urls: Optional[list[str]] = None
    max_depth: Optional[int] = None
    max_pages: Optional[int] = None
    threads: Optional[int] = None
    delay_ms: Optional[int] = None
    include_patterns: Optional[list[str]] = None
    exclude_patterns: Optional[list[str]] = None
    respect_robots_txt: Optional[bool] = None
    follow_external_links: Optional[bool] = None


class SpiderSessionResponse(BaseModel):
    """Schema for spider session response."""

    id: str
    name: str
    target_id: Optional[str]
    status: str
    start_urls: list[str]
    max_depth: int
    max_pages: int
    threads: int
    delay_ms: int
    include_patterns: list[str]
    exclude_patterns: list[str]
    respect_robots_txt: bool
    follow_external_links: bool
    pages_crawled: int
    pages_queued: int
    error_count: int
    error_message: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class SpiderURLResponse(BaseModel):
    """Schema for spider URL response."""

    id: str
    session_id: str
    url: str
    depth: int
    status: str
    source_url: Optional[str]
    response_status: Optional[int]
    content_type: Optional[str]
    content_length: Optional[int]
    response_time_ms: Optional[int]
    title: Optional[str]
    links_found: int
    forms_found: int
    error_message: Optional[str]
    discovered_at: datetime
    crawled_at: Optional[datetime]

    class Config:
        from_attributes = True


class SpiderSessionDetailResponse(SpiderSessionResponse):
    """Schema for spider session with URLs."""

    discovered_urls: list[SpiderURLResponse] = []


class SpiderProgress(BaseModel):
    """Schema for spider progress updates."""

    session_id: str
    status: str
    pages_crawled: int
    pages_queued: int
    error_count: int
    current_url: Optional[str] = None


class SpiderURLDiscovered(BaseModel):
    """Schema for newly discovered URL event."""

    session_id: str
    url: SpiderURLResponse
