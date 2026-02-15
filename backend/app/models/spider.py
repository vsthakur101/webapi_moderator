"""Spider models for web crawling."""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    Boolean,
    Text,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import relationship

from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class SpiderSession(Base):
    """Spider crawl session model."""

    __tablename__ = "spider_sessions"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    target_id = Column(String, ForeignKey("targets.id", ondelete="SET NULL"), nullable=True)
    status = Column(
        String, default="configured"
    )  # configured, running, paused, completed, error
    start_urls = Column(JSON, default=list)  # List of starting URLs
    max_depth = Column(Integer, default=3)
    max_pages = Column(Integer, default=100)
    threads = Column(Integer, default=5)
    delay_ms = Column(Integer, default=100)  # Delay between requests
    include_patterns = Column(JSON, default=list)  # Regex patterns to include
    exclude_patterns = Column(JSON, default=list)  # Regex patterns to exclude
    respect_robots_txt = Column(Boolean, default=True)
    follow_external_links = Column(Boolean, default=False)

    # Progress tracking
    pages_crawled = Column(Integer, default=0)
    pages_queued = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    target = relationship("Target", backref="spider_sessions")
    discovered_urls = relationship(
        "SpiderURL", back_populates="session", cascade="all, delete-orphan"
    )


class SpiderURL(Base):
    """Discovered URL during spider crawl."""

    __tablename__ = "spider_urls"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(
        String, ForeignKey("spider_sessions.id", ondelete="CASCADE"), nullable=False
    )
    url = Column(Text, nullable=False)
    depth = Column(Integer, default=0)
    status = Column(
        String, default="queued"
    )  # queued, crawling, crawled, error, skipped
    source_url = Column(Text, nullable=True)  # Where this URL was found

    # Response info
    response_status = Column(Integer, nullable=True)
    content_type = Column(String, nullable=True)
    content_length = Column(Integer, nullable=True)
    response_time_ms = Column(Integer, nullable=True)

    # Extracted data
    title = Column(Text, nullable=True)
    links_found = Column(Integer, default=0)
    forms_found = Column(Integer, default=0)

    error_message = Column(Text, nullable=True)
    discovered_at = Column(DateTime, default=datetime.utcnow)
    crawled_at = Column(DateTime, nullable=True)

    # Relationship
    session = relationship("SpiderSession", back_populates="discovered_urls")
