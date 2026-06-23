---
description: Update PLAN.md after completing any task by marking the finished step as DONE.
glob: "*"
---

# Track Plan Progress

After completing any meaningful piece of work, update `PLAN.md` to reflect the change.

## Rules

1. After finishing a task, open `PLAN.md` and mark the completed step as **DONE**.
2. If a new task or discovery emerges during work, add it to the plan before starting.
3. Never leave `PLAN.md` stale — it is the single source of truth for what's done and what's next.
4. When a phase is fully complete, mark the entire phase as **DONE**.

## Format

Use the Status column in tables or inline markers:

```markdown
| Task | Status | Detail |
|---|---|---|
| Create unified worker | DONE | Created chithi.worker.ts |
| Rewrite WASM bindings | TODO Phase 1 | Replace wasm-bindgen with C ABI |
```

Or for step lists:

```markdown
#### Step 1.1: Create unified worker
- [x] Merge crypto + rust workers into chithi.worker.ts
- [ ] Add main-thread fallback
```

## When to Update

Update `PLAN.md` immediately after:
- Finishing a code change
- Completing a refactoring
- Discovering a new requirement or blocker
- Changing the implementation approach
