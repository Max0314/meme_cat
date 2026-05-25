# AGENTS.md

This file is the operating manual for AI agents working on Cat Meme Studio.
Read it before editing code, together with the task file under `tasks/`.

## Project Mission

Cat Meme Studio is a Windows Electron app for producing Chinese cat meme short videos.
The app must stay reliable for local creators: imported media, projects, exports, and resource packs are user data and must never be removed or rewritten unless a task explicitly asks for it.

## Coding Rules

- Prefer minimal, targeted changes that match existing project patterns.
- Do not introduce new dependencies unless the task explicitly requires it and the README/architecture docs are updated.
- Keep shared contracts in `src/shared/` stable; when a type changes, update main, preload, renderer, docs, and validation scripts together.
- Do not hardcode machine-specific paths such as `D:\cat_meme`; use workspace helpers and `CAT_MEME_HOME`.
- Preserve user data directories: `assets/`, `projects/`, `output/`, and `资源/`.
- Use structured APIs for paths, JSON, and media metadata. Avoid ad hoc string parsing when existing helpers exist.
- For Electron IPC, validate paths/protocols and keep renderer access behind `src/preload/index.ts`.
- For rendering changes, keep preview, export, and cover behavior consistent unless the task says otherwise.
- For UI changes, keep controls dense and practical; this is an editing tool, not a landing page.

## Required Local Commands

Use `npm.cmd` on Windows PowerShell.

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build:app
```

For a full local gate before commit:

```powershell
npm.cmd run verify
```

For a distributable portable exe:

```powershell
npm.cmd run build:portable
```

## Workflow

1. Read `AGENTS.md`, `docs/workflow.md`, `docs/architecture.md`, and the active `tasks/*.md` file.
2. Restate the goal, constraints, risks, and verification plan.
3. Create or switch to one focused Git branch/worktree per task.
4. Implement in small steps.
5. Run the relevant command after each risky step; always run `npm.cmd run verify` before final handoff unless blocked.
6. Summarize changed files, test results, known gaps, and the suggested commit message.

## Git Rules

- One task per branch, preferably `codex/task-###-short-name`.
- Commit messages must follow Conventional Commits, for example `fix(renderer): sync paused video preview`.
- Do not commit generated user outputs, local assets, packaged releases, or resource packs.
- Do not rewrite history or delete user changes without explicit approval.
- Use `git worktree` for parallel AI agents; remove finished worktrees with `git worktree remove`.

## Task File Rules

Every non-trivial change should have a task file in `tasks/`.
Use `tasks/task-template.md` and include:

- Goal
- Context
- Constraints
- Plan
- Done When
- Verification
- Rollback Notes

When a task reveals reusable project knowledge, append it to `tasks/lessons.md`.

## Review Rules

AI review should prioritize:

- data loss risks
- broken export/preview parity
- unsafe IPC or path handling
- missing verification
- accidental dependency or packaging drift
- performance regressions in asset library and preview rendering

If reviewing code, list findings first with file and line references.

## Forbidden Shortcuts

- No fake success messages without running commands.
- No broad refactors mixed into feature work.
- No temporary hardcoded paths, mocks, or silent fallbacks that hide root causes.
- No deleting `assets/`, `projects/`, `output/`, or `资源/` as cleanup.
