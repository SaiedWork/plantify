# Collaboration workflow

How Claude Code and the dev user work together on Plantify. The roadmap and plan live in [PLAN.md](PLAN.md) (see its status table). This loop applies to every task and is never skipped.

## The loop

1. **Define.** Claude Code picks the next task from the roadmap and plan, and states it: scope, what done looks like, and anything notable it will touch. It does not start implementing.
2. **Approve.** The dev user approves the task (or adjusts it). Nothing is implemented before this go.
3. **Implement and report.** Claude Code implements the approved task only, then reports:
   - a short summary of what changed and what was verified (and what was not);
   - the proposed next task;
   - a short, domain-based git commit message, e.g. `feat(admin): ...`, `fix(api): ...`, `docs: ...`.
   Claude Code does not commit unless the dev user does so or explicitly asks.
4. **Review.** The dev user reviews the code and inspects the UX/UI, then either:
   - gives correction instructions, and Claude Code revises and reports again (back to step 3), or
   - approves and commits the changes.
5. **Go for next.** The dev user gives the go for the next task, which returns to step 1 (or step 3 if the proposed task was approved as-is).

## Sessions

- One chat session per task, including its correction loop. The session ends once the dev user commits.
- A small follow-up that depends directly on the task just finished (e.g. UI polish) may stay in the same session while its context is still relevant. A correction loop that gets long and messy is better continued in a fresh session after the commit.
- State that must survive between sessions lives in the repo, not in chat: `CLAUDE.md`, `docs/PLAN.md` (status and deviations), this document, and git history. Non-obvious decisions made in chat are recorded in the docs.
- A fresh session starts by reading `CLAUDE.md`, checking `docs/PLAN.md`, and proposing the next task per the loop above.

## Rules

- One task at a time; no work on the next task until the dev user gives the go.
- No scope creep: anything noticed outside the approved task is mentioned in the report, not done.
- Keep `docs/PLAN.md` status current when a milestone's state or a deliberate deviation changes (include it in the task's commit).
