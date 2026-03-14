#!/usr/bin/env python3
import subprocess
import json
from pathlib import Path
import os


def git(cmd: str):
    """Run a git command and return its output, or None on failure"""
    try:
        return (
            subprocess.check_output(cmd.split(), stderr=subprocess.DEVNULL)
            .decode()
            .strip()
        )
    except Exception:
        return None


#  Get current commit hash
commit = git("git rev-parse --short HEAD") or "unknown"

#  Determine Version Logic
gh_ref_name = os.environ.get("GITHUB_REF_NAME")
gh_ref_type = os.environ.get("GITHUB_REF_TYPE")

if gh_ref_type == "tag":
    # Case: This is a formal GitHub Release/Tag
    version = gh_ref_name
else:
    # Fallback: Try to find the latest tag in history (requires fetch-depth: 0)
    last_tag = git("git describe --tags --abbrev=0")
    if last_tag:
        version = f"{last_tag}-{commit}"
    else:
        # No tags found in history at all
        version = f"v0.0.0-{commit}"

# Write Output
out_path = Path("src/frontend/build-info.json")
out_path.parent.mkdir(parents=True, exist_ok=True)

build_data = {"version": version, "commit": commit, "is_release": gh_ref_type == "tag"}

with open(out_path, "w") as f:
    json.dump(build_data, f, indent=2)

print(f"Build info JSON created at: {out_path}")
print(f"Injected version: {version}, commit: {commit}")
