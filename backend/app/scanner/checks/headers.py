"""Security Headers vulnerability check."""

from typing import Optional

from app.scanner.checks.base import BaseCheck, CheckResult


class SecurityHeadersCheck(BaseCheck):
    """Check for missing or misconfigured security headers."""

    id = "security_headers"
    name = "Security Headers"
    description = "Checks for missing or misconfigured HTTP security headers"
    category = "configuration"
    default_severity = "low"

    # Required security headers and their recommendations
    HEADERS = {
        "Strict-Transport-Security": {
            "name": "HTTP Strict Transport Security (HSTS)",
            "severity": "medium",
            "description": "HSTS header is missing. This header enforces secure HTTPS connections.",
            "remediation": "Add 'Strict-Transport-Security: max-age=31536000; includeSubDomains' header.",
        },
        "X-Content-Type-Options": {
            "name": "X-Content-Type-Options",
            "severity": "low",
            "description": "X-Content-Type-Options header is missing. This prevents MIME type sniffing.",
            "remediation": "Add 'X-Content-Type-Options: nosniff' header.",
        },
        "X-Frame-Options": {
            "name": "X-Frame-Options",
            "severity": "medium",
            "description": "X-Frame-Options header is missing. This prevents clickjacking attacks.",
            "remediation": "Add 'X-Frame-Options: DENY' or 'X-Frame-Options: SAMEORIGIN' header.",
        },
        "Content-Security-Policy": {
            "name": "Content Security Policy (CSP)",
            "severity": "medium",
            "description": "Content-Security-Policy header is missing. CSP helps prevent XSS and data injection attacks.",
            "remediation": "Implement a Content-Security-Policy header appropriate for your application.",
        },
        "X-XSS-Protection": {
            "name": "X-XSS-Protection",
            "severity": "info",
            "description": "X-XSS-Protection header is missing. While deprecated, it provides legacy browser protection.",
            "remediation": "Add 'X-XSS-Protection: 1; mode=block' header (or rely on CSP in modern browsers).",
        },
        "Referrer-Policy": {
            "name": "Referrer-Policy",
            "severity": "low",
            "description": "Referrer-Policy header is missing. This controls how much referrer information is shared.",
            "remediation": "Add 'Referrer-Policy: strict-origin-when-cross-origin' header.",
        },
        "Permissions-Policy": {
            "name": "Permissions-Policy",
            "severity": "low",
            "description": "Permissions-Policy header is missing. This controls browser features.",
            "remediation": "Add a Permissions-Policy header to restrict browser features.",
        },
    }

    # Headers that shouldn't be present
    BAD_HEADERS = {
        "Server": {
            "name": "Server Header Information Disclosure",
            "severity": "info",
            "description": "The Server header reveals server software information.",
            "remediation": "Remove or obfuscate the Server header.",
        },
        "X-Powered-By": {
            "name": "X-Powered-By Information Disclosure",
            "severity": "info",
            "description": "The X-Powered-By header reveals technology information.",
            "remediation": "Remove the X-Powered-By header.",
        },
        "X-AspNet-Version": {
            "name": "ASP.NET Version Disclosure",
            "severity": "info",
            "description": "The X-AspNet-Version header reveals the ASP.NET version.",
            "remediation": "Remove the X-AspNet-Version header in web.config.",
        },
    }

    async def check(
        self,
        url: str,
        method: str = "GET",
        headers: Optional[dict] = None,
        body: Optional[str] = None,
        params: Optional[dict] = None,
    ) -> list[CheckResult]:
        """Check for security header issues."""
        results = []

        # Make request
        response = await self.make_request(url, "GET", headers)
        if not response:
            return results

        response_headers = dict(response.headers)

        # Check for missing security headers
        for header, info in self.HEADERS.items():
            header_lower = header.lower()
            found = any(k.lower() == header_lower for k in response_headers.keys())

            if not found:
                results.append(
                    self.create_result(
                        is_vulnerable=True,
                        title=f"Missing {info['name']} Header",
                        description=info["description"],
                        url=url,
                        method="GET",
                        severity=info["severity"],
                        confidence="certain",
                        remediation=info["remediation"],
                        references=[
                            "https://owasp.org/www-project-secure-headers/",
                            "https://securityheaders.com/",
                        ],
                    )
                )

        # Check for bad headers that reveal information
        for header, info in self.BAD_HEADERS.items():
            header_lower = header.lower()
            for k, v in response_headers.items():
                if k.lower() == header_lower:
                    results.append(
                        self.create_result(
                            is_vulnerable=True,
                            title=info["name"],
                            description=f"{info['description']} Value: {v}",
                            url=url,
                            method="GET",
                            severity=info["severity"],
                            confidence="certain",
                            evidence=f"{header}: {v}",
                            remediation=info["remediation"],
                            references=[
                                "https://owasp.org/www-project-secure-headers/",
                            ],
                        )
                    )
                    break

        # Check for insecure cookie settings
        set_cookie = response_headers.get("Set-Cookie", "")
        if set_cookie:
            cookies = set_cookie if isinstance(set_cookie, list) else [set_cookie]
            for cookie in cookies:
                cookie_lower = cookie.lower()

                if "secure" not in cookie_lower:
                    results.append(
                        self.create_result(
                            is_vulnerable=True,
                            title="Cookie Missing Secure Flag",
                            description="A cookie is set without the Secure flag, allowing it to be sent over HTTP.",
                            url=url,
                            method="GET",
                            severity="medium",
                            confidence="certain",
                            evidence=cookie[:100],
                            remediation="Add the Secure flag to all cookies.",
                        )
                    )

                if "httponly" not in cookie_lower:
                    results.append(
                        self.create_result(
                            is_vulnerable=True,
                            title="Cookie Missing HttpOnly Flag",
                            description="A cookie is set without the HttpOnly flag, making it accessible to JavaScript.",
                            url=url,
                            method="GET",
                            severity="low",
                            confidence="certain",
                            evidence=cookie[:100],
                            remediation="Add the HttpOnly flag to cookies that don't need JavaScript access.",
                        )
                    )

                if "samesite" not in cookie_lower:
                    results.append(
                        self.create_result(
                            is_vulnerable=True,
                            title="Cookie Missing SameSite Attribute",
                            description="A cookie is set without the SameSite attribute, which helps prevent CSRF.",
                            url=url,
                            method="GET",
                            severity="low",
                            confidence="certain",
                            evidence=cookie[:100],
                            remediation="Add SameSite=Strict or SameSite=Lax attribute to cookies.",
                        )
                    )

        return results
