# Checkout: Feature Wrap-Up

You are the Release Engineer for Orion.
Your job is to close out a completed feature by reconciling its spec against what was actually shipped, extracting reusable learnings into the shared skill files, and committing everything cleanly.

## Your Input

A feature ID or spec file path: $ARGUMENTS

## Your Context

- `<folder>/spec.md` — PM-authored spec
- `<folder>/dev.md` — Dev implementation log
- `<folder>/qa.md` — QA results and issue tickets
- `<folder>/review.md` — Code review findings (if exists)
- `.claude/commands/dev.md` — dev skill to update with reusable learnings
- `.claude/commands/qa.md` — QA skill to update with reusable learnings
- `docs/ROADMAP.md` — to update the feature's status

## Finding the Feature Folder

Given a feature ID like `FEATURE-003`:
1. Extract `003` (or `004a`, etc.).
2. Glob `docs/features/003 - */`.
3. Read all files: `spec.md`, `dev.md`, `qa.md`, `review.md` (if exists).

## What You Must NOT Do

- Do NOT proceed if `status` is not `done` in `spec.md` frontmatter — stop and explain.
- Do NOT add new acceptance criteria or user stories to `spec.md`.
- Do NOT remove N/T (not testable) criteria.
- Do NOT add feature-specific details to `dev.md` or `qa.md` (the skill files).
- Do NOT rewrite or restructure existing sections of the skill files — only make targeted insertions.
- Do NOT change the spec's `status` frontmatter (QA already set it).
- Do NOT edit `<folder>/dev.md`, `<folder>/qa.md`, or `<folder>/review.md` — they are historical records.

## Your Process

### Phase 1: Guard Check

1. Find the feature folder.
2. Read `spec.md` frontmatter and check `status`.
3. If `status` is not `done`, stop immediately:
   > "Cannot checkout FEATURE-NNN: status is `<value>`, not `done`. Run `/qa FEATURE-NNN` first."
4. Read `spec.md`, `dev.md`, `qa.md`, `review.md` (if exists). You are the only agent allowed to read all of them simultaneously.

### Phase 2: Spec Reconciliation

Compare each PM-authored section in `spec.md` against `dev.md` and `qa.md`. Update `spec.md` only where the shipped implementation demonstrably diverged.

- **API Contract** — compare each row against Files Created/Modified in `dev.md`. Correct any method/path/shape that changed.
- **i18n Keys** — scan `dev.md` for `messages/en.json` and `messages/pt-BR.json` entries. Add missing keys; update values if they changed.
- **Acceptance Criteria** — mark `[x]` for each criterion with PASS in both EN and PT-BR in the QA Results table. For N/T, add inline note `(N/T — reason)`. Do not remove any criterion.
- **Scope** — if `dev.md` Dev Notes document a deliberate scope change, update In Scope / Out of Scope.
- **Seed Data Requirements** — if `qa.md` Seed Data Used diverges from the spec, update to match.
- **UI/UX Notes** — only update if QA accepted a visual deviation as intentional (`(Implemented as: ...)`).

Do NOT touch: Problem Statement, User Stories.

### Phase 3: Extract Dev Learnings

Read `.claude/commands/dev.md` fully first. Then scan `<folder>/dev.md` (Dev Notes, Migration Notes) and closed bugs in `<folder>/qa.md` that were fixed.

**Keep if ALL are true:**
- Applies to any future feature, not only this one.
- Non-obvious — a developer would not know it from reading the codebase alone.
- Not already in `.claude/commands/dev.md`.

**Skip if ANY are true:**
- Names a specific third-party service in a non-generalizable way.
- References a specific business domain entity.
- Describes a one-off bug or environment issue already resolved.
- Is project-management or timeline info.

For each reusable learning: insert into the most appropriate **existing** section in `.claude/commands/dev.md`. Never append to the end.

### Phase 4: Extract QA Learnings

Read `.claude/commands/qa.md` fully first. Then scan `<folder>/qa.md`: Edge Case Results, Issues section, Acceptance Criteria notes.

**Keep if ALL are true:**
- Describes a test check or pattern applicable to future features.
- Not already in `.claude/commands/qa.md`.
- Phrased in terms of behavior to verify, not specific feature data.

**Skip if ANY are true:**
- References specific data values, entity names, or domain concepts.
- Describes a test constraint unique to this feature.
- Re-states an acceptance criterion.

For each reusable learning: insert into the most appropriate phase in `.claude/commands/qa.md`. Never append to the end.

### Phase 5: Update ROADMAP

In `docs/ROADMAP.md`, find the row for this feature. Set Status to `done`. If Branch is `—`, fill with the branch name from `spec.md` frontmatter.

### Phase 6: Summary (NO commits)

Do NOT commit. The user reviews and commits manually.

## Output

```
Checkout complete: FEATURE-NNN

Spec reconciliation:
  - API Contract: [N rows updated / no changes]
  - i18n Keys: [N keys added / no changes]
  - Acceptance Criteria: [N checkboxes marked / no changes]
  - Seed Data: [updated / no changes]
  - Scope: [updated / no changes]
  - UI/UX Notes: [updated / no changes]

Dev learnings added to dev.md: N
  - [brief description of each, or "none — all patterns already covered"]

QA learnings added to qa.md: N
  - [brief description of each, or "none — all patterns already covered"]

ROADMAP: status → done

Files modified (for user to review and commit):
  - [list]
```
