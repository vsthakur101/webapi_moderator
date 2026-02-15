"""SQL Injection vulnerability check."""

import re
from typing import Optional
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse

from app.scanner.checks.base import BaseCheck, CheckResult


class SQLInjectionCheck(BaseCheck):
    """Check for SQL Injection vulnerabilities."""

    id = "sql_injection"
    name = "SQL Injection"
    description = "Detects SQL injection vulnerabilities by injecting SQL payloads and analyzing responses"
    category = "injection"
    default_severity = "high"

    # SQL injection test payloads
    PAYLOADS = [
        "'",
        "\"",
        "' OR '1'='1",
        "\" OR \"1\"=\"1",
        "' OR 1=1--",
        "\" OR 1=1--",
        "1' ORDER BY 1--",
        "1 UNION SELECT NULL--",
        "'; DROP TABLE users--",
        "1; SELECT * FROM users",
        "' AND '1'='1",
        "' AND SLEEP(5)--",
        "1' AND (SELECT COUNT(*) FROM users) > 0--",
    ]

    # SQL error patterns that indicate vulnerability
    ERROR_PATTERNS = [
        r"SQL syntax.*MySQL",
        r"Warning.*mysql_",
        r"MySqlException",
        r"valid MySQL result",
        r"check the manual that corresponds to your MySQL",
        r"MySqlClient\.",
        r"PostgreSQL.*ERROR",
        r"Warning.*\Wpg_",
        r"valid PostgreSQL result",
        r"Npgsql\.",
        r"PG::SyntaxError:",
        r"org\.postgresql\.util\.PSQLException",
        r"ERROR:\s+syntax error at or near",
        r"Driver.*SQL[\-\_\ ]*Server",
        r"OLE DB.*SQL Server",
        r"\bSQL Server[^&lt;&quot;]+Driver",
        r"Warning.*mssql_",
        r"\bSQL Server[^&lt;&quot;]+[0-9a-fA-F]{8}",
        r"System\.Data\.SqlClient\.",
        r"(?s)Exception.*\WRoadhouse\.Cms\.",
        r"Microsoft SQL Native Client error '[0-9a-fA-F]{8}",
        r"\[SQL Server\]",
        r"ODBC SQL Server Driver",
        r"ODBC Driver \d+ for SQL Server",
        r"SQLServer JDBC Driver",
        r"com\.jnetdirect\.jsql",
        r"macaborq\.jdbc\.sqlserver",
        r"com\.microsoft\.sqlserver\.jdbc\.SQLServerException",
        r"ORA-[0-9][0-9][0-9][0-9]",
        r"Oracle error",
        r"Oracle.*Driver",
        r"Warning.*\Woci_",
        r"Warning.*\Wora_",
        r"oracle\.jdbc\.driver",
        r"quoted string not properly terminated",
        r"SQLite/JDBCDriver",
        r"SQLite\.Exception",
        r"System\.Data\.SQLite\.SQLiteException",
        r"Warning.*sqlite_",
        r"Warning.*SQLite3::",
        r"\[SQLITE_ERROR\]",
        r"SQLITE_CONSTRAINT",
        r"sqlite3\.OperationalError:",
        r"SQLError",
        r"sqlite3\.ProgrammingError:",
    ]

    async def check(
        self,
        url: str,
        method: str = "GET",
        headers: Optional[dict] = None,
        body: Optional[str] = None,
        params: Optional[dict] = None,
    ) -> list[CheckResult]:
        """Check for SQL injection vulnerabilities."""
        results = []
        headers = headers or {}

        # Get baseline response
        baseline = await self.make_request(url, method, headers, body, params)
        if not baseline:
            return results

        # Parse URL for parameters
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)

        # Test each query parameter
        for param_name, param_values in query_params.items():
            original_value = param_values[0] if param_values else ""

            for payload in self.PAYLOADS:
                # Create modified params
                modified_params = {k: v[0] for k, v in query_params.items()}
                modified_params[param_name] = original_value + payload

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

                # Check for SQL errors
                response_text = response.text
                for pattern in self.ERROR_PATTERNS:
                    if re.search(pattern, response_text, re.IGNORECASE):
                        results.append(
                            self.create_result(
                                is_vulnerable=True,
                                title=f"SQL Injection in '{param_name}' parameter",
                                description=f"The parameter '{param_name}' appears to be vulnerable to SQL injection. "
                                f"A SQL error was returned when injecting the payload.",
                                url=url,
                                method=method,
                                parameter=param_name,
                                location="query",
                                evidence=re.search(pattern, response_text, re.IGNORECASE).group(),
                                payload=payload,
                                confidence="firm",
                                remediation="Use parameterized queries (prepared statements) instead of string concatenation. "
                                "Validate and sanitize all user inputs.",
                                references=[
                                    "https://owasp.org/www-community/attacks/SQL_Injection",
                                    "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html",
                                ],
                            )
                        )
                        break  # Found vulnerability for this param, move to next

                # If we found a vulnerability for this param, move to next param
                if any(r.parameter == param_name for r in results):
                    break

        return results
