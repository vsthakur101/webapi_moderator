"""Cross-Site Request Forgery (CSRF) vulnerability check."""

import re
from typing import Optional

from bs4 import BeautifulSoup

from app.scanner.checks.base import BaseCheck, CheckResult


class CSRFCheck(BaseCheck):
    """Check for CSRF vulnerabilities."""

    id = "csrf"
    name = "Cross-Site Request Forgery (CSRF)"
    description = "Detects forms without CSRF protection"
    category = "session"
    default_severity = "medium"

    # Common CSRF token field names
    CSRF_FIELD_NAMES = [
        "csrf",
        "csrf_token",
        "csrftoken",
        "csrfmiddlewaretoken",
        "_csrf",
        "_token",
        "authenticity_token",
        "token",
        "xsrf",
        "xsrf_token",
        "_xsrf",
        "anti-csrf-token",
        "anticsrf",
        "__requestverificationtoken",
    ]

    async def check(
        self,
        url: str,
        method: str = "GET",
        headers: Optional[dict] = None,
        body: Optional[str] = None,
        params: Optional[dict] = None,
    ) -> list[CheckResult]:
        """Check for CSRF vulnerabilities."""
        results = []

        # Make request
        response = await self.make_request(url, "GET", headers)
        if not response:
            return results

        # Check for CSRF headers in response
        csrf_header = response.headers.get("X-CSRF-Token") or response.headers.get(
            "X-XSRF-Token"
        )

        # Parse HTML
        try:
            soup = BeautifulSoup(response.text, "html.parser")
        except Exception:
            return results

        # Find all forms
        forms = soup.find_all("form")

        for form in forms:
            form_action = form.get("action", "")
            form_method = form.get("method", "get").upper()

            # Only check POST forms (GET forms are typically safe)
            if form_method != "POST":
                continue

            # Check if form has CSRF token
            has_csrf_token = False

            # Check hidden inputs for CSRF tokens
            inputs = form.find_all("input", {"type": "hidden"})
            for inp in inputs:
                name = (inp.get("name") or "").lower()
                if any(csrf_name in name for csrf_name in self.CSRF_FIELD_NAMES):
                    has_csrf_token = True
                    break

            # Check for data attributes that might indicate CSRF
            if not has_csrf_token:
                form_attrs = str(form.attrs).lower()
                if any(csrf_name in form_attrs for csrf_name in self.CSRF_FIELD_NAMES):
                    has_csrf_token = True

            # Check meta tags for CSRF tokens
            if not has_csrf_token:
                meta_tags = soup.find_all("meta")
                for meta in meta_tags:
                    name = (meta.get("name") or "").lower()
                    if any(csrf_name in name for csrf_name in self.CSRF_FIELD_NAMES):
                        has_csrf_token = True
                        break

            # If no CSRF token found, report vulnerability
            if not has_csrf_token:
                # Determine severity based on form fields
                severity = "medium"
                field_names = [
                    (inp.get("name") or "").lower()
                    for inp in form.find_all(["input", "select", "textarea"])
                ]

                # Higher severity for sensitive forms
                sensitive_fields = ["password", "email", "delete", "admin", "transfer", "payment"]
                if any(
                    sensitive in name
                    for name in field_names
                    for sensitive in sensitive_fields
                ):
                    severity = "high"

                # Get form description
                form_id = form.get("id", "")
                form_name = form.get("name", "")
                form_desc = form_id or form_name or form_action or "unnamed form"

                results.append(
                    self.create_result(
                        is_vulnerable=True,
                        title=f"Form Without CSRF Protection: {form_desc[:50]}",
                        description=f"A POST form ({form_desc}) does not appear to have CSRF protection. "
                        "An attacker could trick users into submitting unintended actions.",
                        url=url,
                        method="POST",
                        severity=severity,
                        confidence="firm",
                        evidence=f"Form action: {form_action}, Fields: {', '.join(field_names[:5])}",
                        remediation="Implement CSRF tokens in all state-changing forms. "
                        "Use the SameSite cookie attribute. "
                        "Consider using a CSRF protection library or framework feature.",
                        references=[
                            "https://owasp.org/www-community/attacks/csrf",
                            "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html",
                        ],
                    )
                )

        # Check for state-changing endpoints without CSRF protection
        # by checking if API endpoints accept POST without CSRF headers
        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            # This is an API endpoint - check if it requires CSRF
            # APIs using token-based auth (like JWT) are generally safe
            # But cookie-based auth without CSRF headers is vulnerable

            auth_header = headers.get("Authorization") if headers else None
            has_cookie = "cookie" in str(headers).lower() if headers else False

            if has_cookie and not csrf_header:
                results.append(
                    self.create_result(
                        is_vulnerable=True,
                        title="API Endpoint May Lack CSRF Protection",
                        description="This API endpoint uses cookie-based authentication but may not have CSRF protection.",
                        url=url,
                        method="POST",
                        severity="medium",
                        confidence="tentative",
                        remediation="Implement CSRF tokens for cookie-authenticated API endpoints. "
                        "Consider using token-based authentication (like JWT) in headers.",
                        references=[
                            "https://owasp.org/www-community/attacks/csrf",
                        ],
                    )
                )

        return results
