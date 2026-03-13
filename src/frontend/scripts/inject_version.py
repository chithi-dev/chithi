#!/usr/bin/env python3
import subprocess
import json
from pathlib import Path
import os


def git(cmd: str):
    """Run a git command and return its output, or 'unknown' on failure"""
    try:
        return (
            subprocess.check_output(cmd.split(), stderr=subprocess.DEVNULL)
            .decode()
            .strip()
        )
    except Exception:
        return "unknown"


# Current commit hash
commit = git("git rev-parse --short HEAD")

# Current branch or tag
branch_or_tag = os.environ.get("GITHUB_REF_NAME") or git(
    "git rev-parse --abbrev-ref HEAD"
)

# Determine version
version = branch_or_tag if os.environ.get("GITHUB_REF_NAME") else f"v0.0.0-{commit}"

# Output JSON for Vite config
out_path = Path("src/frontend/build-info.json")
out_path.parent.mkdir(parents=True, exist_ok=True)
with open(out_path, "w") as f:
    json.dump({"version": version, "commit": commit}, f, indent=2)

print(f"Injected version: {version}, commit: {commit}")
