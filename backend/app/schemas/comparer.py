from enum import Enum
from typing import Optional
from pydantic import BaseModel


class SourceType(str, Enum):
    REQUEST = "request"
    TEXT = "text"


class CompareSource(BaseModel):
    type: SourceType
    id: Optional[str] = None  # Request ID if type is 'request'
    content: Optional[str] = None  # Text content if type is 'text'


class CompareOptions(BaseModel):
    ignore_whitespace: bool = False
    ignore_case: bool = False


class CompareRequest(BaseModel):
    left: CompareSource
    right: CompareSource
    options: Optional[CompareOptions] = None


class DiffLine(BaseModel):
    type: str  # 'equal', 'insert', 'delete', 'replace'
    left_line_num: Optional[int] = None
    right_line_num: Optional[int] = None
    left_content: Optional[str] = None
    right_content: Optional[str] = None


class DiffStats(BaseModel):
    additions: int
    deletions: int
    unchanged: int


class CompareResponse(BaseModel):
    diff: list[DiffLine]
    stats: DiffStats
    success: bool
    error: Optional[str] = None
