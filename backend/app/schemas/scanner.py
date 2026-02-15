"""Scanner schemas for request/response models."""

from datetime import datetime
from pydantic import BaseModel
from typing import Optional, Any


# Scan Configuration schemas
class ScanConfigCreate(BaseModel):
    """Schema for creating a scan configuration."""

    name: str
    description: Optional[str] = None
    enabled_checks: list[str] = []
    settings: dict[str, Any] = {}


class ScanConfigUpdate(BaseModel):
    """Schema for updating a scan configuration."""

    name: Optional[str] = None
    description: Optional[str] = None
    enabled_checks: Optional[list[str]] = None
    settings: Optional[dict[str, Any]] = None


class ScanConfigResponse(BaseModel):
    """Schema for scan configuration response."""

    id: str
    name: str
    description: Optional[str]
    enabled_checks: list[str]
    settings: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Scan schemas
class ScanCreate(BaseModel):
    """Schema for creating a scan."""

    name: str
    config_id: Optional[str] = None
    target_id: Optional[str] = None
    source_type: str = "target"  # target, request, url
    source_request_id: Optional[str] = None
    source_urls: list[str] = []
    enabled_checks: list[str] = []  # Override config checks


class ScanUpdate(BaseModel):
    """Schema for updating a scan."""

    name: Optional[str] = None
    config_id: Optional[str] = None
    enabled_checks: Optional[list[str]] = None


class ScanResponse(BaseModel):
    """Schema for scan response."""

    id: str
    name: str
    config_id: Optional[str]
    target_id: Optional[str]
    status: str
    source_type: str
    source_request_id: Optional[str]
    source_urls: list[str]
    total_checks: int
    completed_checks: int
    issues_found: int
    error_message: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


# Issue schemas
class IssueResponse(BaseModel):
    """Schema for scan issue response."""

    id: str
    scan_id: str
    issue_type: str
    severity: str
    confidence: str
    url: str
    method: str
    parameter: Optional[str]
    location: Optional[str]
    request_data: Optional[dict]
    response_data: Optional[dict]
    evidence: Optional[str]
    payload: Optional[str]
    title: str
    description: Optional[str]
    remediation: Optional[str]
    references: list[str]
    status: str
    notes: Optional[str]
    discovered_at: datetime

    class Config:
        from_attributes = True


class IssueUpdate(BaseModel):
    """Schema for updating an issue."""

    status: Optional[str] = None
    notes: Optional[str] = None


class ScanDetailResponse(ScanResponse):
    """Schema for scan with issues."""

    issues: list[IssueResponse] = []


# Available checks
class CheckInfo(BaseModel):
    """Schema for available check information."""

    id: str
    name: str
    description: str
    category: str
    severity: str  # Default severity for issues found


class ScanProgress(BaseModel):
    """Schema for scan progress updates."""

    scan_id: str
    status: str
    total_checks: int
    completed_checks: int
    issues_found: int
    current_check: Optional[str] = None
    current_url: Optional[str] = None


class IssueSummary(BaseModel):
    """Schema for issue summary by severity."""

    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    info: int = 0
