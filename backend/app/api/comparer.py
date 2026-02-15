import base64
import difflib
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.request import Request
from app.schemas.comparer import (
    CompareOptions,
    CompareRequest,
    CompareResponse,
    CompareSource,
    DiffLine,
    DiffStats,
    SourceType,
)

router = APIRouter()


async def get_source_content(
    source: CompareSource, db: AsyncSession
) -> tuple[Optional[str], Optional[str]]:
    """Get content from a source (request or text)."""
    if source.type == SourceType.TEXT:
        return source.content, None

    if source.type == SourceType.REQUEST:
        if not source.id:
            return None, "Request ID is required for request source"

        result = await db.execute(select(Request).where(Request.id == source.id))
        request = result.scalar_one_or_none()

        if not request:
            return None, f"Request with ID {source.id} not found"

        # Build full request/response text
        lines = []

        # Request line
        lines.append(f"{request.method} {request.path} HTTP/1.1")

        # Request headers
        if request.request_headers:
            for key, value in request.request_headers.items():
                lines.append(f"{key}: {value}")

        lines.append("")  # Empty line before body

        # Request body
        if request.request_body:
            try:
                body = request.request_body.decode("utf-8")
                lines.append(body)
            except UnicodeDecodeError:
                lines.append(f"[Binary data: {len(request.request_body)} bytes]")

        # Add response if available
        if request.response_status:
            lines.append("")
            lines.append("--- Response ---")
            lines.append(f"HTTP/1.1 {request.response_status}")

            if request.response_headers:
                for key, value in request.response_headers.items():
                    lines.append(f"{key}: {value}")

            lines.append("")

            if request.response_body:
                try:
                    body = request.response_body.decode("utf-8")
                    lines.append(body)
                except UnicodeDecodeError:
                    lines.append(f"[Binary data: {len(request.response_body)} bytes]")

        return "\n".join(lines), None

    return None, "Invalid source type"


def compute_diff(
    left: str, right: str, options: Optional[CompareOptions] = None
) -> tuple[list[DiffLine], DiffStats]:
    """Compute diff between two strings."""
    options = options or CompareOptions()

    # Preprocess based on options
    left_processed = left
    right_processed = right

    if options.ignore_case:
        left_processed = left.lower()
        right_processed = right.lower()

    if options.ignore_whitespace:
        left_processed = " ".join(left_processed.split())
        right_processed = " ".join(right_processed.split())

    # Split into lines
    left_lines = left.splitlines(keepends=True)
    right_lines = right.splitlines(keepends=True)
    left_processed_lines = left_processed.splitlines(keepends=True)
    right_processed_lines = right_processed.splitlines(keepends=True)

    # Use difflib to compute diff
    matcher = difflib.SequenceMatcher(None, left_processed_lines, right_processed_lines)

    diff_lines: list[DiffLine] = []
    additions = 0
    deletions = 0
    unchanged = 0

    left_line_num = 1
    right_line_num = 1

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for i in range(i2 - i1):
                diff_lines.append(
                    DiffLine(
                        type="equal",
                        left_line_num=left_line_num,
                        right_line_num=right_line_num,
                        left_content=left_lines[i1 + i].rstrip("\n\r"),
                        right_content=right_lines[j1 + i].rstrip("\n\r"),
                    )
                )
                left_line_num += 1
                right_line_num += 1
                unchanged += 1

        elif tag == "replace":
            max_len = max(i2 - i1, j2 - j1)
            for i in range(max_len):
                left_idx = i1 + i if i < (i2 - i1) else None
                right_idx = j1 + i if i < (j2 - j1) else None

                diff_lines.append(
                    DiffLine(
                        type="replace",
                        left_line_num=left_line_num if left_idx is not None else None,
                        right_line_num=right_line_num if right_idx is not None else None,
                        left_content=(
                            left_lines[left_idx].rstrip("\n\r")
                            if left_idx is not None
                            else None
                        ),
                        right_content=(
                            right_lines[right_idx].rstrip("\n\r")
                            if right_idx is not None
                            else None
                        ),
                    )
                )

                if left_idx is not None:
                    left_line_num += 1
                    deletions += 1
                if right_idx is not None:
                    right_line_num += 1
                    additions += 1

        elif tag == "delete":
            for i in range(i2 - i1):
                diff_lines.append(
                    DiffLine(
                        type="delete",
                        left_line_num=left_line_num,
                        right_line_num=None,
                        left_content=left_lines[i1 + i].rstrip("\n\r"),
                        right_content=None,
                    )
                )
                left_line_num += 1
                deletions += 1

        elif tag == "insert":
            for i in range(j2 - j1):
                diff_lines.append(
                    DiffLine(
                        type="insert",
                        left_line_num=None,
                        right_line_num=right_line_num,
                        left_content=None,
                        right_content=right_lines[j1 + i].rstrip("\n\r"),
                    )
                )
                right_line_num += 1
                additions += 1

    stats = DiffStats(additions=additions, deletions=deletions, unchanged=unchanged)

    return diff_lines, stats


@router.post("/diff", response_model=CompareResponse)
async def compare_diff(
    request: CompareRequest, db: AsyncSession = Depends(get_db)
) -> CompareResponse:
    """Compare two sources and return the diff."""
    try:
        # Get left content
        left_content, left_error = await get_source_content(request.left, db)
        if left_error:
            return CompareResponse(
                diff=[], stats=DiffStats(additions=0, deletions=0, unchanged=0),
                success=False, error=left_error
            )

        # Get right content
        right_content, right_error = await get_source_content(request.right, db)
        if right_error:
            return CompareResponse(
                diff=[], stats=DiffStats(additions=0, deletions=0, unchanged=0),
                success=False, error=right_error
            )

        if left_content is None:
            left_content = ""
        if right_content is None:
            right_content = ""

        # Compute diff
        diff_lines, stats = compute_diff(left_content, right_content, request.options)

        return CompareResponse(diff=diff_lines, stats=stats, success=True)

    except Exception as e:
        return CompareResponse(
            diff=[], stats=DiffStats(additions=0, deletions=0, unchanged=0),
            success=False, error=str(e)
        )
