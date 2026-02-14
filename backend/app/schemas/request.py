from datetime import datetime
from pydantic import BaseModel
from typing import Optional
import base64


class RequestBase(BaseModel):
    method: str
    url: str
    host: str
    path: str
    scheme: str = "https"


class RequestCreate(RequestBase):
    request_headers: dict = {}
    request_body: Optional[bytes] = None
    request_content_type: Optional[str] = None


class RequestResponse(RequestBase):
    id: str
    timestamp: datetime
    request_headers: dict
    request_body_b64: Optional[str] = None  # Base64 encoded
    request_content_type: Optional[str] = None
    response_status: Optional[int] = None
    response_headers: Optional[dict] = None
    response_body_b64: Optional[str] = None  # Base64 encoded
    response_content_type: Optional[str] = None
    duration_ms: Optional[int] = None
    is_websocket: bool = False
    intercepted: bool = False
    modified: bool = False
    tags: Optional[list[str]] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_body(cls, obj):
        data = {
            "id": obj.id,
            "timestamp": obj.timestamp,
            "method": obj.method,
            "url": obj.url,
            "host": obj.host,
            "path": obj.path,
            "scheme": obj.scheme,
            "request_headers": obj.request_headers or {},
            "request_content_type": obj.request_content_type,
            "response_status": obj.response_status,
            "response_headers": obj.response_headers,
            "response_content_type": obj.response_content_type,
            "duration_ms": obj.duration_ms,
            "is_websocket": obj.is_websocket,
            "intercepted": obj.intercepted,
            "modified": obj.modified,
            "tags": obj.tags,
        }
        if obj.request_body:
            data["request_body_b64"] = base64.b64encode(obj.request_body).decode()
        if obj.response_body:
            data["response_body_b64"] = base64.b64encode(obj.response_body).decode()
        return cls(**data)


class RequestListResponse(BaseModel):
    id: str
    timestamp: datetime
    method: str
    url: str
    host: str
    path: str
    response_status: Optional[int] = None
    duration_ms: Optional[int] = None
    is_websocket: bool = False
    intercepted: bool = False
    modified: bool = False

    class Config:
        from_attributes = True


class RequestFilter(BaseModel):
    method: Optional[str] = None
    host: Optional[str] = None
    status_code: Optional[int] = None
    search: Optional[str] = None
    is_websocket: Optional[bool] = None
    limit: int = 100
    offset: int = 0
