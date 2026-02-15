"""Scanner models for vulnerability scanning."""

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


class ScanConfiguration(Base):
    """Scan configuration preset model."""

    __tablename__ = "scan_configurations"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    enabled_checks = Column(JSON, default=list)  # List of check names to run
    settings = Column(JSON, default=dict)  # Check-specific settings
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    scans = relationship("Scan", back_populates="configuration")


class Scan(Base):
    """Scan session model."""

    __tablename__ = "scans"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    config_id = Column(
        String, ForeignKey("scan_configurations.id", ondelete="SET NULL"), nullable=True
    )
    target_id = Column(
        String, ForeignKey("targets.id", ondelete="SET NULL"), nullable=True
    )
    status = Column(
        String, default="configured"
    )  # configured, running, paused, completed, error

    # Source for scanning
    source_type = Column(String, default="target")  # target, request, url
    source_request_id = Column(String, nullable=True)
    source_urls = Column(JSON, default=list)

    # Progress tracking
    total_checks = Column(Integer, default=0)
    completed_checks = Column(Integer, default=0)
    issues_found = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    configuration = relationship("ScanConfiguration", back_populates="scans")
    target = relationship("Target", backref="scans")
    issues = relationship("ScanIssue", back_populates="scan", cascade="all, delete-orphan")


class ScanIssue(Base):
    """Discovered vulnerability issue model."""

    __tablename__ = "scan_issues"

    id = Column(String, primary_key=True, default=generate_uuid)
    scan_id = Column(
        String, ForeignKey("scans.id", ondelete="CASCADE"), nullable=False
    )

    # Issue classification
    issue_type = Column(String, nullable=False)  # sql_injection, xss, csrf, etc.
    severity = Column(String, default="info")  # critical, high, medium, low, info
    confidence = Column(String, default="tentative")  # certain, firm, tentative

    # Location
    url = Column(Text, nullable=False)
    method = Column(String, default="GET")
    parameter = Column(String, nullable=True)
    location = Column(String, nullable=True)  # body, header, query, cookie

    # Evidence
    request_data = Column(JSON, nullable=True)  # Request that triggered the issue
    response_data = Column(JSON, nullable=True)  # Response containing evidence
    evidence = Column(Text, nullable=True)  # Specific evidence text
    payload = Column(Text, nullable=True)  # Payload that triggered the issue

    # Details
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    remediation = Column(Text, nullable=True)
    references = Column(JSON, default=list)  # External reference URLs

    # Status tracking
    status = Column(String, default="new")  # new, confirmed, false_positive, fixed
    notes = Column(Text, nullable=True)

    discovered_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    scan = relationship("Scan", back_populates="issues")
