"""Scanner manager for vulnerability scanning."""

import asyncio
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scanner import Scan, ScanIssue
from app.models.target import Target, SiteMapNode
from app.scanner.checks import AVAILABLE_CHECKS, BaseCheck


class ScannerManager:
    """Manages vulnerability scans."""

    def __init__(self):
        self.active_scans: dict[str, asyncio.Task] = {}
        self.db_session_factory = None
        self.websocket_manager = None

    def set_dependencies(self, db_session_factory, websocket_manager):
        """Set dependencies after initialization."""
        self.db_session_factory = db_session_factory
        self.websocket_manager = websocket_manager

    def get_available_checks(self) -> list[dict]:
        """Get list of available vulnerability checks."""
        checks = []
        for check_id, check_class in AVAILABLE_CHECKS.items():
            checks.append(
                {
                    "id": check_id,
                    "name": check_class.name,
                    "description": check_class.description,
                    "category": check_class.category,
                    "severity": check_class.default_severity,
                }
            )
        return checks

    async def start_scan(
        self, scan_id: str, enabled_checks: list[str], db: AsyncSession
    ) -> None:
        """Start a vulnerability scan."""
        result = await db.execute(select(Scan).where(Scan.id == scan_id))
        scan = result.scalar_one_or_none()

        if not scan:
            raise ValueError("Scan not found")

        if scan.status == "running":
            raise ValueError("Scan already running")

        # Get URLs to scan
        urls = await self._get_scan_urls(scan, db)
        if not urls:
            raise ValueError("No URLs to scan")

        # Calculate total checks
        total_checks = len(urls) * len(enabled_checks)

        # Update scan status
        scan.status = "running"
        scan.started_at = datetime.utcnow()
        scan.total_checks = total_checks
        scan.completed_checks = 0
        scan.issues_found = 0
        scan.error_message = None
        await db.commit()

        # Start background scan task
        task = asyncio.create_task(self._run_scan(scan_id, urls, enabled_checks))
        self.active_scans[scan_id] = task

    async def pause_scan(self, scan_id: str, db: AsyncSession) -> None:
        """Pause a running scan."""
        result = await db.execute(select(Scan).where(Scan.id == scan_id))
        scan = result.scalar_one_or_none()

        if not scan:
            raise ValueError("Scan not found")

        scan.status = "paused"
        await db.commit()

        if scan_id in self.active_scans:
            self.active_scans[scan_id].cancel()
            del self.active_scans[scan_id]

    async def stop_scan(self, scan_id: str, db: AsyncSession) -> None:
        """Stop a scan."""
        result = await db.execute(select(Scan).where(Scan.id == scan_id))
        scan = result.scalar_one_or_none()

        if not scan:
            raise ValueError("Scan not found")

        scan.status = "completed"
        scan.completed_at = datetime.utcnow()
        await db.commit()

        if scan_id in self.active_scans:
            self.active_scans[scan_id].cancel()
            del self.active_scans[scan_id]

    async def _get_scan_urls(self, scan: Scan, db: AsyncSession) -> list[str]:
        """Get URLs to scan based on scan source."""
        urls = []

        if scan.source_type == "url":
            urls = scan.source_urls or []

        elif scan.source_type == "target" and scan.target_id:
            # Get URLs from target's site map
            result = await db.execute(
                select(SiteMapNode)
                .where(SiteMapNode.target_id == scan.target_id)
                .where(SiteMapNode.node_type == "file")
            )
            nodes = result.scalars().all()

            # Get target host
            target_result = await db.execute(
                select(Target).where(Target.id == scan.target_id)
            )
            target = target_result.scalar_one_or_none()

            if target:
                for node in nodes:
                    url = f"https://{target.host}{node.path}"
                    urls.append(url)

        elif scan.source_type == "request" and scan.source_request_id:
            # Get URL from request
            from app.models.request import Request

            result = await db.execute(
                select(Request).where(Request.id == scan.source_request_id)
            )
            request = result.scalar_one_or_none()
            if request:
                urls.append(request.url)

        return urls

    async def _run_scan(
        self, scan_id: str, urls: list[str], enabled_checks: list[str]
    ) -> None:
        """Run the scan in background."""
        checks: list[BaseCheck] = []

        try:
            # Initialize checks
            for check_id in enabled_checks:
                if check_id in AVAILABLE_CHECKS:
                    check = AVAILABLE_CHECKS[check_id]()
                    checks.append(check)

            # Run checks on each URL
            for url in urls:
                async with self.db_session_factory() as db:
                    # Check if scan is still running
                    result = await db.execute(select(Scan).where(Scan.id == scan_id))
                    scan = result.scalar_one_or_none()

                    if not scan or scan.status != "running":
                        break

                    for check in checks:
                        try:
                            # Send progress update
                            await self._send_progress(
                                scan_id,
                                scan.status,
                                scan.total_checks,
                                scan.completed_checks,
                                scan.issues_found,
                                check.name,
                                url,
                            )

                            # Run the check
                            results = await check.check(url)

                            # Save any issues found
                            for result_item in results:
                                if result_item.is_vulnerable:
                                    issue = ScanIssue(
                                        scan_id=scan_id,
                                        issue_type=result_item.issue_type,
                                        severity=result_item.severity,
                                        confidence=result_item.confidence,
                                        url=result_item.url,
                                        method=result_item.method,
                                        parameter=result_item.parameter,
                                        location=result_item.location,
                                        evidence=result_item.evidence,
                                        payload=result_item.payload,
                                        title=result_item.title,
                                        description=result_item.description,
                                        remediation=result_item.remediation,
                                        references=result_item.references,
                                        request_data=result_item.request_data,
                                        response_data=result_item.response_data,
                                    )
                                    db.add(issue)
                                    scan.issues_found += 1

                            scan.completed_checks += 1
                            await db.commit()

                        except Exception as e:
                            # Log error but continue
                            scan.completed_checks += 1
                            await db.commit()

            # Mark scan as completed
            async with self.db_session_factory() as db:
                result = await db.execute(select(Scan).where(Scan.id == scan_id))
                scan = result.scalar_one_or_none()
                if scan and scan.status == "running":
                    scan.status = "completed"
                    scan.completed_at = datetime.utcnow()
                    await db.commit()

                    await self._send_progress(
                        scan_id,
                        "completed",
                        scan.total_checks,
                        scan.completed_checks,
                        scan.issues_found,
                    )

        except asyncio.CancelledError:
            pass
        except Exception as e:
            async with self.db_session_factory() as db:
                result = await db.execute(select(Scan).where(Scan.id == scan_id))
                scan = result.scalar_one_or_none()
                if scan:
                    scan.status = "error"
                    scan.error_message = str(e)
                    await db.commit()
        finally:
            # Close all checks
            for check in checks:
                await check.close()

            if scan_id in self.active_scans:
                del self.active_scans[scan_id]

    async def _send_progress(
        self,
        scan_id: str,
        status: str,
        total_checks: int,
        completed_checks: int,
        issues_found: int,
        current_check: Optional[str] = None,
        current_url: Optional[str] = None,
    ) -> None:
        """Send scan progress via WebSocket."""
        if self.websocket_manager:
            await self.websocket_manager.broadcast(
                {
                    "type": "scan_progress",
                    "data": {
                        "scan_id": scan_id,
                        "status": status,
                        "total_checks": total_checks,
                        "completed_checks": completed_checks,
                        "issues_found": issues_found,
                        "current_check": current_check,
                        "current_url": current_url,
                    },
                }
            )


# Global scanner manager instance
scanner_manager = ScannerManager()
