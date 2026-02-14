from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


class ProxyState(str, Enum):
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"


class ProxyStatus(BaseModel):
    state: ProxyState
    host: str
    port: int
    intercept_enabled: bool
    requests_intercepted: int = 0
    requests_total: int = 0
    error_message: Optional[str] = None


class InterceptedRequest(BaseModel):
    id: str
    method: str
    url: str
    host: str
    path: str
    headers: dict
    body_b64: Optional[str] = None
    is_response: bool = False
    response_status: Optional[int] = None


class InterceptActionType(str, Enum):
    FORWARD = "forward"
    DROP = "drop"
    FORWARD_MODIFIED = "forward_modified"


class InterceptAction(BaseModel):
    request_id: str
    action: InterceptActionType
    modified_headers: Optional[dict] = None
    modified_body_b64: Optional[str] = None
    modified_status: Optional[int] = None  # For responses


class ReplayRequest(BaseModel):
    request_id: str
    modified_method: Optional[str] = None
    modified_url: Optional[str] = None
    modified_headers: Optional[dict] = None
    modified_body_b64: Optional[str] = None


class SystemProxyConfig(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = None
    bypass: List[str] = []


class SystemProxyStatus(BaseModel):
    supported: bool
    enabled: bool
    os: str
    host: Optional[str] = None
    port: Optional[int] = None
    bypass: List[str] = []
    message: Optional[str] = None
