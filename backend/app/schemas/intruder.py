from typing import Optional
from datetime import datetime
from enum import Enum
from pydantic import BaseModel


class AttackType(str, Enum):
    SNIPER = "sniper"
    BATTERING_RAM = "battering_ram"
    PITCHFORK = "pitchfork"
    CLUSTER_BOMB = "cluster_bomb"


class AttackStatus(str, Enum):
    CONFIGURED = "configured"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ERROR = "error"


class Position(BaseModel):
    start: int
    end: int
    index: int = 0


class AttackCreate(BaseModel):
    name: str
    base_request_id: Optional[str] = None
    attack_type: AttackType = AttackType.SNIPER
    method: str = "GET"
    url_template: str
    headers_template: dict = {}
    body_template: Optional[str] = None
    positions: list[Position] = []
    payload_sets: list[list[str]] = []
    threads: int = 1
    delay_ms: int = 0
    follow_redirects: bool = True
    timeout_seconds: int = 30


class AttackUpdate(BaseModel):
    name: Optional[str] = None
    attack_type: Optional[AttackType] = None
    method: Optional[str] = None
    url_template: Optional[str] = None
    headers_template: Optional[dict] = None
    body_template: Optional[str] = None
    positions: Optional[list[Position]] = None
    payload_sets: Optional[list[list[str]]] = None
    threads: Optional[int] = None
    delay_ms: Optional[int] = None
    follow_redirects: Optional[bool] = None
    timeout_seconds: Optional[int] = None


class AttackResponse(BaseModel):
    id: str
    name: str
    base_request_id: Optional[str]
    attack_type: str
    status: str
    method: str
    url_template: str
    headers_template: dict
    body_template: Optional[str]
    positions: list[dict]
    payload_sets: list[list[str]]
    threads: int
    delay_ms: int
    follow_redirects: bool
    timeout_seconds: int
    total_requests: int
    completed_requests: int
    error_message: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class ResultResponse(BaseModel):
    id: str
    attack_id: str
    position_index: int
    payloads: list[str]
    request_url: str
    response_status: Optional[int]
    response_length: Optional[int]
    response_time_ms: Optional[int]
    error: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True


class ResultDetailResponse(ResultResponse):
    request_body_b64: Optional[str] = None
    response_body_b64: Optional[str] = None
    response_headers: Optional[dict] = None


class BuiltinPayloadList(BaseModel):
    name: str
    description: str
    count: int


class PayloadGenerateRequest(BaseModel):
    generator_type: str  # numbers, dates, custom
    params: dict = {}
