"""Scanner vulnerability checks."""

from app.scanner.checks.base import BaseCheck, CheckResult
from app.scanner.checks.sql_injection import SQLInjectionCheck
from app.scanner.checks.xss import XSSCheck
from app.scanner.checks.headers import SecurityHeadersCheck
from app.scanner.checks.information import InformationDisclosureCheck
from app.scanner.checks.csrf import CSRFCheck

# Registry of all available checks
AVAILABLE_CHECKS = {
    "sql_injection": SQLInjectionCheck,
    "xss": XSSCheck,
    "security_headers": SecurityHeadersCheck,
    "information_disclosure": InformationDisclosureCheck,
    "csrf": CSRFCheck,
}

__all__ = [
    "BaseCheck",
    "CheckResult",
    "SQLInjectionCheck",
    "XSSCheck",
    "SecurityHeadersCheck",
    "InformationDisclosureCheck",
    "CSRFCheck",
    "AVAILABLE_CHECKS",
]
