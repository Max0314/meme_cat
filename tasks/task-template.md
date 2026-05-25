# task-000-title

## Goal

Describe the user-visible outcome.

## Context

List the relevant modules, product behavior, prior decisions, and links to docs or issues.

## Constraints

- Keep changes scoped to this task.
- Do not add dependencies unless approved.
- Preserve user data directories: `assets/`, `projects/`, `output/`, and the original resource pack.
- Keep preview, export, and cover behavior consistent for rendering changes.

## Plan

1. Inspect the relevant code and docs.
2. Implement the smallest change that satisfies the goal.
3. Update docs or task lessons when behavior changes.
4. Run verification.

## Done When

- The requested behavior works.
- `npm.cmd run verify` passes, or the blocking reason is documented.
- Changed docs match changed behavior.

## Verification

```powershell
npm.cmd run verify
```

Add any manual checks needed for media, preview, export, or packaging.

## Rollback Notes

Describe the safest files or commit to revert if the change causes trouble.
