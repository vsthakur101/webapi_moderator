"""Cross-Site Scripting (XSS) vulnerability check."""

import re
import uuid
from typing import Optional
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse

from app.scanner.checks.base import BaseCheck, CheckResult


class XSSCheck(BaseCheck):
    """Check for Cross-Site Scripting vulnerabilities."""

    id = "xss"
    name = "Cross-Site Scripting (XSS)"
    description = "Detects reflected and stored XSS vulnerabilities"
    category = "injection"
    default_severity = "medium"

    # XSS test payloads with unique markers
    def get_payloads(self) -> list[tuple[str, str]]:
        """Generate XSS payloads with unique markers."""
        marker = uuid.uuid4().hex[:8]
        return [
            (f"<script>alert('{marker}')</script>", marker),
            (f"<img src=x onerror=alert('{marker}')>", marker),
            (f"<svg onload=alert('{marker}')>", marker),
            (f"javascript:alert('{marker}')", marker),
            (f"<body onload=alert('{marker}')>", marker),
            (f"<div onmouseover=alert('{marker}')>", marker),
            (f"'\"><script>alert('{marker}')</script>", marker),
            (f"\"onfocus=\"alert('{marker}')\" autofocus=\"", marker),
            (f"'-alert('{marker}')-'", marker),
            (f"<iframe src=\"javascript:alert('{marker}')\">", marker),
        ]

    async def check(
        self,
        url: str,
        method: str = "GET",
        headers: Optional[dict] = None,
        body: Optional[str] = None,
        params: Optional[dict] = None,
    ) -> list[CheckResult]:
        """Check for XSS vulnerabilities."""
        results = []
        headers = headers or {}

        # Parse URL for parameters
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)

        # Test each query parameter
        for param_name, param_values in query_params.items():
            original_value = param_values[0] if param_values else ""

            for payload, marker in self.get_payloads():
                # Create modified params
                modified_params = {k: v[0] for k, v in query_params.items()}
                modified_params[param_name] = payload

                # Rebuild URL
                new_query = urlencode(modified_params)
                test_url = urlunparse(
                    (
                        parsed.scheme,
                        parsed.netloc,
                        parsed.path,
                        parsed.params,
                        new_query,
                        parsed.fragment,
                    )
                )

                # Make request with payload
                response = await self.make_request(test_url, method, headers, body)
                if not response:
                    continue

                response_text = response.text

                # Check if payload is reflected in response
                if payload in response_text:
                    # Full payload reflected - likely vulnerable
                    results.append(
                        self.create_result(
                            is_vulnerable=True,
                            title=f"Reflected XSS in '{param_name}' parameter",
                            description=f"The parameter '{param_name}' reflects user input without proper encoding. "
                            f"The full XSS payload was reflected in the response.",
                            url=url,
                            method=method,
                            parameter=param_name,
                            location="query",
                            evidence=payload[:100],
                            payload=payload,
                            severity="high",
                            confidence="certain",
                            remediation="Encode all user input before rendering in HTML. "
                            "Use Content-Security-Policy headers. "
                            "Implement input validation.",
                            references=[
                                "https://owasp.org/www-community/attacks/xss/",
                                "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html",
                            ],
                        )
                    )
                    break  # Found vulnerability for this param

                # Check if marker is reflected (partial payload reflection)
                elif marker in response_text:
                    results.append(
                        self.create_result(
                            is_vulnerable=True,
                            title=f"Potential XSS in '{param_name}' parameter",
                            description=f"The parameter '{param_name}' reflects user input. "
                            f"While the full payload was sanitized, parts were reflected.",
                            url=url,
                            method=method,
                            parameter=param_name,
                            location="query",
                            evidence=f"Marker '{marker}' found in response",
                            payload=payload,
                            severity="medium",
                            confidence="tentative",
                            remediation="Review the input sanitization. "
                            "Ensure all user input is properly encoded for the context.",
                            references=[
                                "https://owasp.org/www-community/attacks/xss/",
                            ],
                        )
                    )
                    # Don't break - continue checking for certain vulnerabilities

            # If we found a certain vulnerability for this param, move to next
            if any(r.parameter == param_name and r.confidence == "certain" for r in results):
                continue

        return results
