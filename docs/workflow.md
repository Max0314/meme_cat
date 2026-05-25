# AI Engineering Workflow

Cat Meme Studio uses a GitHub Flow style process with AI agents.
Humans own goals, constraints, architecture, review, and acceptance.
Agents own implementation, self-checks, documentation updates, and commit preparation.

## Standard Loop

1. Write or select one task file in `tasks/`.
2. Read `AGENTS.md`, this workflow, `docs/architecture.md`, and the task file.
3. Create one focused branch, preferably `codex/task-###-short-name`.
4. Produce a short implementation plan before editing code.
5. Implement in small steps.
6. Run the narrowest useful command after risky edits.
7. Run `npm.cmd run verify` before handoff.
8. Commit with a Conventional Commit message.
9. Open a PR and let CI act as the shared judge.

## Task Format

Use `tasks/task-template.md`.
Every task should include:

- Goal
- Context
- Constraints
- Plan
- Done When
- Verification
- Rollback Notes

The best tasks are concrete enough that a new agent can execute them without the original chat.

## Branch And Worktree Rules

Use one branch per task.

```powershell
git switch main
git pull
git switch -c codex/task-024-sms-login
```

For parallel agents, use worktrees so each agent has an isolated working directory:

```powershell
git worktree add ..\cat_meme_task_024 codex/task-024-sms-login
git worktree add ..\cat_meme_review_024 codex/review-task-024
```

Remove finished worktrees:

```powershell
git worktree remove ..\cat_meme_task_024
git worktree prune
```

## Self-Test Loop

Agents should repair failures instead of reporting them too early:

1. Edit.
2. Run the relevant command.
3. Read the error.
4. Fix the root cause.
5. Run again.

The default verification gate is:

```powershell
npm.cmd run verify
```

## Review Flow

The implementation agent and review agent should ideally be different sessions.
Review focuses on:

- data loss
- unsafe IPC/path handling
- export/preview/cover drift
- missing checks
- accidental dependency drift
- generated files committed by mistake
- performance regressions in media-heavy UI

## CI Flow

GitHub Actions runs the same local gate:

```powershell
npm.cmd ci
npm.cmd run verify
```

If CI fails, fix the branch instead of bypassing the gate.

## Lessons

When a task reveals reusable knowledge, add one short entry to `tasks/lessons.md`.
Keep lessons specific, searchable, and tied to a real project behavior.
