import json
import os
import subprocess
from pathlib import Path


def git(cmd: str) -> str | None:
    """Run a git command and return its output, or None on failure."""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            check=True,
        )
        return result.stdout.decode().strip()
    except Exception:
        return None


# Resolve paths (equivalent to __dirname logic)
current_dir = Path(__file__).resolve().parent
out_path = current_dir.parent / "build-info.json"

# Get commit hash
commit = git("git rev-parse --short HEAD") or "unknown"

# GitHub environment variables
gh_ref_name = os.getenv("GITHUB_REF_NAME")
gh_ref_type = os.getenv("GITHUB_REF_TYPE")

# Determine version
if gh_ref_type == "tag":
    version = gh_ref_name or "unknown"
else:
    last_tag = git("git describe --tags --abbrev=0")
    if last_tag:
        version = f"{last_tag}-{commit}"
    else:
        version = f"v0.0.0-{commit}"

# Build data
build_data = {
    "version": version,
    "commit": commit,
    "is_release": gh_ref_type == "tag",
}

# Write JSON
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(build_data, f, indent=2)

print(f"Build info JSON created at: {out_path}")
print(f"Injected version: {version}, commit: {commit}")
