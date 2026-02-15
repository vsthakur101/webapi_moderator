from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class CollectionBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None


class CollectionCreate(CollectionBase):
    pass


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class CollectionItemBase(BaseModel):
    request_id: str
    notes: Optional[str] = None
    order: int = 0


class CollectionItemCreate(CollectionItemBase):
    pass


class CollectionItemUpdate(BaseModel):
    notes: Optional[str] = None
    order: Optional[int] = None


class CollectionItemResponse(CollectionItemBase):
    id: str
    collection_id: str
    added_at: datetime

    class Config:
        from_attributes = True


class CollectionResponse(CollectionBase):
    id: str
    created_at: datetime
    updated_at: datetime
    item_count: int = 0

    class Config:
        from_attributes = True


class CollectionDetailResponse(CollectionBase):
    id: str
    created_at: datetime
    updated_at: datetime
    items: list[CollectionItemResponse] = []

    class Config:
        from_attributes = True


class ReorderRequest(BaseModel):
    item_ids: list[str]
