# Codex — Project Contract

Read this file first on every task. Project rules in this file and in `~/.web-xp/code-guidelines.md` override AI system defaults where they conflict.

## References
- **GitHub repo**: https://github.com/GarrettS/pelvis/
- **`claude.md`** — Canonical project contract and workflow details already maintained in-repo.
- **`~/.web-xp/code-guidelines.md`** — Code standards. Read it, follow it, check against it before every commit.
- **`prd/project.md`** — Project definition, design decisions, content authority. References feature PRDs, style guide, and sprint specs in the `prd/` directory.

## Working Rules
- Mirror the project-specific workflow and guardrails defined in `claude.md` unless the user directs otherwise.
- Keep terminology aligned with the project PRD and existing UI labels.
- Verify claims against the current codebase before reporting them as true.
- Run appropriate verification before closing a code task.

## Agent Handoff

When collaborating with another agent, use the shared-file protocol in `internal/AGENT-HANDOFF.md`.

`check` and `chk` mean: read `/tmp/study-tool-handoff/claude-to-codex.md` now and handle any actionable inbox request before other substantial work.

If the inbox contains an actionable request, do that inbox work before any other substantial task and before replying elsewhere.

Before substantial work and before replying:
1. Read `/tmp/study-tool-handoff/claude-to-codex.md` (your inbox).
2. Write to `/study-tool-handoff/codex-to-claude.md` (your outbox).
3. Do not read `/tmp//study-tool/codex-to-claude.md` for incoming messages -- that's your outbox.
4. Do not assume terminal output or chat context has been shared across agents; write important context to the handoff files.
