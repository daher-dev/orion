# QA Results — FEATURE-NNN: Title
<!-- Written by QA. Dev reads the Issues section for open bugs during fix cycles. -->

## Test Run: YYYY-MM-DD

**Seed Data Used:**
- ...

**Automated Tests:**
- `task test:backend`: PASS/FAIL
- `task test:frontend`: PASS/FAIL
- `task lint`: PASS/FAIL
- E2E (`<feature>.spec.ts`): PASS/FAIL — N/M tests passed

**Acceptance Criteria Results:**
| # | Criterion | EN | PT-BR | Notes |
|---|-----------|-----|-------|-------|
| 1 | ... | PASS/FAIL | PASS/FAIL | ... |

**Edge Case Results:**
| Scenario | Result | Notes |
|----------|--------|-------|
| ... | PASS/FAIL | ... |

---

## Issues

<!-- Each issue is a Jira-style ticket. QA opens, Dev fixes, QA verifies. -->
<!-- Status values: Open · Fixed (awaiting re-test) · Closed · Won't Fix -->

### QA-NNN-1: [Short title of bug or finding]

**Type:** Bug | Observation
**Status:** Open
**Severity:** Critical | High | Medium | Low
**Criterion:** #N (or Exploratory)
**Reported:** YYYY-MM-DD

**Description:**
Clear explanation of what is wrong and why it matters.

**Steps to Reproduce:**
1. Navigate to ...
2. Click ...
3. Observe ...

**Expected:** What should happen.
**Actual:** What actually happens.
**Screenshot:** `assets/qa/bug-title.png`

#### Discussion

> **QA (YYYY-MM-DD):** Opened. Reproduced consistently on both locales.

> **Dev (YYYY-MM-DD):** Root cause is X. Fixed in commit `abc1234`.

> **QA (YYYY-MM-DD):** Revalidated. Confirmed fixed. Closing.
