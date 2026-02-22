# Vibe-Code Detection Audit v2.0
**Project:** learning-contracts
**Date:** 2026-02-22
**Auditor:** Claude (automated analysis)

## Executive Summary

This project is a TypeScript library implementing "Learning Contracts" — explicit, enforceable agreements governing what an AI assistant is allowed to learn, retain, and recall. The concept is genuinely novel and the implementation demonstrates real engineering depth, particularly in cryptographic operations (AES-256-GCM encryption at rest, HMAC-SHA256 token validation, PBKDF2 key derivation) and error handling (8 custom exception classes with CEF/SIEM formatting).

However, the surface provenance is overwhelmingly AI-generated: 89% of commits are attributed to Claude or dependabot, commit messages are nearly all formulaic, and there are zero human iteration markers (no TODOs, FIXMEs, WHY comments, or reverts) across 73 source files. The codebase exhibits the hallmarks of AI-assisted development that has been competently directed but lacks evidence of deep human review — the code is unusually uniform in style, comprehensively documented relative to project age, and free of the organic rough edges that characterize human-iterated codebases.

The behavioral core is solid: enforcement call chains complete end-to-end, security primitives are real (not decorative), and the error hierarchy is production-grade. The primary gaps are unbounded state growth (audit log, Maps), a hardcoded fallback for the purge token secret, and memory forgetting operations that track metadata without mutating an actual store. Classification: **AI-Assisted** — genuine engineering directed by AI tooling with limited evidence of human iteration.

## Scoring Summary

| Domain | Weight | Score | Percentage | Rating |
|--------|--------|-------|------------|--------|
| A. Surface Provenance | 20% | 13/21 | 61.9% | Moderate |
| B. Behavioral Integrity | 50% | 17/21 | 81.0% | Strong |
| C. Interface Authenticity | 30% | 16/21 | 76.2% | Strong |

**Weighted Authenticity:** 75.7%
**Vibe-Code Confidence:** 24.3%
**Classification:** AI-Assisted (16-35 range)

---

## Domain A: Surface Provenance

### A1. Commit History Patterns — Score: 1 (Weak)

**Evidence:**
```
Author breakdown (74 total commits):
  43 Claude
  23 dependabot[bot]
   8 Kase
```
- AI-attributed commits: 66/74 = **89%**
- Formulaic commit messages: 65/74 = **88%** (e.g., "Prepare library for production readiness", "Extract vault and boundary integrations", "Decompose system.ts god class")
- Human frustration/iteration markers: **3** (minimal)
- Reverts: **0**
- AI branch names: `claude/code-review-vibe-check-JYKcQ`

**Assessment:** The commit history is overwhelmingly AI-generated. Only 8 of 74 commits come from a human author (Kase). All Claude commits follow the formulaic "Verb + noun phrase" pattern. The 3 human markers are the only evidence of organic iteration. Zero reverts suggests either perfect-first-time development or lack of human course correction.

**Remediation:** Make smaller, human-authored commits with descriptive messages explaining *why* changes were made. Add iterative commits (WIP, fix typo, etc.) that reflect genuine development workflow.

---

### A2. Comment Archaeology — Score: 1 (Weak)

**Evidence:**
- Tutorial-style comments: **0**
- Section divider comments: **0** (though `// ====` dividers exist in `src/system.ts`)
- TODO/FIXME/XXX/HACK markers: **0**
- WHY comments (because, since, reason): **0**
- Source files: **73**

**Assessment:** Zero TODOs or FIXMEs across 73 source files is a strong AI signal. Human-developed codebases of this size always contain at least some iteration markers. The complete absence of WHY comments means all comments describe WHAT the code does, never WHY it was written that way. While the absence of tutorial-style comments is a positive indicator (no "First, we define..." patterns), the sterile perfection of the comment landscape is itself suspicious.

**Remediation:** Add TODO markers for known limitations (e.g., unbounded audit log growth). Add WHY comments where design decisions were made (e.g., why PBKDF2 over Argon2, why 100k iterations, why token bucket over sliding window).

---

### A3. Test Quality Signals — Score: 2 (Moderate)

**Evidence:**
- Test functions: **523** across 14 test files
- Trivial assertions (toBeDefined, toBeNull, toBeTruthy): **57** (10.9%)
- Error path testing (toThrow, rejects, toBe(false)): **182** (34.8%)
- Parametrized/table-driven tests: **2**
- Formulaic test docstrings: **0**

**Sample analysis** (`tests/enforcement.test.ts`):
- Tests verify specific enforcement behavior with contract state assertions
- Test names describe scenarios: "should deny when contract is not active (DRAFT state)"
- Helper functions (`activateContract`, `makeContext`) reduce boilerplate
- Tests cover all four enforcement hooks with allow/deny paths

**Assessment:** Strong error-path coverage (35% of assertions test failure modes) and scenario-descriptive test names are positive signals. The 57 trivial assertions are a minor concern but represent only 11% of the total. The near-absence of parametrized tests (only 2) is a weakness — many enforcement scenarios could be table-driven. The sheer volume (523 tests) for this codebase size suggests AI-generated test expansion.

**Remediation:** Convert repetitive test patterns (e.g., enforcement deny scenarios) to parametrized `test.each()` calls. Remove trivial `toBeDefined()` assertions where they don't add value.

---

### A4. Import & Dependency Hygiene — Score: 3 (Strong)

**Evidence:**
- Runtime dependencies: **1** (`uuid`)
- External imports used in source: `crypto`, `fs/promises`, `path`, `uuid` (all Node built-ins except uuid)
- Wildcard imports: **0**
- Lazy imports: **0**
- Dev dependencies: jest, typescript, eslint, prettier, ts-jest, globals, @types/* — all standard toolchain

**Assessment:** Extremely lean dependency tree. The single runtime dependency (`uuid`) is genuinely used in `src/audit/logger.ts` for generating unique event IDs. All Node built-in imports (`crypto`, `fs/promises`, `path`) are deeply utilized — crypto for AES-256-GCM encryption, PBKDF2, HMAC; fs/promises for file storage; path for path resolution. No phantom dependencies, no wildcard imports.

**Remediation:** None needed. This is exemplary dependency hygiene.

---

### A5. Naming Consistency — Score: 1 (Weak)

**Evidence:**
- 30 classes: All PascalCase, no abbreviations, no deviations
  - `LearningContractsSystem`, `EnforcementEngine`, `ContractLifecycleManager`, `CentralErrorHandler`, `PlainLanguageSummarizer`, `ConversationalContractBuilder`...
- All methods: camelCase, no abbreviations, no mixed conventions
  - `checkMemoryCreation`, `logEnforcementCheck`, `findApplicableContract`, `triggerEmergencyOverride`...
- Factory functions: `createEpisodicContract`, `createObservationContract`... perfectly uniform pattern

**Assessment:** Zero deviations across 30+ class names and 100+ method names. No abbreviations, no legacy naming, no mixed conventions from different contributors. This level of uniformity is characteristic of single-session AI generation, not multi-contributor human development. Real projects accumulate naming inconsistencies over time (abbreviated names, different conventions from different authors, refactored-but-not-renamed functions).

**Remediation:** This is not something to "fix" per se — the naming is excellent. The signal is provenance, not quality.

---

### A6. Documentation vs Reality — Score: 2 (Moderate)

**Evidence:**
- Documentation files: 8 top-level markdown files + 7 internal docs = **15 total**
- README.md: 449 lines with full API reference, code examples, design philosophy
- Additional docs: CONTRIBUTING.md, SECURITY.md, CHANGELOG.md, SUPPORT.md, User-Manual.md, EVALUATION_REPORT.md, claude.md
- Internal docs: AUDIT_REPORT.md, ENCRYPTION_SECURITY_REVIEW.md, PLAN.md, REFOCUS_PLAN.md, specs.md, system-arch.md

**Reality check:**
- All contract types documented in README exist in code ✓
- All enforcement hooks documented exist and function ✓
- All subsystems (sessions, expiry, emergency override, etc.) exist ✓
- Integration adapters (vault-adapter, boundary-adapter) exist as packages ✓
- "Part of Agent OS ecosystem" — external repos referenced but not verified

**Assessment:** Documentation accurately reflects implementation — no fabricated features. However, the documentation volume (15 files including internal architecture docs, encryption reviews, and evaluation reports) is disproportionately high for a project with only 8 human commits. This is a classic AI-generation pattern: comprehensive documentation produced alongside code rather than accumulated organically.

**Remediation:** Trim internal docs to what's actively maintained. Remove stale planning documents (REFOCUS_PLAN.md) that don't reflect current state.

---

### A7. Dependency Utilization — Score: 3 (Strong)

**Evidence:**
- `uuid`: Used in `src/audit/logger.ts:8` — `uuidv4()` generates unique event IDs for every audit entry
- `crypto` (built-in): Deeply integrated across 3 modules:
  - `src/storage/file-adapter.ts`: AES-256-GCM encryption, PBKDF2 key derivation, SHA-256 checksums, randomBytes for IVs
  - `src/memory/forgetting.ts`: HMAC-SHA256 for purge tokens, randomBytes for nonces, timingSafeEqual for validation
  - `packages/vault-adapter/src/security-utils.ts`: timingSafeEqual, zeroMemory for secure cleanup
- `fs/promises`: Used in `src/storage/file-adapter.ts` for async file I/O with atomic writes
- `path`: Used in `src/storage/file-adapter.ts` for path resolution

**Assessment:** Every dependency is deeply integrated into actual functionality. The crypto usage is particularly notable — this is not decorative security. AES-256-GCM with proper IV generation, PBKDF2 with 100k iterations, constant-time comparisons, and authentication tags are all correctly implemented.

**Remediation:** None needed.

---

## Domain B: Behavioral Integrity

### B1. Error Handling Authenticity — Score: 3 (Strong)

**Evidence:**
- Catch blocks: **29** across source files
- Custom exception hierarchy: **8 classes** (`src/errors/types.ts:185-411`)
  - `LearningContractsError` (base) → `ContractError`, `EnforcementError`, `SecurityError`, `StorageError`, `NetworkError`, `IntegrationError`, `AuthError`
- `instanceof` typed checks: **14**
- Error codes: **40+ distinct codes** organized by category (1000-10000+ ranges)
- CEF format for SIEM: `toCEF()` method on base error class (`src/errors/types.ts:257-281`)
- Error chaining: `cause` support via `Object.defineProperty` (`src/errors/types.ts:211-217`)
- MITRE ATT&CK technique mapping: field on error events (`src/errors/types.ts:162`)
- Recovery strategies: exponential backoff with configurable retry (`src/errors/handler.ts:180-245`)

**Critical path review:**
- `src/storage/file-adapter.ts:311`: Catches ENOENT specifically, falls through to generic error re-wrap
- `src/errors/handler.ts:168`: Handler errors caught and logged without recursion
- `src/expiry/manager.ts:113-212`: Multiple catch blocks with logged context, though some catch generic `error`

**Assessment:** The error handling is genuinely production-grade. The 8-class hierarchy with numeric error codes, severity levels, CEF formatting, and MITRE ATT&CK mapping goes well beyond decorative. The `CentralErrorHandler` with SIEM buffering, lockdown triggers, and retry strategies is a real system. The only minor gap is some catch blocks in `src/expiry/manager.ts` that catch generic `error` rather than typed exceptions.

**Remediation:** In `src/expiry/manager.ts`, type the catch blocks to distinguish between ContractError and unexpected errors.

---

### B2. Configuration Actually Used — Score: 3 (Strong)

**Evidence:**
- Environment variables defined/read:
  - `PURGE_TOKEN_SECRET` → read in `src/memory/forgetting.ts:15` → consumed by `generatePurgeToken()` and `validatePurgeToken()`
- Config classes and consumption:
  - `RateLimitConfig` (`src/system.ts:59`) → consumed by `RateLimiter` class → used in `createContract()`
  - `FileStorageConfig` (`src/storage/file-adapter.ts:53`) → consumed by `FileStorageAdapter` constructor
  - `EncryptionConfig` (`src/storage/file-adapter.ts:31`) → consumed by encryption/decryption methods
  - `ErrorHandlerConfig` (`src/errors/handler.ts:20`) → consumed by `CentralErrorHandler`
  - `EmergencyOverrideConfig` → consumed by `EmergencyOverrideManager`
  - `SessionManagerConfig` → consumed by `SessionManager`

**Assessment:** Every configuration option traces to behavioral code that consumes it. No ghost config. The single environment variable (`PURGE_TOKEN_SECRET`) has a clear producer-consumer relationship. Config-to-behavior mapping is transparent.

**Remediation:** None for config wiring. See B6 for the hardcoded fallback concern.

---

### B3. Call Chain Completeness — Score: 2 (Moderate)

**Evidence — Critical feature traces:**

**1. Contract Creation** (complete ✓):
```
system.createContract() → rateLimiter.tryConsume() → lifecycleManager.createDraft()
→ repository.save() → permissions.setOwner()
```
All return values consumed. Rate limit check gates creation.

**2. Enforcement (Memory Creation)** (complete ✓):
```
system.checkMemoryCreation() → engine.checkMemoryCreation()
→ emergencyOverride.checkOperation() → lifecycleManager.isEnforceable()
→ checkScope() → auditLogger.logEnforcementCheck()
```
Four hooks all follow identical pattern. Return values are `EnforcementResult` consumed by caller.

**3. Deep Purge with Crypto Verification** (complete ✓):
```
system.deepPurge() → memoryForgetting.deepPurge()
→ validatePurgeToken() [HMAC-SHA256 + timingSafeEqual]
→ findDerivedMemories() [recursive]
→ auditLogger.logMemoryPurged()
```

**4. File Storage with Encryption** (complete ✓):
```
FileStorageAdapter.initialize() → deriveEncryptionKey() [PBKDF2]
→ loadFromFile() → loadEncryptedFile() → decrypt() [AES-256-GCM]
→ verify checksum [SHA-256 + constantTimeCompare]
→ deserializeContract() → Map.set()
```

**5. Memory Forgetting** (metadata-only ⚠️):
```
freezeMemories() → filters memories by contract_id → returns ForgettingResult
tombstoneMemories() → finds derived memories recursively → returns ForgettingResult
```
These methods return `ForgettingResult` with affected IDs but **do not mutate any actual memory store**. The caller must handle actual deletion/freezing based on the result.

**Dead modules:** All 12 source modules have external imports — no orphaned code.
**Stubs:** Zero `NotImplementedError` or `throw new Error('Not implemented')` stubs.

**Assessment:** Core call chains (contract creation, enforcement, storage, crypto) complete end-to-end with no dead ends. The memory forgetting operations are the notable gap — they compute what *should* happen but delegate actual mutation to the caller. This is arguably a design choice (the library manages contracts, not memory stores), but it means the forgetting guarantees are only as good as the integration layer.

**Remediation:** Document explicitly that `freezeMemories`/`tombstoneMemories`/`deepPurge` return intent, not execution. Consider adding a `MemoryStore` callback interface for actual deletion.

---

### B4. Async Correctness — Score: 3 (Strong)

**Evidence:**
- Async functions: **42**
- Promise usage: **440** instances
- Blocking calls in async context: **0** in source (4 `readFileSync` in tests only — `tests/persistent-storage.test.ts`)
- File I/O: Uses `fs/promises` throughout (`fsPromises.readFile`, `fsPromises.writeFile`)
- No event loop blocking detected

**Assessment:** Clean async/sync separation. All file operations use the promises API. No blocking calls in async handlers. The project doesn't need async locks (Node.js single-threaded model with no SharedArrayBuffer usage). Test files use `readFileSync` for verification, which is appropriate in test context.

**Remediation:** None needed.

---

### B5. State Management Coherence — Score: 2 (Moderate)

**Evidence:**
- In-memory Maps (all unbounded):
  - `src/audit/logger.ts:20` — `events: AuditEvent[] = []` — **no size limit**
  - `src/storage/repository.ts:34` — `contracts: Map<string, LearningContract>`
  - `src/session/manager.ts:60` — `sessions: Map<string, Session>`
  - `src/user-management/manager.ts:36` — `users: Map<string, User>`
  - `src/system.ts:78` — `buckets: Map<string, { tokens, lastRefill }>` (rate limiter)
  - `src/plain-language/builder.ts:57` — `conversations: Map` (but has `cleanupOldConversations` with TTL)

- Bounded state:
  - `src/errors/handler.ts:74` — `errorBuffer` bounded at `buffer_size: 100` ✓
  - `src/plain-language/builder.ts:737` — `cleanupOldConversations(maxAgeMs)` ✓

- Cleanup handlers:
  - `clearInterval` calls: 5 (all timers have cleanup) ✓
  - `close()` methods on storage adapters ✓
  - `shutdown()` on error handler ✓
  - `destroy()` on boundary-adapter ✓

**Assessment:** Timer lifecycle management is proper — all `setInterval`/`setTimeout` calls have corresponding `clearInterval`/`clearTimeout` in cleanup methods. However, the audit log (`events: AuditEvent[]`) grows without bound, which is a production concern for long-running processes. Most Maps are unbounded but have cleanup paths. The conversation builder is the only Map with TTL-based cleanup.

**Remediation:**
- Add `maxEvents` configuration to `AuditLogger` with oldest-first eviction
- Add periodic cleanup for rate limiter buckets (stale entries persist indefinitely)
- Consider size limits on session and user Maps

---

### B6. Security Implementation Depth — Score: 2 (Moderate)

**Evidence:**

**Real security (not decorative):**
- AES-256-GCM encryption at rest: `src/storage/file-adapter.ts:92-211` — proper IV generation (96-bit), authentication tags, PBKDF2 key derivation with 100k iterations
- HMAC-SHA256 purge tokens: `src/memory/forgetting.ts:54-106` — nonce + timestamp + signature with `timingSafeEqual` validation
- Constant-time comparison: `src/storage/file-adapter.ts:446-461` — correct implementation handling different-length strings
- File permissions: `0o600` on storage files (`src/storage/file-adapter.ts:415,418`)
- Atomic writes: write-to-temp-then-rename pattern (`src/storage/file-adapter.ts:411-431`)
- Input validation: `src/user-management/permissions.ts:19-28` — length, character, and format validation on IDs
- Rate limiting: Token bucket implementation in `src/system.ts:77-151`

**Security gaps:**
- **Hardcoded fallback secret**: `src/memory/forgetting.ts:15`:
  ```typescript
  const TOKEN_SECRET = process.env.PURGE_TOKEN_SECRET ?? 'learning-contracts-purge-token-secret';
  ```
  This means deep purge tokens can be forged if the env var is not set.
- No SSRF protection (not applicable — library, not web service)
- No SQL injection vectors (no SQL used)
- Hardcoded secrets scan: **clean** (no API keys, passwords, or tokens in source beyond the fallback above)

**Assessment:** The cryptographic implementation is genuinely deep — this is not decorative security. AES-256-GCM with proper IV/authTag handling, PBKDF2 with sufficient iterations, and constant-time comparisons are all correctly implemented. The hardcoded fallback for `PURGE_TOKEN_SECRET` is the significant gap — it reduces deep purge security to zero when the env var is unset.

**Remediation:**
- Remove the hardcoded fallback in `src/memory/forgetting.ts:15`. Throw an error if `PURGE_TOKEN_SECRET` is not set when purge operations are attempted.
- Consider Argon2id over PBKDF2 for key derivation (more resistant to GPU attacks).

---

### B7. Resource Management — Score: 2 (Moderate)

**Evidence:**
- File operations:
  - `src/storage/file-adapter.ts:415-416`: Atomic write (write temp → rename) ✓
  - `src/storage/file-adapter.ts:255-261`: `close()` flushes data before marking uninitialized ✓
  - `src/storage/file-adapter.ts:419-426`: Temp file cleanup in error path ✓

- Timer lifecycle:
  - `src/emergency-override/manager.ts:152,316`: `clearTimeout(this.autoDisableTimeout)` ✓
  - `src/errors/handler.ts:293`: `clearInterval(this.flushTimer)` in `shutdown()` ✓
  - `src/expiry/manager.ts:72`: `clearInterval(this.intervalId)` ✓
  - `src/user-management/manager.ts:369`: `clearInterval(this.timeoutTimer)` ✓

- Background tasks:
  - 4 `setInterval` timers — all have corresponding cleanup ✓
  - 1 `setTimeout` timer — has cleanup ✓

- Unbounded growth:
  - `src/audit/logger.ts:20`: `events: AuditEvent[]` — grows forever ⚠️
  - `src/errors/handler.ts:74`: `errorBuffer` — bounded at 100 ✓

**Assessment:** Resource management is mostly proper. All timers have cleanup, file operations use atomic writes and error-path cleanup, and the storage adapter has a proper close lifecycle. The audit log growing without bound is the primary gap — in a long-running process, this will eventually cause memory exhaustion.

**Remediation:**
- Add max event count to `AuditLogger` with rotation/eviction policy
- Consider writing audit events to the file adapter for persistence and bounded memory usage

---

## Domain C: Interface Authenticity

### C1. API Design Consistency — Score: 3 (Strong)

**Evidence:**
- All enforcement checks return `EnforcementResult` (`{ allowed: boolean; reason?: string; contract_id: string }`)
- All lifecycle methods return `LearningContract`
- All memory operations return `ForgettingResult`
- Consistent parameter ordering: `contractId` first, then `actor`, then operation-specific params
- Consistent error throwing: `ContractError` with `ErrorCode.CONTRACT_NOT_FOUND` for missing contracts
- Consistent subsystem pattern: public readonly properties on `LearningContractsSystem`

**Assessment:** The public API is highly consistent. Every method family follows the same patterns. Error responses are structured and typed. This is a clean, well-designed library API.

---

### C2. UI Implementation Depth — Score: N/A

**Assessment:** This is a library with no frontend component. Not applicable.
**Scored as: 2 (neutral baseline)**

---

### C3. State Management (Frontend) — Score: N/A

**Assessment:** No frontend component.
**Scored as: 2 (neutral baseline)**

---

### C4. Security Infrastructure — Score: 2 (Moderate)

**Evidence:**
- Rate limiting: Token bucket in `src/system.ts:77-151` — real implementation with configurable window/max ✓
- Encryption at rest: AES-256-GCM in `src/storage/file-adapter.ts` ✓
- Emergency override / lockdown: `src/emergency-override/manager.ts` + `src/errors/handler.ts:359-397` ✓
- SIEM integration: CEF formatting (`src/errors/types.ts:257`), buffered error reporting (`src/errors/handler.ts:273-288`)
- Lockdown triggers: Specific error codes trigger system lockdown (`src/errors/handler.ts:370-377`)

**Gaps:**
- SIEM reporter is a callback (`setSiemReporter()`) — must be wired by consumer
- Lockdown callback is external (`setLockdownCallback()`) — same
- Rate limiting disabled by default (`enabled: false` at `src/system.ts:71`)
- No CORS/CSP (not applicable — not a web server)

**Assessment:** The security infrastructure is real but requires consumer wiring. The components (rate limiter, encryption, lockdown, SIEM) are implemented but operate in an opt-in model. This is appropriate for a library but means security guarantees depend on correct integration.

---

### C5. WebSocket Implementation — Score: N/A

**Assessment:** Not applicable — no WebSocket or real-time communication.
**Scored as: 2 (neutral baseline)**

---

### C6. Error UX — Score: 3 (Strong)

**Evidence:**
- Structured errors with codes, categories, and severity: `src/errors/types.ts`
- Human-readable messages: "Contract not found", "Rate limit exceeded... Please wait X seconds"
- Context information: `contract_id`, `user_id`, `session_id`, `operation` in every error
- Remediation suggestions: `remediation` field on error events
- CEF format for automated processing: `toCEF()` method
- JSON serialization for API reporting: `toJSON()` method
- Console logging respects severity levels: `src/errors/handler.ts:326-341`

**Assessment:** Error UX is production-grade for a library. Consumers get structured errors with actionable context, not raw stack traces. The severity-based console logging and multiple serialization formats (CEF, JSON) support different consumption patterns.

---

### C7. Logging & Observability — Score: 2 (Moderate)

**Evidence:**
- Structured audit events: `AuditEvent` with `event_id` (UUID), `timestamp`, `event_type`, `actor`, `contract_id`, `details`
- Event types: 11 distinct types covering full lifecycle and enforcement
- Query capabilities: Filter by contract, event type, actor, time range, allowed/denied; pagination support (`src/audit/logger.ts:346-381`)
- Error statistics: `ErrorStats` with breakdowns by severity and category (`src/errors/handler.ts:38-45`)
- Violation tracking: Dedicated `getViolations()` query

**Gaps:**
- No request correlation IDs across operations (each event has its own `event_id` but no shared `correlation_id` linking related operations)
- No metrics collection beyond error stats (no latency tracking, no operation counts)
- No health check endpoint (library, not service — but no health check function either)
- Audit events are in-memory only (no persistence to file or external system)

**Assessment:** Good structured logging with queryable audit trail. The gap is the in-memory-only nature of the audit log — events are lost on process restart unless the consumer exports them. Correlation IDs exist in the error types but aren't populated in the audit logger.

**Remediation:** Populate `correlation_id` in error context to enable cross-operation tracing. Consider adding an audit log persistence adapter.

---

## High Severity Findings

| # | Finding | Location | Impact | Remediation |
|---|---------|----------|--------|-------------|
| 1 | Hardcoded fallback for purge token secret | `src/memory/forgetting.ts:15` | Deep purge tokens can be forged when `PURGE_TOKEN_SECRET` env var is unset, defeating cryptographic verification | Remove fallback; throw error if secret is not configured when purge is attempted |
| 2 | Unbounded audit log growth | `src/audit/logger.ts:20` | Memory exhaustion in long-running processes; `events: AuditEvent[]` grows without limit | Add `maxEvents` config with oldest-first eviction or external persistence |
| 3 | Memory forgetting is metadata-only | `src/memory/forgetting.ts:115-233` | `freezeMemories`/`tombstoneMemories`/`deepPurge` return intent but don't mutate any store; actual forgetting depends entirely on consumer implementation | Document this explicitly; consider adding a `MemoryStore` callback interface |

## Medium Severity Findings

| # | Finding | Location | Impact | Remediation |
|---|---------|----------|--------|-------------|
| 1 | Rate limiting disabled by default | `src/system.ts:71` | Contract creation is unthrottled unless consumer explicitly enables rate limiting | Consider enabling by default with generous limits |
| 2 | Unbounded rate limiter buckets | `src/system.ts:78` | Stale bucket entries for inactive users persist in memory | Add periodic cleanup of buckets older than `windowMs` |
| 3 | No audit log persistence | `src/audit/logger.ts:20` | Audit events lost on process restart; compliance gaps for audit trail requirements | Add file-backed or external audit log adapter |
| 4 | Generic catch blocks in expiry manager | `src/expiry/manager.ts:113-212` | Catches `error` without typing; different error categories get same handling | Use `instanceof` checks to differentiate ContractError from system errors |
| 5 | SIEM/lockdown requires external wiring | `src/errors/handler.ts:116-123` | Security infrastructure (SIEM reporting, lockdown) is inactive unless consumer calls `setSiemReporter()`/`setLockdownCallback()` | Document required wiring in Quick Start; consider auto-console SIEM for development |

## What's Genuine

- **Cryptographic implementation**: AES-256-GCM with proper IV generation, PBKDF2 with 100k iterations, HMAC-SHA256 with `timingSafeEqual` — this is not decorative security. The `constantTimeCompare` function (`src/storage/file-adapter.ts:446-461`) correctly handles different-length inputs.
- **Error hierarchy**: 8 custom exception classes with numeric error codes, CEF formatting, MITRE ATT&CK mapping, and recovery strategies represent real engineering depth (`src/errors/types.ts`, `src/errors/handler.ts`).
- **Enforcement engine**: Four mandatory hooks with fail-closed semantics, emergency override integration, scope checking, and full audit logging (`src/enforcement/engine.ts`). Call chains complete end-to-end.
- **Atomic file writes**: Write-to-temp-then-rename with `0o600` permissions and error-path cleanup (`src/storage/file-adapter.ts:411-431`).
- **Contract lifecycle state machine**: Draft → Review → Active → Expired/Revoked/Amended with audit logging at every transition (`src/contracts/lifecycle.ts`).
- **Lean dependency tree**: Only 1 runtime dependency (`uuid`). All code uses Node built-ins for crypto, file I/O, and path operations.
- **Test coverage depth**: 523 tests with 35% error-path assertions covering enforcement, lifecycle, storage, and integration scenarios.

## What's Vibe-Coded

- **Documentation volume**: 15 documentation files for a project with 8 human commits — documentation was generated alongside code rather than accumulated from experience (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`, `User-Manual.md`, plus 7 internal docs).
- **Perfect naming uniformity**: 30 classes and 100+ methods with zero naming deviations — no abbreviations, legacy names, or convention drift across any file.
- **Zero iteration markers**: 0 TODOs, 0 FIXMEs, 0 WHY comments across 73 source files — an organically developed codebase always has rough edges.
- **Commit history**: 89% AI-authored commits with 88% formulaic messages. The development history reads as a sequence of AI work sessions, not iterative human development.
- **Comprehensive scaffolding**: GitHub templates (bug report, feature request, PR template), `.editorconfig`, CI workflow, dependabot config — all generated in early commits rather than added as needs arose.
- **Integration adapter packages**: `packages/vault-adapter/` and `packages/boundary-adapter/` provide typed interfaces for external systems that don't exist yet — forward-looking scaffolding without current consumers.

## Remediation Checklist

- [ ] **CRITICAL**: Remove hardcoded fallback in `src/memory/forgetting.ts:15` — require `PURGE_TOKEN_SECRET` env var or throw on purge attempt
- [ ] **HIGH**: Add `maxEvents` configuration to `AuditLogger` with eviction policy to prevent unbounded memory growth
- [ ] **HIGH**: Document that memory forgetting methods return intent, not execution — consumers must implement actual memory deletion
- [ ] **MEDIUM**: Enable rate limiting by default with generous limits (e.g., 1000/minute)
- [ ] **MEDIUM**: Add periodic cleanup for stale rate limiter buckets
- [ ] **MEDIUM**: Add audit log persistence adapter (file-backed or external)
- [ ] **MEDIUM**: Type catch blocks in `src/expiry/manager.ts` to differentiate error categories
- [ ] **LOW**: Add TODO/FIXME markers for known limitations (demonstrates awareness)
- [ ] **LOW**: Add WHY comments for key design decisions (PBKDF2 iteration count, token bucket choice, fail-closed semantics)
- [ ] **LOW**: Convert repetitive enforcement tests to parametrized `test.each()` patterns
- [ ] **LOW**: Remove or consolidate stale internal planning documents (`docs/internal/REFOCUS_PLAN.md`, `docs/internal/PLAN.md`)
- [ ] **LOW**: Populate `correlation_id` in audit events for cross-operation tracing
