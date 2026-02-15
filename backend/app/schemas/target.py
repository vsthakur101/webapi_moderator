from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class TargetBase(BaseModel):
    host: str
    in_scope: bool = True
    notes: Optional[str] = None


class TargetUpdate(BaseModel):
    in_scope: Optional[bool] = None
    notes: Optional[str] = None


class TargetResponse(TargetBase):
    id: str
    request_count: int
    first_seen: datetime
    last_seen: datetime

    class Config:
        from_attributes = True


class SiteMapNodeBase(BaseModel):
    path: str
    parent_path: Optional[str] = None
    node_type: str = "file"
    methods: list[str] = []
    status_codes: list[int] = []
    content_types: list[str] = []
    parameters: list[str] = []
    request_count: int = 0


class SiteMapNodeResponse(SiteMapNodeBase):
    id: str
    target_id: str
    first_seen: datetime
    last_seen: datetime

    class Config:
        from_attributes = True


class SiteMapTreeNode(BaseModel):
    """Hierarchical tree node for site map visualization."""
    name: str
    path: str
    node_type: str
    methods: list[str] = []
    status_codes: list[int] = []
    request_count: int = 0
    children: list["SiteMapTreeNode"] = []


class ScopePattern(BaseModel):
    pattern: str
    is_regex: bool = False
    include: bool = True  # True for include, False for exclude


class ScopeConfig(BaseModel):
    patterns: list[ScopePattern] = []
