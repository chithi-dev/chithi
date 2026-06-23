---
description: Clean up any downloaded files after they are no longer needed.
glob: "*"
---

# Clean Up Downloaded Files

After downloading any files (archives, packages, binaries, datasets, temporary assets), remove them once they have served their purpose.

## Rules

1. After extracting an archive, delete the archive.
2. After installing a package from a downloaded tarball, delete the tarball.
3. After copying needed data from a downloaded file, delete the original download.
4. After fetching a binary or tool for a one-time operation, delete it when done.

## When to Clean

Remove downloads immediately after:
- Extracting an archive (`tar`, `unzip`, etc.)
- Installing from a downloaded package
- Copying data from a temporary file
- Running a one-time tool or binary
- Generating a build artifact that's already committed

## What to Keep

Do **not** delete:
- Source code files
- Configuration files
- Build outputs that are part of the project
- Files tracked by git
