import uuid
import json
from typing import Optional
from datetime import datetime
from sqlalchemy import String, Text, Integer, Boolean, DateTime, LargeBinary, TypeDecorator
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class JSONType(TypeDecorator):
    """Platform-independent JSON type using Text storage"""
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return json.dumps(value)
        return None

    def process_result_value(self, value, dialect):
        if value is not None:
            return json.loads(value)
        return None


class Request(Base):
    __tablename__ = "requests"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # Request info
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    scheme: Mapped[str] = mapped_column(String(10), default="https")

    # Request data
    request_headers: Mapped[dict] = mapped_column(JSONType, default=dict)
    request_body: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    request_content_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Response data
    response_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    response_headers: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    response_body: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    response_content_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Metadata
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_websocket: Mapped[bool] = mapped_column(Boolean, default=False)
    intercepted: Mapped[bool] = mapped_column(Boolean, default=False)
    modified: Mapped[bool] = mapped_column(Boolean, default=False)
    tags: Mapped[Optional[list]] = mapped_column(JSONType, nullable=True)

    def __repr__(self):
        return f"<Request {self.method} {self.url}>"
