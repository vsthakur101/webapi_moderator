from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from enum import Enum


class MatchType(str, Enum):
    URL = "url"
    HEADER = "header"
    BODY = "body"
    METHOD = "method"


class ActionType(str, Enum):
    REPLACE = "replace"
    ADD_HEADER = "add_header"
    REMOVE_HEADER = "remove_header"
    BLOCK = "block"


class ApplyTo(str, Enum):
    REQUEST = "request"
    RESPONSE = "response"
    BOTH = "both"


class RuleBase(BaseModel):
    name: str
    enabled: bool = True
    priority: int = 0
    match_type: MatchType
    match_pattern: str
    match_regex: bool = False
    action_type: ActionType
    action_target: Optional[str] = None
    action_value: Optional[str] = None
    apply_to: ApplyTo = ApplyTo.REQUEST


class RuleCreate(RuleBase):
    pass


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    enabled: Optional[bool] = None
    priority: Optional[int] = None
    match_type: Optional[MatchType] = None
    match_pattern: Optional[str] = None
    match_regex: Optional[bool] = None
    action_type: Optional[ActionType] = None
    action_target: Optional[str] = None
    action_value: Optional[str] = None
    apply_to: Optional[ApplyTo] = None


class RuleResponse(RuleBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
