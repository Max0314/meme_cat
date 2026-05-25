# task-000-ai-engineering-workflow

## Goal

Add a repeatable AI engineering workflow to Cat Meme Studio so future AI coding tasks have durable instructions, task templates, verification commands, and CI.

## Context

The project is already usable as an Electron desktop app for cat meme video creation.
Future development should follow an agentic workflow: task file, focused branch, AI implementation, self-test, review, CI, and merge.

## Constraints

- Do not change product behavior in this task.
- Do not add runtime or development dependencies.
- Keep generated outputs, release packages, local media, and resource packs out of Git.
- Use Windows-friendly commands with `npm.cmd` in docs and CI.

## Plan

1. Add AI agent operating rules in `AGENTS.md`.
2. Add architecture, coding style, API, and workflow docs.
3. Add task templates and a lessons log.
4. Add local verification and CI entrypoints.
5. Update README with the new workflow.

## Done When

- `AGENTS.md`, `docs/workflow.md`, `tasks/task-template.md`, `tasks/lessons.md`, and CI exist.
- `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run verify` are defined.
- The README explains the AI workflow entrypoints.
- Verification passes locally.

## Verification

```powershell
npm.cmd run verify
```

## Rollback Notes

This workflow scaffold is isolated to docs, task files, package scripts, CI, and `scripts/verify-ai-workflow.mjs`.
