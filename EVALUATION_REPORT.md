# PROJECT EVALUATION REPORT

> Evaluated: 2026-02-10 | Post-refocus codebase (all REFOCUS_PLAN phases completed)
> Evaluator: Claude Opus 4.6 via Concept-Execution-Evaluation framework

**Primary Classification:** Underdeveloped
**Secondary Tags:** Speculative Infrastructure, Ecosystem Dependency

---

### CONCEPT ASSESSMENT

**Problem:** How do you govern what an AI system is allowed to learn from user interactions — with explicit, revocable consent?

**User:** Developers building AI agents/assistants who need a governance layer for memory and learning. The target is someone building a system where an AI remembers things about users and needs contractual guardrails around that memory.

**Competition:** No direct competitor does exactly this. Guardrails AI, NeMo Guardrails, and LangChain permission systems handle prompt-level guardrails and output validation. None address *learning consent* — the right to define what an AI may memorize, generalize, and recall. This library occupies an uncontested niche.

**Value Prop:** "Nothing is learned by default" — a fail-closed consent system where every byte of AI learning requires an explicit, revocable contract.

**Verdict: Sound concept, waiting for a world to exist in.**

The five-tier contract taxonomy (Observation, Episodic, Procedural, Strategic, Prohibited) is genuinely well-thought-out. It maps cleanly to real cognitive operations. The fail-closed design (no contract = no learning, ambiguous scope = deny) is the correct default for a governance primitive. The mental model — contracts that expire, freeze memory, tombstone on revocation, require owner presence for recall — is coherent and well-defined.

The fundamental problem: this library governs learning for AI systems that don't yet exist as consumers. It integrates with Memory Vault, Boundary Daemon, and Agent-OS — all part of an ecosystem that has no external users. The concept is real, but the demand is theoretical. Until an actual AI agent uses this library to govern its own memory, the value proposition remains unproven.

---

### EXECUTION ASSESSMENT

**Build status:** Passes. TypeScript compiles cleanly with `--noEmit`.
**Tests:** 508 passing across 13 suites. Zero failures.
**Lint:** 35 errors, 13 warnings (see details below).

#### Architecture

The codebase has gone through a significant refactor (documented in `REFOCUS_PLAN.md`). The results are visible:

- `src/system.ts` is now 699 lines (down from a reported 1,599). It's a clean orchestrator that exposes subsystems as public readonly properties (`system.sessions`, `system.expiry`, `system.emergencyOverride`, etc.) rather than wrapping them with thin forwarding methods. The constructor at `src/system.ts:172-239` instantiates 10 subsystems with proper dependency injection via callbacks.

- The public API (`src/index.ts`, 102 lines) is organized into four clear sections: Core, Extensions, Plain Language, and Errors. No mock classes in the main export. Integration adapters are correctly extracted to `packages/vault-adapter/` and `packages/boundary-adapter/`.

- The enforcement engine (`src/enforcement/engine.ts`) remains the strongest module. Linear logic, four clearly separated hooks, audit logging at every decision point, fail-closed defaults. Every `deny()` path logs before returning. The `checkScope()` method at line 325 properly denies when all scope arrays are empty — genuine fail-closed behavior.

The module count is reasonable for what the library does: 14 source modules in `src/`, down from the previous 19+.

#### Code Quality

- TypeScript strict mode is on. Clean `--noEmit` typecheck.
- ESLint has **35 errors** remaining. The majority are `@typescript-eslint/no-unsafe-argument` and `@typescript-eslint/no-unsafe-enum-comparison` in `src/system.ts` (lines 279-312, 503-510, 586-599). Several `createXContract()` helper methods use `any` for scope and options parameters instead of proper types. This is sloppy for a governance library that claims type safety.
- The `deepPurge` method at `src/system.ts:503` accepts `ownerConfirmation: any` — the most security-sensitive operation in the library has an untyped parameter.
- One `console.error` in `src/storage/repository.ts:103` leaks into test output during `persistent-storage.test.ts`. Not harmful but noisy.

#### Tech Choices

One production dependency: `uuid` ^13.0.0. Appropriate restraint for a library. Dev dependencies are standard (Jest, ts-jest, ESLint, Prettier, TypeScript). No bloat.

The workspace packages (`packages/vault-adapter/`, `packages/boundary-adapter/`) declare a peer dependency on `learning-contracts@^0.1.0`, which doesn't exist on npm. This means `npm ci` fails out of the box. `npm install --legacy-peer-deps` works, but a fresh clone will hit this. The monorepo setup is incomplete.

#### Stability

508 tests pass. This is a significant improvement from the previous state (where 11 of 12 suites crashed). Coverage thresholds are set conservatively (61% branches, 71% functions, 73% lines) and enforced.

**Verdict: Execution now matches a credible alpha.** The refactor addressed the worst problems (god class, orphaned modules, broken tests). What remains is polish: fix the lint errors, type the `any` parameters, fix the workspace peer dependency resolution. The code-to-ambition ratio has improved from absurd to reasonable.

---

### SCOPE ANALYSIS

**Core Feature:** Contract-based enforcement of AI learning permissions — create contracts with explicit scope, enforce at four hooks (memory creation, abstraction, recall, export), audit everything, revoke and forget.

**Supporting:**
- Contract lifecycle state machine (Draft → Review → Active → Expired/Revoked/Amended) — `src/contracts/lifecycle.ts`
- Audit logging with irreversible event log — `src/audit/logger.ts`
- Memory forgetting with freeze/tombstone/deep-purge operations — `src/memory/forgetting.ts`
- In-memory and file-based storage adapters — `src/storage/`

**Nice-to-Have:**
- Plain-language contract builder with conversational flow — `src/plain-language/builder.ts` (751 lines). A differentiator if the target user is non-technical, but the current implementation is keyword-matching (`input.includes(keyword)` at `src/plain-language/parser.ts:188`), not NLP. The name `PlainLanguageParser` overpromises.
- Session-scoped contracts with auto-cleanup — `src/session/manager.ts`
- Timebound auto-expiry — `src/expiry/manager.ts`
- Emergency override ("pause all learning") — `src/emergency-override/manager.ts`
- Multi-user permissions with OWNER/DELEGATE/READER levels — `src/user-management/`
- Rate limiting on contract creation — `src/system.ts:73-147`

**Distractions:**
- `src/errors/types.ts` (412 lines) defines 50+ error codes, MITRE ATT&CK technique tagging, and CEF format for SIEM ingestion. The `CentralErrorHandler` in `src/errors/handler.ts` implements buffered SIEM reporting, lockdown triggers, and retry strategies. This is enterprise security infrastructure for a library with zero deployments. The error system is ~810 lines — nearly as large as the enforcement engine it supports.
- 7 pre-built contract templates (`src/plain-language/templates.ts`) for "Coding Best Practices", "Gaming & Streaming", "Personal Journal", etc. These assume usage patterns that haven't been validated by actual users.
- **~81,000 lines of markdown documentation** across 14+ files. The documentation-to-source ratio is approximately 8:1. Files like `KEYWORDS.md` (10,772 bytes), `ENCRYPTION_SECURITY_REVIEW.md` (17,215 bytes), and `AUDIT_REPORT.md` (8,047 bytes) add weight without adding clarity for a potential adopter.

**Wrong Product:**
- `packages/vault-adapter/` and `packages/boundary-adapter/` — correctly extracted to separate packages, but they integrate with systems (Memory Vault, Boundary Daemon) that have no public releases. These packages can't be used by anyone. They should exist as stubs/interfaces, not implementations.

**Scope Verdict: Focused but front-loaded.** The core is now identifiable and coherent. The worst offenders (Agent-OS SDK, SIEM reporter, daemon connector) have been removed. What remains is a library that has built all of the supporting infrastructure (error handling, multi-user permissions, session management, plain-language interface) *before* validating that anyone wants the core. The ratio of "nice-to-have features" to "battle-tested core" is still too high for an alpha.

---

### TECHNICAL ISSUES

#### High

1. **35 ESLint errors in shipped code.** The `createStrategicContract`, `createEpisodicContract`, `createProceduralContract`, and `createObservationContract` methods at `src/system.ts:279-313` use `any` for scope and options parameters. For a governance library that exists to enforce type-safe contracts, untyped public API methods are a credibility problem. The `deepPurge` method (`src/system.ts:503`) accepts `ownerConfirmation: any` for the most privileged operation in the system.

2. **Broken monorepo dependency resolution.** `packages/vault-adapter/` and `packages/boundary-adapter/` declare `learning-contracts@^0.1.0` as a peer dependency. This package isn't published to npm. Running `npm ci` (the standard CI install command) fails with `E404 Not Found`. A fresh clone requires `npm install --legacy-peer-deps` or `--ignore-scripts` to install.

3. **Unsafe enum comparisons.** `src/system.ts:586` and `src/system.ts:599` compare values without shared enum types. The `getMaxAbstraction` method at line 678 compares `contractType` (a `string`) against contract type values using string matching instead of enum comparison — inconsistent with the typed enum pattern used everywhere else.

#### Medium

4. **Plain-language parser is naive keyword matching.** Every detection method in `src/plain-language/parser.ts` uses `input.includes(keyword)` against hardcoded lists. "I want to learn JavaScript" would match domain "javascript" because `includes('javascript')` triggers — but "I want to learn Java" would also match "javascript" because "java" is a substring. No word boundary detection.

5. **Error system is oversized for its use.** The error types (`src/errors/types.ts`, 412 lines) + handler (`src/errors/handler.ts`, 417 lines) = 829 lines. This system defines MITRE ATT&CK techniques, CEF SIEM format, lockdown triggers, and buffered batch reporting. None of these are wired into the core system — `src/system.ts` throws plain `Error` objects (`throw new Error('Contract not found')` at lines 323, 335, 349, etc.), not the structured error types. The error system exists but isn't used by the code that produces errors.

6. **Excessive documentation.** ~81,000 lines of markdown for ~10,000 lines of source. Multiple review/audit documents (`AUDIT_REPORT.md`, `ENCRYPTION_SECURITY_REVIEW.md`, `EVALUATION_REPORT.md`, `REFOCUS_PLAN.md`) document internal process rather than helping adopters understand or use the library. The `README.md` is comprehensive but would benefit from a shorter "here's what this does and why you'd use it" section before diving into API reference.

#### Low

7. **File adapter race condition in tests.** `persistent-storage.test.ts` produces a `console.error` about an ENOENT during concurrent writes (`src/storage/repository.ts:103`). The file adapter's atomic rename pattern (`file-adapter.ts:427`) fails when the temp directory is cleaned between rename steps. Not a production issue (in-memory adapter is default), but indicates the file adapter hasn't been battle-tested.

8. **Rate limiter not configurable per contract type.** `src/system.ts:73-147` implements a token-bucket rate limiter for contract creation, but it applies uniformly. A user creating a PROHIBITED contract (safety-critical) is rate-limited the same as someone creating an OBSERVATION contract (low-risk). Rate limiting is disabled by default anyway.

---

### RECOMMENDATIONS

**CUT:**
- `src/errors/handler.ts` — the `CentralErrorHandler` with SIEM buffering, lockdown triggers, and retry strategies. None of this is connected to the actual system. Replace with simple error logging until there's a real SIEM to report to. Keep the error types/classes for structured errors.
- `AUDIT_REPORT.md`, `ENCRYPTION_SECURITY_REVIEW.md`, `KEYWORDS.md` — internal process documents that don't help adopters. Archive to a `docs/internal/` directory or remove.
- Pre-built templates in `src/plain-language/templates.ts` — speculative UX for users that don't exist. Keep the template system, remove the hardcoded templates until real usage patterns emerge.

**DEFER:**
- Multi-user permission management (`src/user-management/`) — premature for a library with zero users. The permission model is well-designed but untested by reality.
- Conversational contract builder (`src/plain-language/builder.ts`) — 751 lines of conversation flow management. Extract to a separate package or defer until the core has adopters.
- Emergency override system (`src/emergency-override/`) — a "pause all learning" kill switch is important in theory but adds complexity to a system that hasn't been deployed.
- `packages/vault-adapter/` and `packages/boundary-adapter/` — can't be used until their target systems exist. Keep as architectural placeholders but don't invest further.

**DOUBLE DOWN:**
- **Fix the 35 lint errors.** Type the `any` parameters in `src/system.ts`. A governance library cannot ship with untyped security-critical methods.
- **Wire the error system into the core.** Replace `throw new Error('Contract not found')` throughout `src/system.ts` with `throw new ContractError(...)`. The structured errors exist — use them.
- **Fix monorepo peer dependency.** Either use a `file:` reference for the workspace peer dependency or configure npm workspaces to resolve it locally.
- **Write a "Getting Started" guide under 100 lines** that shows the core value loop: create contract → enforce memory creation → check recall → revoke → verify memory is tombstoned. The current README is comprehensive but overwhelming for a first-time reader.
- **Validate with one real consumer.** Integrate this with one actual AI agent that has memory (even a toy example). The entire concept is untested against reality.

---

**FINAL VERDICT: Continue — with discipline.**

The project has improved substantially since the refocus. The god class is tamed. The orphaned modules are deleted. Tests pass. The concept remains strong and the core (contracts + enforcement + audit) is coherent. But the library is still building horizontally (more features, more subsystems) instead of vertically (one working integration with a real AI system).

The next milestone should not be more code. It should be **one working demonstration** of an AI agent using learning contracts to govern its memory. Until that exists, every additional feature is speculative infrastructure.

**Next Steps:**
1. Fix the 35 lint errors — type safety is non-negotiable for a governance library
2. Wire structured errors into `system.ts` — use the error system you built
3. Fix `npm ci` — a library that can't install from a clean clone is DOA
4. Build one real integration example with an AI agent that has memory
