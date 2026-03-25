# VogelSimulator Ticket System

Local ticket tracking via markdown files.

## Workflow
1. New tickets go into `backlog/`
2. Move to `in-progress/` when work begins
3. Move to `done/` when complete
4. Move to `blocked/` if blocked by another ticket

## Naming Convention
`TXXX-short-title.md` (e.g., `T001-project-scaffolding.md`)

## Template
```markdown
# TXXX: Title
**Priority:** P0/P1/P2 | **Phase:** 1-5 | **Size:** S/M/L/XL
**Depends on:** TXXX

## Description
What needs to be done.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
```
