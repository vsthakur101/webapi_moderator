"""Information Disclosure vulnerability check."""

import re
from typing import Optional

from app.scanner.checks.base import BaseCheck, CheckResult


class InformationDisclosureCheck(BaseCheck):
    """Check for information disclosure vulnerabilities."""

    id = "information_disclosure"
    name = "Information Disclosure"
    description = "Detects sensitive information disclosure in responses"
    category = "information"
    default_severity = "low"

    # Patterns for sensitive information
    PATTERNS = {
        "email": {
            "pattern": r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+",
            "severity": "info",
            "title": "Email Address Disclosure",
            "description": "Email addresses were found in the response.",
        },
        "ip_address": {
            "pattern": r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b",
            "severity": "info",
            "title": "Internal IP Address Disclosure",
            "description": "IP addresses were found in the response.",
            "filter": lambda ip: ip.startswith(("10.", "192.168.", "172.16.", "172.17.", "172.18.", "172.19.", "172.2", "172.30.", "172.31.")),
        },
        "aws_key": {
            "pattern": r"AKIA[0-9A-Z]{16}",
            "severity": "critical",
            "title": "AWS Access Key Disclosure",
            "description": "An AWS access key was found in the response.",
        },
        "private_key": {
            "pattern": r"-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----",
            "severity": "critical",
            "title": "Private Key Disclosure",
            "description": "A private key was found in the response.",
        },
        "api_key": {
            "pattern": r"(?i)(?:api[_-]?key|apikey|api[_-]?secret)['\"]?\s*[:=]\s*['\"]?([a-zA-Z0-9_-]{20,})",
            "severity": "high",
            "title": "API Key Disclosure",
            "description": "An API key was found in the response.",
        },
        "password": {
            "pattern": r"(?i)(?:password|passwd|pwd)['\"]?\s*[:=]\s*['\"]?([^\s'\"]{4,})",
            "severity": "high",
            "title": "Password Disclosure",
            "description": "A password was found in the response.",
        },
        "credit_card": {
            "pattern": r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b",
            "severity": "critical",
            "title": "Credit Card Number Disclosure",
            "description": "A credit card number was found in the response.",
        },
        "ssn": {
            "pattern": r"\b\d{3}-\d{2}-\d{4}\b",
            "severity": "critical",
            "title": "Social Security Number Disclosure",
            "description": "A Social Security Number was found in the response.",
        },
        "jwt_token": {
            "pattern": r"eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+",
            "severity": "medium",
            "title": "JWT Token Disclosure",
            "description": "A JWT token was found in the response.",
        },
        "stack_trace": {
            "pattern": r"(?:Traceback \(most recent call last\)|at [a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+\([^)]*\)|Exception in thread)",
            "severity": "medium",
            "title": "Stack Trace Disclosure",
            "description": "A stack trace was found in the response, which may reveal internal application details.",
        },
        "debug_info": {
            "pattern": r"(?i)(?:debug\s*[:=]\s*true|DEBUG\s*=\s*True|debug_mode|debugger)",
            "severity": "medium",
            "title": "Debug Mode Enabled",
            "description": "Debug mode appears to be enabled, which may expose sensitive information.",
        },
        "database_error": {
            "pattern": r"(?i)(?:mysql_|pg_|sqlite_|ora-\d+|sqlstate|database error|db error)",
            "severity": "medium",
            "title": "Database Error Message",
            "description": "A database error message was found, which may reveal database structure.",
        },
        "file_path": {
            "pattern": r"(?:/var/www/|/home/\w+/|C:\\(?:Users|Windows)\\|/usr/local/)",
            "severity": "low",
            "title": "File Path Disclosure",
            "description": "File system paths were found in the response.",
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
        """Check for information disclosure."""
        results = []

        # Make request
        response = await self.make_request(url, method, headers, body, params)
        if not response:
            return results

        response_text = response.text

        # Check each pattern
        for pattern_name, pattern_info in self.PATTERNS.items():
            matches = re.findall(pattern_info["pattern"], response_text)

            # Apply filter if exists
            if "filter" in pattern_info:
                matches = [m for m in matches if pattern_info["filter"](m)]

            if matches:
                # Deduplicate matches
                unique_matches = list(set(matches[:5]))  # Limit to 5 unique matches

                results.append(
                    self.create_result(
                        is_vulnerable=True,
                        title=pattern_info["title"],
                        description=pattern_info["description"],
                        url=url,
                        method=method,
                        severity=pattern_info["severity"],
                        confidence="firm" if pattern_info["severity"] in ["critical", "high"] else "tentative",
                        evidence=", ".join(str(m)[:50] for m in unique_matches),
                        remediation="Review and remove sensitive information from responses. "
                        "Implement proper error handling that doesn't expose internal details.",
                        references=[
                            "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/",
                        ],
                    )
                )

        # Check for common sensitive files
        sensitive_paths = [
            "/.git/config",
            "/.env",
            "/wp-config.php.bak",
            "/config.php.bak",
            "/.htaccess",
            "/web.config",
            "/crossdomain.xml",
            "/robots.txt",
            "/sitemap.xml",
            "/.well-known/security.txt",
        ]

        from urllib.parse import urljoin

        for path in sensitive_paths:
            test_url = urljoin(url, path)
            response = await self.make_request(test_url, "GET")

            if response and response.status_code == 200:
                content_type = response.headers.get("content-type", "")

                # Skip if it's an error page disguised as 200
                if "text/html" in content_type and len(response.text) < 100:
                    continue

                results.append(
                    self.create_result(
                        is_vulnerable=True,
                        title=f"Sensitive File Accessible: {path}",
                        description=f"The file {path} is accessible, which may contain sensitive information.",
                        url=test_url,
                        method="GET",
                        severity="medium" if path in ["/.git/config", "/.env"] else "info",
                        confidence="certain",
                        evidence=f"HTTP 200 OK, Content-Length: {len(response.text)}",
                        remediation="Restrict access to sensitive files using server configuration.",
                        references=[
                            "https://owasp.org/www-project-web-security-testing-guide/",
                        ],
                    )
                )

        return results
