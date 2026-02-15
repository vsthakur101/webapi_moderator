from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.collection import Collection, CollectionItem
from app.schemas.collection import (
    CollectionCreate,
    CollectionUpdate,
    CollectionResponse,
    CollectionDetailResponse,
    CollectionItemCreate,
    CollectionItemUpdate,
    CollectionItemResponse,
    ReorderRequest,
)

router = APIRouter()


@router.get("/", response_model=list[CollectionResponse])
async def list_collections(db: AsyncSession = Depends(get_db)):
    """List all collections with item counts."""
    # Get collections with item counts
    result = await db.execute(
        select(
            Collection,
            func.count(CollectionItem.id).label("item_count")
        )
        .outerjoin(CollectionItem)
        .group_by(Collection.id)
        .order_by(Collection.created_at.desc())
    )

    collections = []
    for row in result.all():
        collection = row[0]
        item_count = row[1]
        collection_dict = {
            "id": collection.id,
            "name": collection.name,
            "description": collection.description,
            "color": collection.color,
            "created_at": collection.created_at,
            "updated_at": collection.updated_at,
            "item_count": item_count,
        }
        collections.append(CollectionResponse(**collection_dict))

    return collections


@router.post("/", response_model=CollectionResponse)
async def create_collection(
    collection: CollectionCreate, db: AsyncSession = Depends(get_db)
):
    """Create a new collection."""
    db_collection = Collection(**collection.model_dump())
    db.add(db_collection)
    await db.commit()
    await db.refresh(db_collection)

    return CollectionResponse(
        id=db_collection.id,
        name=db_collection.name,
        description=db_collection.description,
        color=db_collection.color,
        created_at=db_collection.created_at,
        updated_at=db_collection.updated_at,
        item_count=0,
    )


@router.get("/{collection_id}", response_model=CollectionDetailResponse)
async def get_collection(collection_id: str, db: AsyncSession = Depends(get_db)):
    """Get a collection with its items."""
    result = await db.execute(
        select(Collection)
        .where(Collection.id == collection_id)
        .options(selectinload(Collection.items))
    )
    collection = result.scalar_one_or_none()

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Sort items by order
    sorted_items = sorted(collection.items, key=lambda x: x.order)

    return CollectionDetailResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        color=collection.color,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
        items=[
            CollectionItemResponse(
                id=item.id,
                collection_id=item.collection_id,
                request_id=item.request_id,
                notes=item.notes,
                order=item.order,
                added_at=item.added_at,
            )
            for item in sorted_items
        ],
    )


@router.patch("/{collection_id}", response_model=CollectionResponse)
async def update_collection(
    collection_id: str,
    collection_update: CollectionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a collection."""
    result = await db.execute(
        select(Collection).where(Collection.id == collection_id)
    )
    collection = result.scalar_one_or_none()

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    update_data = collection_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(collection, key, value)

    await db.commit()
    await db.refresh(collection)

    # Get item count
    count_result = await db.execute(
        select(func.count(CollectionItem.id)).where(
            CollectionItem.collection_id == collection_id
        )
    )
    item_count = count_result.scalar() or 0

    return CollectionResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        color=collection.color,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
        item_count=item_count,
    )


@router.delete("/{collection_id}")
async def delete_collection(collection_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a collection and all its items."""
    result = await db.execute(
        select(Collection).where(Collection.id == collection_id)
    )
    collection = result.scalar_one_or_none()

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    await db.delete(collection)
    await db.commit()

    return {"message": "Collection deleted"}


@router.post("/{collection_id}/items", response_model=CollectionItemResponse)
async def add_item_to_collection(
    collection_id: str,
    item: CollectionItemCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add a request to a collection."""
    # Check if collection exists
    result = await db.execute(
        select(Collection).where(Collection.id == collection_id)
    )
    collection = result.scalar_one_or_none()

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Check if item already exists in collection
    existing = await db.execute(
        select(CollectionItem).where(
            CollectionItem.collection_id == collection_id,
            CollectionItem.request_id == item.request_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400, detail="Request already in collection"
        )

    # Get max order
    max_order_result = await db.execute(
        select(func.max(CollectionItem.order)).where(
            CollectionItem.collection_id == collection_id
        )
    )
    max_order = max_order_result.scalar() or 0

    db_item = CollectionItem(
        collection_id=collection_id,
        request_id=item.request_id,
        notes=item.notes,
        order=max_order + 1,
    )
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)

    return CollectionItemResponse(
        id=db_item.id,
        collection_id=db_item.collection_id,
        request_id=db_item.request_id,
        notes=db_item.notes,
        order=db_item.order,
        added_at=db_item.added_at,
    )


@router.delete("/{collection_id}/items/{item_id}")
async def remove_item_from_collection(
    collection_id: str, item_id: str, db: AsyncSession = Depends(get_db)
):
    """Remove an item from a collection."""
    result = await db.execute(
        select(CollectionItem).where(
            CollectionItem.id == item_id,
            CollectionItem.collection_id == collection_id,
        )
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    await db.delete(item)
    await db.commit()

    return {"message": "Item removed from collection"}


@router.patch("/{collection_id}/items/{item_id}", response_model=CollectionItemResponse)
async def update_collection_item(
    collection_id: str,
    item_id: str,
    item_update: CollectionItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a collection item (notes, order)."""
    result = await db.execute(
        select(CollectionItem).where(
            CollectionItem.id == item_id,
            CollectionItem.collection_id == collection_id,
        )
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = item_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)

    return CollectionItemResponse(
        id=item.id,
        collection_id=item.collection_id,
        request_id=item.request_id,
        notes=item.notes,
        order=item.order,
        added_at=item.added_at,
    )


@router.post("/{collection_id}/items/reorder")
async def reorder_collection_items(
    collection_id: str,
    reorder: ReorderRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reorder items in a collection."""
    # Check if collection exists
    result = await db.execute(
        select(Collection).where(Collection.id == collection_id)
    )
    collection = result.scalar_one_or_none()

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Update order for each item
    for index, item_id in enumerate(reorder.item_ids):
        await db.execute(
            select(CollectionItem)
            .where(
                CollectionItem.id == item_id,
                CollectionItem.collection_id == collection_id,
            )
        )
        result = await db.execute(
            select(CollectionItem).where(
                CollectionItem.id == item_id,
                CollectionItem.collection_id == collection_id,
            )
        )
        item = result.scalar_one_or_none()
        if item:
            item.order = index

    await db.commit()

    return {"message": "Items reordered"}
