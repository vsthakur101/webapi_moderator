import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy import String, Text, Integer, Boolean, DateTime, ForeignKey, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.request import JSONType


class IntruderAttack(Base):
    __tablename__ = "intruder_attacks"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    base_request_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("requests.id", ondelete="SET NULL"), nullable=True
    )

    # Attack type: sniper, battering_ram, pitchfork, cluster_bomb
    attack_type: Mapped[str] = mapped_column(String(20), nullable=False, default="sniper")

    # Status: configured, running, paused, completed, error
    status: Mapped[str] = mapped_column(String(20), default="configured")

    # Request template
    method: Mapped[str] = mapped_column(String(10), nullable=False, default="GET")
    url_template: Mapped[str] = mapped_column(Text, nullable=False)
    headers_template: Mapped[dict] = mapped_column(JSONType, default=dict)
    body_template: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Attack configuration
    # positions: list of {start: int, end: int, index: int}
    positions: Mapped[list] = mapped_column(JSONType, default=list)
    # payload_sets: list of lists of payloads [[payload1, payload2], [payloadA, payloadB]]
    payload_sets: Mapped[list] = mapped_column(JSONType, default=list)

    # Execution settings
    threads: Mapped[int] = mapped_column(Integer, default=1)
    delay_ms: Mapped[int] = mapped_column(Integer, default=0)
    follow_redirects: Mapped[bool] = mapped_column(Boolean, default=True)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=30)

    # Progress
    total_requests: Mapped[int] = mapped_column(Integer, default=0)
    completed_requests: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationship to results
    results: Mapped[list["IntruderResult"]] = relationship(
        "IntruderResult", back_populates="attack", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<IntruderAttack {self.name}>"


class IntruderResult(Base):
    __tablename__ = "intruder_results"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    attack_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("intruder_attacks.id", ondelete="CASCADE"), nullable=False
    )

    # Payload info
    position_index: Mapped[int] = mapped_column(Integer, default=0)
    payloads: Mapped[list] = mapped_column(JSONType, default=list)

    # Request/Response
    request_url: Mapped[str] = mapped_column(Text, nullable=False)
    request_body: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    response_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    response_length: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    response_time_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    response_body: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    response_headers: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)

    # Error tracking
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamp
    timestamp: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # Relationship
    attack: Mapped["IntruderAttack"] = relationship(
        "IntruderAttack", back_populates="results"
    )

    def __repr__(self):
        return f"<IntruderResult {self.id}>"
