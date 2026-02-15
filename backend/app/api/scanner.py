"""Scanner API routes for vulnerability scanning."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.scanner import Scan, ScanConfiguration, ScanIssue
from app.scanner.manager import scanner_manager
from app.scanner.checks import AVAILABLE_CHECKS
from app.schemas.scanner import (
    ScanCreate,
    ScanUpdate,
    ScanResponse,
    ScanDetailResponse,
    ScanConfigCreate,
    ScanConfigUpdate,
    ScanConfigResponse,
    IssueResponse,
    IssueUpdate,
    CheckInfo,
    IssueSummary,
)

router = APIRouter()


# Available checks
@router.get("/checks", response_model=list[CheckInfo])
async def list_checks():
    """List all available vulnerability checks."""
    return scanner_manager.get_available_checks()


# Scan Configurations
@router.get("/configs", response_model=list[ScanConfigResponse])
async def list_configs(db: AsyncSession = Depends(get_db)):
    """List all scan configurations."""
    result = await db.execute(
        select(ScanConfiguration).order_by(ScanConfiguration.created_at.desc())
    )
    return result.scalars().all()


@router.post("/configs", response_model=ScanConfigResponse)
async def create_config(config: ScanConfigCreate, db: AsyncSession = Depends(get_db)):
    """Create a new scan configuration."""
    db_config = ScanConfiguration(
        name=config.name,
        description=config.description,
        enabled_checks=config.enabled_checks,
        settings=config.settings,
    )
    db.add(db_config)
    await db.commit()
    await db.refresh(db_config)
    return db_config


@router.get("/configs/{config_id}", response_model=ScanConfigResponse)
async def get_config(config_id: str, db: AsyncSession = Depends(get_db)):
    """Get a scan configuration."""
    result = await db.execute(
        select(ScanConfiguration).where(ScanConfiguration.id == config_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return config


@router.patch("/configs/{config_id}", response_model=ScanConfigResponse)
async def update_config(
    config_id: str, config_update: ScanConfigUpdate, db: AsyncSession = Depends(get_db)
):
    """Update a scan configuration."""
    result = await db.execute(
        select(ScanConfiguration).where(ScanConfiguration.id == config_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")

    update_data = config_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)

    await db.commit()
    await db.refresh(config)
    return config


@router.delete("/configs/{config_id}")
async def delete_config(config_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a scan configuration."""
    result = await db.execute(
        select(ScanConfiguration).where(ScanConfiguration.id == config_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")

    await db.delete(config)
    await db.commit()
    return {"message": "Configuration deleted"}


# Scans
@router.get("/scans", response_model=list[ScanResponse])
async def list_scans(db: AsyncSession = Depends(get_db)):
    """List all scans."""
    result = await db.execute(select(Scan).order_by(Scan.created_at.desc()))
    return result.scalars().all()


@router.post("/scans", response_model=ScanResponse)
async def create_scan(scan: ScanCreate, db: AsyncSession = Depends(get_db)):
    """Create a new scan."""
    db_scan = Scan(
        name=scan.name,
        config_id=scan.config_id,
        target_id=scan.target_id,
        source_type=scan.source_type,
        source_request_id=scan.source_request_id,
        source_urls=scan.source_urls,
    )
    db.add(db_scan)
    await db.commit()
    await db.refresh(db_scan)
    return db_scan


@router.get("/scans/{scan_id}", response_model=ScanDetailResponse)
async def get_scan(scan_id: str, db: AsyncSession = Depends(get_db)):
    """Get scan details with issues."""
    result = await db.execute(select(Scan).where(Scan.id == scan_id))
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    # Get issues
    issues_result = await db.execute(
        select(ScanIssue)
        .where(ScanIssue.scan_id == scan_id)
        .order_by(
            # Order by severity (critical > high > medium > low > info)
            ScanIssue.severity.desc(),
            ScanIssue.discovered_at.desc(),
        )
    )
    issues = issues_result.scalars().all()

    return ScanDetailResponse(
        id=scan.id,
        name=scan.name,
        config_id=scan.config_id,
        target_id=scan.target_id,
        status=scan.status,
        source_type=scan.source_type,
        source_request_id=scan.source_request_id,
        source_urls=scan.source_urls or [],
        total_checks=scan.total_checks,
        completed_checks=scan.completed_checks,
        issues_found=scan.issues_found,
        error_message=scan.error_message,
        created_at=scan.created_at,
        started_at=scan.started_at,
        completed_at=scan.completed_at,
        issues=[
            IssueResponse(
                id=issue.id,
                scan_id=issue.scan_id,
                issue_type=issue.issue_type,
                severity=issue.severity,
                confidence=issue.confidence,
                url=issue.url,
                method=issue.method,
                parameter=issue.parameter,
                location=issue.location,
                request_data=issue.request_data,
                response_data=issue.response_data,
                evidence=issue.evidence,
                payload=issue.payload,
                title=issue.title,
                description=issue.description,
                remediation=issue.remediation,
                references=issue.references or [],
                status=issue.status,
                notes=issue.notes,
                discovered_at=issue.discovered_at,
            )
            for issue in issues
        ],
    )


@router.patch("/scans/{scan_id}", response_model=ScanResponse)
async def update_scan(
    scan_id: str, scan_update: ScanUpdate, db: AsyncSession = Depends(get_db)
):
    """Update a scan."""
    result = await db.execute(select(Scan).where(Scan.id == scan_id))
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    if scan.status == "running":
        raise HTTPException(status_code=400, detail="Cannot modify running scan")

    update_data = scan_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(scan, key, value)

    await db.commit()
    await db.refresh(scan)
    return scan


@router.delete("/scans/{scan_id}")
async def delete_scan(scan_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a scan and its issues."""
    result = await db.execute(select(Scan).where(Scan.id == scan_id))
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    if scan.status == "running":
        raise HTTPException(status_code=400, detail="Cannot delete running scan")

    await db.delete(scan)
    await db.commit()
    return {"message": "Scan deleted"}


@router.post("/scans/{scan_id}/start")
async def start_scan(
    scan_id: str,
    enabled_checks: list[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Start a scan."""
    # Get scan
    result = await db.execute(select(Scan).where(Scan.id == scan_id))
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    # Get enabled checks from config if not provided
    if not enabled_checks:
        if scan.config_id:
            config_result = await db.execute(
                select(ScanConfiguration).where(ScanConfiguration.id == scan.config_id)
            )
            config = config_result.scalar_one_or_none()
            if config:
                enabled_checks = config.enabled_checks

    # Default to all checks if none specified
    if not enabled_checks:
        enabled_checks = list(AVAILABLE_CHECKS.keys())

    try:
        await scanner_manager.start_scan(scan_id, enabled_checks, db)
        return {"message": "Scan started"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/scans/{scan_id}/pause")
async def pause_scan(scan_id: str, db: AsyncSession = Depends(get_db)):
    """Pause a scan."""
    try:
        await scanner_manager.pause_scan(scan_id, db)
        return {"message": "Scan paused"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/scans/{scan_id}/stop")
async def stop_scan(scan_id: str, db: AsyncSession = Depends(get_db)):
    """Stop a scan."""
    try:
        await scanner_manager.stop_scan(scan_id, db)
        return {"message": "Scan stopped"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Issues
@router.get("/scans/{scan_id}/issues", response_model=list[IssueResponse])
async def list_issues(
    scan_id: str,
    severity: str = None,
    issue_type: str = None,
    status: str = None,
    db: AsyncSession = Depends(get_db),
):
    """List issues for a scan with optional filtering."""
    result = await db.execute(select(Scan).where(Scan.id == scan_id))
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    query = select(ScanIssue).where(ScanIssue.scan_id == scan_id)

    if severity:
        query = query.where(ScanIssue.severity == severity)
    if issue_type:
        query = query.where(ScanIssue.issue_type == issue_type)
    if status:
        query = query.where(ScanIssue.status == status)

    query = query.order_by(ScanIssue.severity.desc(), ScanIssue.discovered_at.desc())

    issues_result = await db.execute(query)
    return issues_result.scalars().all()


@router.get("/scans/{scan_id}/summary", response_model=IssueSummary)
async def get_issue_summary(scan_id: str, db: AsyncSession = Depends(get_db)):
    """Get issue count summary by severity."""
    result = await db.execute(select(Scan).where(Scan.id == scan_id))
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    issues_result = await db.execute(
        select(ScanIssue).where(ScanIssue.scan_id == scan_id)
    )
    issues = issues_result.scalars().all()

    summary = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for issue in issues:
        if issue.severity in summary:
            summary[issue.severity] += 1

    return IssueSummary(**summary)


@router.patch("/issues/{issue_id}", response_model=IssueResponse)
async def update_issue(
    issue_id: str, issue_update: IssueUpdate, db: AsyncSession = Depends(get_db)
):
    """Update an issue (status, notes)."""
    result = await db.execute(select(ScanIssue).where(ScanIssue.id == issue_id))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    update_data = issue_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(issue, key, value)

    await db.commit()
    await db.refresh(issue)
    return issue
