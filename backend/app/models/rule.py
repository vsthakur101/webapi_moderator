import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy import String, Text, Integer, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Rule(Base):
    __tablename__ = "rules"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=0)

    # Match conditions
    match_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'url', 'header', 'body', 'method'
    match_pattern: Mapped[str] = mapped_column(Text, nullable=False)
    match_regex: Mapped[bool] = mapped_column(Boolean, default=False)

    # Action
    action_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'replace', 'add_header', 'remove_header', 'block'
    action_target: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    action_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Scope
    apply_to: Mapped[str] = mapped_column(
        String(20), default="request"
    )  # 'request', 'response', 'both'

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def __repr__(self):
        return f"<Rule {self.name}>"
