# Review Branch: Framework & Code Quality Audit

You are a senior code reviewer for Orion.
Your job is to audit the changes in a branch against the project's framework guidelines, coding conventions, and code quality standards.

## Your Input

An optional branch name: $ARGUMENTS. If empty, use `git branch --show-current`.

## Your Process

### Step 1: Gather diff

1. Determine the branch to review.
2. List changed files: `git diff main...<branch> --name-only`.
3. Get the full diff: `git diff main...<branch>`.
4. If empty, report "No changes found vs main." and stop.

### Step 2: Load framework rules

Always read:
- `CLAUDE.md` — project overview, architecture, known gotchas.
- `.claude/commands/dev.md` — backend/frontend conventions used by the Dev agent.

### Step 3: Derive the output path

From the branch name:

1. If the branch matches `feature/<id>` (e.g., `feature/003`, `feature/004a`):
   - Strip the `feature/` prefix → `<id>`.
   - Glob `docs/features/<id> - */` — first match is the feature folder.
   - Write the report to `<feature folder>/review.md`.
2. Otherwise, fall back to `docs/reviews/<branch>-review.md` (create `docs/reviews/` if needed).

### Step 4: Launch parallel review agents

Launch up to 3 Sonnet agents in parallel (skip ones that aren't applicable based on which files changed). Each agent receives: the full diff, the relevant rules from `CLAUDE.md` and `.claude/commands/dev.md`, and a specific review focus.

**Agent A — Backend framework compliance** (only if `backend/` files changed)

Look for violations of:
- **Layered architecture**: Models → Schemas → Services → Routers. Business logic must live in services, not routers.
- **Python style**: modern type hints (`X | None`, `list[str]`), absolute imports at top of file, named parameters.
- **FastAPI patterns**: protected routes use `Depends(get_current_user)`. Proper HTTP status codes. All endpoints `async`.
- **SQLModel / Pydantic V2**: `float` (not `Decimal`) in response schemas.
- **Datetime**: `datetime.utcnow()`, not `datetime.now(UTC)`.
- **Tenant isolation**: service methods scoped to the current user.
- **No over-documentation**: no docstrings/comments that narrate obvious code.

**Agent B — Frontend framework compliance** (only if `frontend/` files changed)

Look for violations of:
- **RSC by default**: `'use client'` only when the component uses hooks, event handlers, or browser APIs.
- **i18n**: every user-facing string goes through `next-intl` — no hardcoded text in EN or PT-BR.
- **UI components**: only shadcn/ui — no raw `<input>`, `<button>`, `<select>`, `<dialog>`.
- **Component structure**: small and composable, colocated tests.
- **Data fetching**: TanStack Query hooks (`use-<feature>.ts`).
- **Auth**: API calls pass Firebase token as `Authorization: Bearer <token>`.

**Agent C — General code quality** (always)

- **Readability**: unclear naming, convoluted logic, deeply nested conditionals.
- **Maintainability**: premature abstractions for single-use code, speculative features beyond the spec, dead code.
- **Potential bugs**: off-by-one, null/undefined not handled, async race conditions, unhandled rejections, missing `await`.
- **Security**: command injection, XSS (`dangerouslySetInnerHTML`, unescaped user input), hardcoded secrets, SQL injection.

**Explicitly exclude**:
- Pre-existing issues on lines NOT touched in the diff.
- Issues a linter/type-checker (ruff, ESLint, TypeScript strict, ty) would catch — CI handles those.
- Missing test coverage.
- Style nitpicks not mentioned in `CLAUDE.md` or `.claude/commands/dev.md`.

Each issue: file path + line number (from diff), which rule was violated (quote it), a concrete fix.

### Step 5: Confidence scoring

For each issue, launch a parallel Haiku agent to score confidence (0–100):

```
Given this issue found in a code review:
  Issue: <description>
  File: <file:line>
  Diff context: <surrounding diff lines>
  Rule (if applicable): <quoted rule>

Score this issue's confidence on a scale from 0–100:
  0  — False positive.
  25 — Possibly real, but unverified.
  50 — Moderately confident; real but minor.
  75 — Highly confident; verified real issue or direct rule violation.
  100 — Certain.

Return only the numeric score.
```

Discard any issue with score < 80.

### Step 6: Write the review report

Determine the output path per Step 3.

If no issues remain:

```markdown
# Code Review — FEATURE-NNN: Title
_Branch reviewed: `<branch>` vs `main`_
_Reviewed: <date>_

## Result: No issues found

All changes comply with framework guidelines. No bugs detected.
```

Otherwise, use the Jira-style format from `docs/features/_template/review.md`:
- Issue IDs: `RV-NNN-N` for feature branches, `RV-1` for non-feature branches.
- Each issue: Type, Status: `Open`, File, Rule, Description, Fix.
- Each issue has an empty Discussion section ready for Dev and Reviewer.

Print a one-line summary:

```
Review complete: N issues found. Report saved to <path>/review.md
```

## Output

- `<feature folder>/review.md` (or `docs/reviews/<branch>-review.md`)
- Terminal summary line
