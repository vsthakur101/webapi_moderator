"""Base check class for scanner vulnerability checks."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Any
import httpx


@dataclass
class CheckResult:
    """Result of a vulnerability check."""

    is_vulnerable: bool
    issue_type: str
    severity: str  # critical, high, medium, low, info
    confidence: str  # certain, firm, tentative
    title: str
    description: str
    url: str
    method: str = "GET"
    parameter: Optional[str] = None
    location: Optional[str] = None  # body, header, query, cookie
    evidence: Optional[str] = None
    payload: Optional[str] = None
    request_data: Optional[dict] = None
    response_data: Optional[dict] = None
    remediation: Optional[str] = None
    references: list[str] = field(default_factory=list)


class BaseCheck(ABC):
    """Base class for vulnerability checks."""

    # Check metadata - override in subclasses
    id: str = "base"
    name: str = "Base Check"
    description: str = "Base vulnerability check"
    category: str = "general"
    default_severity: str = "info"

    def __init__(self, settings: Optional[dict] = None):
        self.settings = settings or {}
        self.client = httpx.AsyncClient(timeout=30.0, follow_redirects=True, verify=False)

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()

    @abstractmethod
    async def check(
        self,
        url: str,
        method: str = "GET",
        headers: Optional[dict] = None,
        body: Optional[str] = None,
        params: Optional[dict] = None,
    ) -> list[CheckResult]:
        """
        Run the vulnerability check.

        Args:
            url: Target URL
            method: HTTP method
            headers: Request headers
            body: Request body
            params: Query parameters

        Returns:
            List of CheckResult objects for any vulnerabilities found
        """
        pass

    async def make_request(
        self,
        url: str,
        method: str = "GET",
        headers: Optional[dict] = None,
        body: Optional[str] = None,
        params: Optional[dict] = None,
    ) -> Optional[httpx.Response]:
        """Make an HTTP request with error handling."""
        try:
            response = await self.client.request(
                method=method,
                url=url,
                headers=headers,
                content=body,
                params=params,
            )
            return response
        except Exception:
            return None

    def create_result(
        self,
        is_vulnerable: bool,
        title: str,
        description: str,
        url: str,
        method: str = "GET",
        severity: Optional[str] = None,
        confidence: str = "tentative",
        **kwargs,
    ) -> CheckResult:
        """Helper to create a CheckResult with defaults."""
        return CheckResult(
            is_vulnerable=is_vulnerable,
            issue_type=self.id,
            severity=severity or self.default_severity,
            confidence=confidence,
            title=title,
            description=description,
            url=url,
            method=method,
            **kwargs,
        )
