from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.rule import Rule
from app.schemas.rule import RuleCreate, RuleUpdate, RuleResponse

router = APIRouter()


@router.get("/", response_model=list[RuleResponse])
async def list_rules(
    db: AsyncSession = Depends(get_db),
):
    """List all auto-replace rules"""
    result = await db.execute(select(Rule).order_by(Rule.priority.desc()))
    rules = result.scalars().all()
    return [RuleResponse.model_validate(r) for r in rules]


@router.post("/", response_model=RuleResponse)
async def create_rule(
    rule: RuleCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new auto-replace rule"""
    db_rule = Rule(**rule.model_dump())
    db.add(db_rule)
    await db.commit()
    await db.refresh(db_rule)
    return RuleResponse.model_validate(db_rule)


@router.get("/{rule_id}", response_model=RuleResponse)
async def get_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific rule"""
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    return RuleResponse.model_validate(rule)


@router.patch("/{rule_id}", response_model=RuleResponse)
async def update_rule(
    rule_id: UUID,
    rule_update: RuleUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a rule"""
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    update_data = rule_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)

    await db.commit()
    await db.refresh(rule)
    return RuleResponse.model_validate(rule)


@router.delete("/{rule_id}")
async def delete_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a rule"""
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    await db.delete(rule)
    await db.commit()

    return {"status": "deleted"}


@router.post("/{rule_id}/toggle")
async def toggle_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Toggle a rule's enabled status"""
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule.enabled = not rule.enabled
    await db.commit()

    return {"enabled": rule.enabled}
