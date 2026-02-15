import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy import String, Text, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.request import JSONType


class Target(Base):
    __tablename__ = "targets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    host: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    in_scope: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Statistics
    request_count: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    first_seen: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # Relationship to site map nodes
    nodes: Mapped[list["SiteMapNode"]] = relationship(
        "SiteMapNode", back_populates="target", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Target {self.host}>"


class SiteMapNode(Base):
    __tablename__ = "sitemap_nodes"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    target_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("targets.id", ondelete="CASCADE"), nullable=False
    )
    path: Mapped[str] = mapped_column(Text, nullable=False)
    parent_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    node_type: Mapped[str] = mapped_column(
        String(20), default="file"
    )  # 'folder', 'file', 'param'

    # Request metadata
    methods: Mapped[list] = mapped_column(JSONType, default=list)  # ['GET', 'POST', ...]
    status_codes: Mapped[list] = mapped_column(JSONType, default=list)  # [200, 404, ...]
    content_types: Mapped[list] = mapped_column(JSONType, default=list)
    parameters: Mapped[list] = mapped_column(JSONType, default=list)  # Query params found

    # Statistics
    request_count: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    first_seen: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # Relationship
    target: Mapped["Target"] = relationship("Target", back_populates="nodes")

    def __repr__(self):
        return f"<SiteMapNode {self.path}>"
