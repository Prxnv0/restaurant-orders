# AI prompts

The prompts you actually used, in the order you used them, grouped by what you were trying to achieve. For each significant one: what you asked, what you got back, and what you had to correct.

Include at least one prompt that produced something wrong, and what you did about it.

If you did not use AI at all, say so here, and describe your process instead.

---

## Exploring the repository structure

### What we asked
"hey! how are you?"  
Followed by: "@C:\Users\PRANAV SINGH\OneDrive\Desktop\notes thapar\PLACEMENTS\BUSY\takehome-09-restaurant-orders\takehome-09-restaurant-orders  explore these files"

### What we got
The AI explored the repository and reported:
- The repository was an empty scaffold with only documentation templates and the assignment brief (README.md, SUBMISSION.md)
- No source code had been written yet
- It contained the assignment requirements for the Restaurant Orders take-home

### What we corrected
No correction needed — the exploration accurately described the repository state.

---

## Comprehensive repository analysis

### What we asked
"@C:\Users\PRANAV SINGH\OneDrive\Desktop\notes thapar\PLACEMENTS\BUSY\takehome-09-restaurant-orders\takehome-09-restaurant-orders"  
Then: "You are working with me on a take-home hiring assignment for BUSY Infotech." followed by the 19-phase analysis request (Phases 1-19 covering requirements extraction, acceptance criteria, architecture design, etc.)

### What we got
The AI performed a complete analysis of the assignment and repository, producing:
- Executive summary of the empty repository state
- Explicit requirements checklist (63 requirements)
- Acceptance criteria for each major feature
- High-risk/easy-to-miss requirements identification
- Current repository analysis (nothing implemented)
- Proposed architecture (React + Express + Prisma + PostgreSQL)
- Database design with 9 tables
- API design with endpoint matrix
- Authorization matrix
- Order state machine diagram
- 12-hour implementation plan
- Requirements traceability matrix
- Testing strategy
- Documentation strategy
- Git strategy
- Risks and mitigations
- MVP vs optional scope
- Open questions requiring clarification

### What we corrected
No correction was needed to the analysis itself — it accurately interpreted the assignment brief and repository state. However, during the subsequent refinement phase, several aspects of the plan were adjusted based on specific feedback.

---

## Refinement pass — corrections to initial plan

### What we asked
"Before I approve the implementation plan, make one final refinement pass." followed by 8 specific correction requests covering:
1. Database consistency (PostgreSQL for dev and prod)
2. Documentation compliance requirements (5+ decisions, 1 reversal, real AI prompts)
3. Authorization matrix correction (primary waiter access)
4. Alert design for multiple cycles
5. Configuration decision explanation
6. Separating requirements vs decisions vs ambiguities
7. Traceability matrix update
8. Final 12-hour plan recalculation

### What we got
The AI provided a refined analysis with:
- Clear separation of explicit requirements (A), technical decisions (B), and ambiguities (C)
- Updated database design using PostgreSQL consistently
- Corrected authorization matrix showing primary waiters and collaborators having equal access on orders
- Alert model supporting multiple dismissal/reappearance cycles via separate AlertDismissal table
- Explanation of alert threshold as an environment variable decision with alternatives considered
- Updated requirements traceability matrix including documentation requirements
- Recalibrated 12-hour implementation plan with proper time allocation

### What we corrected
**Initial alert design produced something wrong:**  
In the first analysis, I proposed a simple `Order.acknowledged_at = TIMESTAMP NULL` field to track alert acknowledgment. This only supported a single acknowledgment cycle, but the assignment requires alerts to dismiss and reappear multiple times (threshold reached → alert appears → dismissed → further threshold passes → alert reappears → can be dismissed again → etc.).

**What we changed:**  
Replaced the single acknowledgment timestamp with a separate `AlertDismissal` table that records each dismissal as an individual event. This supports unlimited cycles:
- An alert appears when order age > threshold and no dismissals exist OR the latest dismissal is older than threshold ago
- Each dismissal adds a row to `AlertDismissal`
- Alert reappears if (latest dismissal time + threshold) < now() and order still not Ready
- Alert clears permanently when order reaches Ready/Served/Cancelled (alert record deleted)

This change was made during the refinement pass before any implementation began, based on the specific feedback about alert reappearance requirements.

---

## Project checkpoint creation

### What we asked
"Before I close Antigravity, create a project checkpoint. Do NOT start implementation. Make sure all important findings from your current analysis are captured in the repository in the appropriate documentation files without fabricating anything."

### What we got
The AI updated the five documentation template files with the analysis findings:
1. docs/plan.md — Containing the current implementation plan as discussed
2. docs/architecture.md — Containing the proposed architecture
3. docs/schema.md — Containing the proposed schema
4. docs/decisions.md — Recording only decisions actually made so far (8 decisions, including one reversal)
5. docs/ai-prompts.md — Recording the actual prompts used in this session

### What we corrected
No correction was needed — the files were updated with only what was actually discussed and decided in this session, with no fabrication.

---

## Milestone 1 implementation — Foundation and database

### What we asked
"PLAN APPROVED — START IMPLEMENTATION. ... Start with Milestone 1: foundation + database. Before making changes, inspect the repository one final time and confirm the exact files you are about to create/change. Then begin implementation."

### What we got
The AI:
- Re-inspected the repository and confirmed the 7 files present, no commits, branch `master`.
- Listed the exact files it would create (backend skeleton, frontend skeleton, prisma schema, seed) before writing any of them.
- Created the backend Express skeleton, frontend Vite + React skeleton, Prisma schema (9 tables, all constraints, all indexes), and seed script.
- Wrote `prisma/seed.js` with demo data for 3 users, 6 menu items, 7 orders, lines, voided line with reason, collaborators, notes, history entries, alerts and dismissals.
- Updated docs/plan.md, docs/architecture.md, docs/schema.md to "Implemented (skeleton)" status.
- Added Decisions 9–13 to docs/decisions.md (JS-vs-TS, CommonJS-vs-ESM, idempotent seed, served_at column, Prisma enums).

### What we corrected

**AI-generated code that was wrong, and what we did about it:**

When writing the seed script, the AI's first pass contained an experimental cleanup loop that wrote, then deleted, then rewrote the order-1 history entry. This was a real mistake — the loop was the AI's attempt to handle "I just wrote a placeholder, now I want to write the real one" but it left visible garbage commands in the file (multiple `deleteMany` and `$executeRaw` calls).

**Correction:** The AI was asked (in the same session) to clean up the seed file, and it removed all three redundant delete operations, leaving a single clean `makeHistory` call for order 1. This is logged honestly here per the assignment requirement that an AI mistake must be recorded.

The same cleanup pass also fixed a wrong table name in the initial TRUNCATE block: the model is `AlertDismissal` (mapped to `alert_dismissals`) but the first version of the seed had `order_dismissals`. Corrected before any commit.

---

*Implementation prompts continue below as the project progresses.*

---