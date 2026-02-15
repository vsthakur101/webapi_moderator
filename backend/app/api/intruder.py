import base64
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.intruder import IntruderAttack, IntruderResult
from app.intruder import intruder_manager
from app.schemas.intruder import (
    AttackCreate,
    AttackUpdate,
    AttackResponse,
    ResultResponse,
    ResultDetailResponse,
    BuiltinPayloadList,
    PayloadGenerateRequest,
)

router = APIRouter()

# Built-in payload lists
BUILTIN_PAYLOADS = {
    "numbers_1_100": {
        "name": "Numbers 1-100",
        "description": "Sequential numbers from 1 to 100",
        "payloads": [str(i) for i in range(1, 101)],
    },
    "common_passwords": {
        "name": "Common Passwords",
        "description": "Top 20 common passwords",
        "payloads": [
            "123456", "password", "12345678", "qwerty", "123456789",
            "12345", "1234", "111111", "1234567", "dragon",
            "123123", "baseball", "iloveyou", "trustno1", "sunshine",
            "princess", "welcome", "shadow", "superman", "michael",
        ],
    },
    "common_usernames": {
        "name": "Common Usernames",
        "description": "Common usernames for testing",
        "payloads": [
            "admin", "administrator", "root", "user", "test",
            "guest", "info", "adm", "mysql", "oracle",
            "ftp", "pi", "puppet", "ansible", "vagrant",
        ],
    },
    "sqli_basic": {
        "name": "SQLi Basic",
        "description": "Basic SQL injection payloads",
        "payloads": [
            "'", "\"", "' OR '1'='1", "\" OR \"1\"=\"1", "' OR 1=1--",
            "\" OR 1=1--", "1' OR '1'='1", "1\" OR \"1\"=\"1",
            "' UNION SELECT NULL--", "' AND 1=1--", "' AND 1=2--",
            "1; DROP TABLE users--", "admin'--", "') OR ('1'='1",
        ],
    },
    "xss_basic": {
        "name": "XSS Basic",
        "description": "Basic XSS payloads",
        "payloads": [
            "<script>alert(1)</script>",
            "<img src=x onerror=alert(1)>",
            "<svg onload=alert(1)>",
            "javascript:alert(1)",
            "<body onload=alert(1)>",
            "<iframe src=\"javascript:alert(1)\">",
            "'\"><script>alert(1)</script>",
            "<input onfocus=alert(1) autofocus>",
            "<marquee onstart=alert(1)>",
            "<video src=x onerror=alert(1)>",
        ],
    },
    "path_traversal": {
        "name": "Path Traversal",
        "description": "Directory traversal payloads",
        "payloads": [
            "../", "..\\", "../../../etc/passwd",
            "..\\..\\..\\windows\\win.ini",
            "....//....//....//etc/passwd",
            "%2e%2e%2f", "%2e%2e/", "..%2f",
            "%2e%2e%5c", "..%5c", "..%255c",
            "/etc/passwd", "C:\\Windows\\win.ini",
        ],
    },
}


@router.get("/attacks", response_model=list[AttackResponse])
async def list_attacks(db: AsyncSession = Depends(get_db)):
    """List all intruder attacks."""
    result = await db.execute(
        select(IntruderAttack).order_by(IntruderAttack.created_at.desc())
    )
    attacks = result.scalars().all()

    return [
        AttackResponse(
            id=attack.id,
            name=attack.name,
            base_request_id=attack.base_request_id,
            attack_type=attack.attack_type,
            status=attack.status,
            method=attack.method,
            url_template=attack.url_template,
            headers_template=attack.headers_template or {},
            body_template=attack.body_template,
            positions=attack.positions or [],
            payload_sets=attack.payload_sets or [],
            threads=attack.threads,
            delay_ms=attack.delay_ms,
            follow_redirects=attack.follow_redirects,
            timeout_seconds=attack.timeout_seconds,
            total_requests=attack.total_requests,
            completed_requests=attack.completed_requests,
            error_message=attack.error_message,
            created_at=attack.created_at,
            started_at=attack.started_at,
            completed_at=attack.completed_at,
        )
        for attack in attacks
    ]


@router.post("/attacks", response_model=AttackResponse)
async def create_attack(attack: AttackCreate, db: AsyncSession = Depends(get_db)):
    """Create a new intruder attack."""
    # Calculate total requests
    payload_counts = [len(ps) for ps in attack.payload_sets]
    total = intruder_manager.calculate_total_requests(
        attack.attack_type, len(attack.positions), payload_counts
    )

    db_attack = IntruderAttack(
        name=attack.name,
        base_request_id=attack.base_request_id,
        attack_type=attack.attack_type,
        method=attack.method,
        url_template=attack.url_template,
        headers_template=attack.headers_template,
        body_template=attack.body_template,
        positions=[p.model_dump() for p in attack.positions],
        payload_sets=attack.payload_sets,
        threads=attack.threads,
        delay_ms=attack.delay_ms,
        follow_redirects=attack.follow_redirects,
        timeout_seconds=attack.timeout_seconds,
        total_requests=total,
    )

    db.add(db_attack)
    await db.commit()
    await db.refresh(db_attack)

    return AttackResponse(
        id=db_attack.id,
        name=db_attack.name,
        base_request_id=db_attack.base_request_id,
        attack_type=db_attack.attack_type,
        status=db_attack.status,
        method=db_attack.method,
        url_template=db_attack.url_template,
        headers_template=db_attack.headers_template or {},
        body_template=db_attack.body_template,
        positions=db_attack.positions or [],
        payload_sets=db_attack.payload_sets or [],
        threads=db_attack.threads,
        delay_ms=db_attack.delay_ms,
        follow_redirects=db_attack.follow_redirects,
        timeout_seconds=db_attack.timeout_seconds,
        total_requests=db_attack.total_requests,
        completed_requests=db_attack.completed_requests,
        error_message=db_attack.error_message,
        created_at=db_attack.created_at,
        started_at=db_attack.started_at,
        completed_at=db_attack.completed_at,
    )


@router.get("/attacks/{attack_id}", response_model=AttackResponse)
async def get_attack(attack_id: str, db: AsyncSession = Depends(get_db)):
    """Get attack details."""
    result = await db.execute(
        select(IntruderAttack).where(IntruderAttack.id == attack_id)
    )
    attack = result.scalar_one_or_none()

    if not attack:
        raise HTTPException(status_code=404, detail="Attack not found")

    return AttackResponse(
        id=attack.id,
        name=attack.name,
        base_request_id=attack.base_request_id,
        attack_type=attack.attack_type,
        status=attack.status,
        method=attack.method,
        url_template=attack.url_template,
        headers_template=attack.headers_template or {},
        body_template=attack.body_template,
        positions=attack.positions or [],
        payload_sets=attack.payload_sets or [],
        threads=attack.threads,
        delay_ms=attack.delay_ms,
        follow_redirects=attack.follow_redirects,
        timeout_seconds=attack.timeout_seconds,
        total_requests=attack.total_requests,
        completed_requests=attack.completed_requests,
        error_message=attack.error_message,
        created_at=attack.created_at,
        started_at=attack.started_at,
        completed_at=attack.completed_at,
    )


@router.patch("/attacks/{attack_id}", response_model=AttackResponse)
async def update_attack(
    attack_id: str, attack_update: AttackUpdate, db: AsyncSession = Depends(get_db)
):
    """Update an attack configuration."""
    result = await db.execute(
        select(IntruderAttack).where(IntruderAttack.id == attack_id)
    )
    attack = result.scalar_one_or_none()

    if not attack:
        raise HTTPException(status_code=404, detail="Attack not found")

    if attack.status == "running":
        raise HTTPException(status_code=400, detail="Cannot modify running attack")

    update_data = attack_update.model_dump(exclude_unset=True)

    # Convert positions if provided
    if "positions" in update_data and update_data["positions"]:
        update_data["positions"] = [p.model_dump() if hasattr(p, 'model_dump') else p for p in update_data["positions"]]

    for key, value in update_data.items():
        setattr(attack, key, value)

    # Recalculate total
    payload_counts = [len(ps) for ps in (attack.payload_sets or [])]
    attack.total_requests = intruder_manager.calculate_total_requests(
        attack.attack_type, len(attack.positions or []), payload_counts
    )

    await db.commit()
    await db.refresh(attack)

    return AttackResponse(
        id=attack.id,
        name=attack.name,
        base_request_id=attack.base_request_id,
        attack_type=attack.attack_type,
        status=attack.status,
        method=attack.method,
        url_template=attack.url_template,
        headers_template=attack.headers_template or {},
        body_template=attack.body_template,
        positions=attack.positions or [],
        payload_sets=attack.payload_sets or [],
        threads=attack.threads,
        delay_ms=attack.delay_ms,
        follow_redirects=attack.follow_redirects,
        timeout_seconds=attack.timeout_seconds,
        total_requests=attack.total_requests,
        completed_requests=attack.completed_requests,
        error_message=attack.error_message,
        created_at=attack.created_at,
        started_at=attack.started_at,
        completed_at=attack.completed_at,
    )


@router.delete("/attacks/{attack_id}")
async def delete_attack(attack_id: str, db: AsyncSession = Depends(get_db)):
    """Delete an attack."""
    result = await db.execute(
        select(IntruderAttack).where(IntruderAttack.id == attack_id)
    )
    attack = result.scalar_one_or_none()

    if not attack:
        raise HTTPException(status_code=404, detail="Attack not found")

    # Stop if running
    await intruder_manager.stop_attack(attack_id)

    await db.delete(attack)
    await db.commit()

    return {"message": "Attack deleted"}


@router.post("/attacks/{attack_id}/start")
async def start_attack(attack_id: str, db: AsyncSession = Depends(get_db)):
    """Start an attack."""
    result = await db.execute(
        select(IntruderAttack).where(IntruderAttack.id == attack_id)
    )
    attack = result.scalar_one_or_none()

    if not attack:
        raise HTTPException(status_code=404, detail="Attack not found")

    if attack.status == "running":
        raise HTTPException(status_code=400, detail="Attack already running")

    # Reset progress if starting fresh
    if attack.status in ["completed", "error"]:
        attack.completed_requests = 0
        attack.error_message = None
        # Clear previous results
        await db.execute(
            IntruderResult.__table__.delete().where(
                IntruderResult.attack_id == attack_id
            )
        )
        await db.commit()

    await intruder_manager.start_attack(attack_id)

    return {"message": "Attack started"}


@router.post("/attacks/{attack_id}/pause")
async def pause_attack(attack_id: str, db: AsyncSession = Depends(get_db)):
    """Pause an attack."""
    await intruder_manager.pause_attack(attack_id)

    result = await db.execute(
        select(IntruderAttack).where(IntruderAttack.id == attack_id)
    )
    attack = result.scalar_one_or_none()
    if attack:
        attack.status = "paused"
        await db.commit()

    return {"message": "Attack paused"}


@router.post("/attacks/{attack_id}/resume")
async def resume_attack(attack_id: str, db: AsyncSession = Depends(get_db)):
    """Resume a paused attack."""
    await intruder_manager.resume_attack(attack_id)

    result = await db.execute(
        select(IntruderAttack).where(IntruderAttack.id == attack_id)
    )
    attack = result.scalar_one_or_none()
    if attack:
        attack.status = "running"
        await db.commit()

    return {"message": "Attack resumed"}


@router.post("/attacks/{attack_id}/stop")
async def stop_attack(attack_id: str, db: AsyncSession = Depends(get_db)):
    """Stop an attack."""
    await intruder_manager.stop_attack(attack_id)

    result = await db.execute(
        select(IntruderAttack).where(IntruderAttack.id == attack_id)
    )
    attack = result.scalar_one_or_none()
    if attack:
        attack.status = "configured"
        await db.commit()

    return {"message": "Attack stopped"}


@router.get("/attacks/{attack_id}/results", response_model=list[ResultResponse])
async def get_attack_results(
    attack_id: str,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Get attack results."""
    result = await db.execute(
        select(IntruderResult)
        .where(IntruderResult.attack_id == attack_id)
        .order_by(IntruderResult.timestamp)
        .limit(limit)
        .offset(offset)
    )
    results = result.scalars().all()

    return [
        ResultResponse(
            id=r.id,
            attack_id=r.attack_id,
            position_index=r.position_index,
            payloads=r.payloads or [],
            request_url=r.request_url,
            response_status=r.response_status,
            response_length=r.response_length,
            response_time_ms=r.response_time_ms,
            error=r.error,
            timestamp=r.timestamp,
        )
        for r in results
    ]


@router.get("/attacks/{attack_id}/results/{result_id}", response_model=ResultDetailResponse)
async def get_result_detail(
    attack_id: str, result_id: str, db: AsyncSession = Depends(get_db)
):
    """Get detailed result with body."""
    result = await db.execute(
        select(IntruderResult).where(
            IntruderResult.id == result_id,
            IntruderResult.attack_id == attack_id,
        )
    )
    r = result.scalar_one_or_none()

    if not r:
        raise HTTPException(status_code=404, detail="Result not found")

    return ResultDetailResponse(
        id=r.id,
        attack_id=r.attack_id,
        position_index=r.position_index,
        payloads=r.payloads or [],
        request_url=r.request_url,
        response_status=r.response_status,
        response_length=r.response_length,
        response_time_ms=r.response_time_ms,
        error=r.error,
        timestamp=r.timestamp,
        request_body_b64=base64.b64encode(r.request_body).decode() if r.request_body else None,
        response_body_b64=base64.b64encode(r.response_body).decode() if r.response_body else None,
        response_headers=r.response_headers,
    )


@router.get("/payloads/builtin", response_model=list[BuiltinPayloadList])
async def list_builtin_payloads():
    """List available built-in payload lists."""
    return [
        BuiltinPayloadList(
            name=info["name"],
            description=info["description"],
            count=len(info["payloads"]),
        )
        for key, info in BUILTIN_PAYLOADS.items()
    ]


@router.get("/payloads/builtin/{name}")
async def get_builtin_payloads(name: str):
    """Get a built-in payload list."""
    if name not in BUILTIN_PAYLOADS:
        raise HTTPException(status_code=404, detail="Payload list not found")

    return {
        "name": BUILTIN_PAYLOADS[name]["name"],
        "description": BUILTIN_PAYLOADS[name]["description"],
        "payloads": BUILTIN_PAYLOADS[name]["payloads"],
    }


@router.post("/payloads/generate")
async def generate_payloads(request: PayloadGenerateRequest):
    """Generate payloads based on parameters."""
    payloads = []

    if request.generator_type == "numbers":
        start = request.params.get("start", 1)
        end = request.params.get("end", 100)
        step = request.params.get("step", 1)
        payloads = [str(i) for i in range(start, end + 1, step)]

    elif request.generator_type == "dates":
        # Simple date range
        import datetime
        start_str = request.params.get("start", "2024-01-01")
        end_str = request.params.get("end", "2024-01-31")
        format_str = request.params.get("format", "%Y-%m-%d")

        start = datetime.datetime.strptime(start_str, "%Y-%m-%d")
        end = datetime.datetime.strptime(end_str, "%Y-%m-%d")

        current = start
        while current <= end:
            payloads.append(current.strftime(format_str))
            current += datetime.timedelta(days=1)

    elif request.generator_type == "custom":
        # Custom list from params
        payloads = request.params.get("values", [])

    return {"payloads": payloads}
