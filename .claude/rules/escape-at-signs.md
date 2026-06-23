---
description: Escape @ symbols in commit messages and file content before committing to GitHub to prevent unwanted mentions.
glob: "*"
---

# Escape @ Symbols Before Committing

Always escape `@` symbols with a backslash (`\@`) in commit messages and any file content before committing to GitHub, to prevent GitHub from interpreting them as user or team mentions.

Apply this to:
- Commit messages
- Markdown files
- Any text that will be rendered by GitHub

Example: `@username` → `\@username`
