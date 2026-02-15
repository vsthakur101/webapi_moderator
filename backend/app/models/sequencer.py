import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.request import JSONType


class SequencerAnalysis(Base):
    __tablename__ = "sequencer_analyses"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Status: configured, collecting, analyzing, completed, error
    status: Mapped[str] = mapped_column(String(20), default="configured")

    # Source configuration
    source_request_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("requests.id", ondelete="SET NULL"), nullable=True
    )

    # Extraction configuration
    # extraction_type: header, cookie, body_regex, body_json
    extraction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    extraction_pattern: Mapped[str] = mapped_column(Text, nullable=False)

    # Collection settings
    sample_count: Mapped[int] = mapped_column(Integer, default=100)
    collected_count: Mapped[int] = mapped_column(Integer, default=0)

    # Collected samples
    samples: Mapped[list] = mapped_column(JSONType, default=list)

    # Analysis results
    analysis_results: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)

    # Error tracking
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    def __repr__(self):
        return f"<SequencerAnalysis {self.name}>"
