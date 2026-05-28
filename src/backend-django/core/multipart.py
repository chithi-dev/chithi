"""Multipart form data parser for ASGI requests.

Parses multipart/form-data from raw request body into fields and files.
Works without external dependencies by using cgi module (stdlib).
"""

from __future__ import annotations

import re
from email.parser import Parser
from io import BytesIO
from typing import Any


def parse_multipart_body(
    body: bytes, content_type: str | None = None
) -> dict[str, Any]:
    """Parse multipart/form-data body into a dict of fields and files.

    Returns dict with 'fields' (str values) and 'files' (UploadedFile-like dicts).
    """
    if not content_type or "boundary=" not in content_type:
        return {"fields": {}, "files": {}}

    # Extract boundary from Content-Type header
    match = re.search(r"boundary=(.+)", content_type)
    if not match:
        return {"fields": {}, "files": {}}

    boundary = match.group(1).strip('"')
    boundary_bytes = f"--{boundary}".encode()
    end_boundary = f"--{boundary}--".encode()

    fields: dict[str, str] = {}
    files: dict[str, tuple[str, bytes]] = {}  # name -> (filename, data)

    parts = body.split(boundary_bytes)[1:]  # skip first empty part before boundary

    for part in parts:
        if part.strip() == end_boundary.strip():
            break

        try:
            header_section, _, body_section = part.partition(b"\r\n\r\n")
        except ValueError:
            continue

        headers_str = header_section.decode("utf-8", errors="replace")
        # Parse Content-Disposition header
        cd_match = re.search(r'Content-Disposition:\s*form-data;\s*(.*)', headers_str)
        if not cd_match:
            continue

        cd_value = cd_match.group(1).strip()
        name_match = re.search(r'name="([^"]*)"', cd_value)
        filename_match = re.search(r'filename="([^"]*)"', cd_value)

        if not name_match:
            continue

        field_name = name_match.group(1)
        content_data = body_section.rstrip(b"\r\n")

        if filename_match:
            files[field_name] = (filename_match.group(1), content_data)
        else:
            fields[field_name] = content_data.decode("utf-8", errors="replace")

    return {"fields": fields, "files": files}


def get_multipart_content_type(headers: list[tuple[bytes | str, bytes | str]]) -> str | None:
    """Extract Content-Type header from ASGI headers."""
    for name, value in headers:
        key = name if isinstance(name, str) else name.decode()
        val = value if isinstance(value, str) else value.decode()
        if key.lower() == "content-type":
            return val
    return None
