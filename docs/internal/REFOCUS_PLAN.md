# REFOCUS PLAN

**Goal:** Strip this project from a 18,000-line over-engineered alpha to a focused, tested, shippable governance library.

Each phase is independent and completable in isolation. Do them in order. Don't start the next phase until the current one is green.

---

## PHASE 0: EMERGENCY STABILIZATION

**Goal:** Make the test suite pass. Nothing else matters until this is done.

**Why first:** A governance library that can't verify its own correctness has zero credibility. 11 of 12 test suites crash before running a single assertion.

**Work:**

| Task | Detail | Est. Effort |
|------|--------|-------------|
| Fix Jest ESM config | Add `transformIgnorePatterns: ['/node_modules/(?!uuid)']` to `jest.config.cjs` so `uuid` v13 ESM exports get transpiled by ts-jest | 1 line |
| Run full suite | Verify all 12 test suites pass | - |
| Fix any test failures | Address any tests that were silently broken under the ESM crash | Unknown until tests run |
| Update coverage comment | Remove the stale "70.25%" comment in `jest.config.cjs:16` and replace with actual measured numbers | 1 line |
| Recalibrate thresholds | Set coverage thresholds to actual passing values (measure first, then set 2% below) | 4 lines |
| Verify CI | Ensure GitHub Actions pipeline passes on Node 18, 20, 22 | - |

**Exit criteria:** `npm test` passes. `npm run test:coverage` reports real numbers. CI is green.

**Files touched:**
- `jest.config.cjs`
- Possibly test files if assertions are stale

---

## PHASE 1: SURGICAL REMOVAL

**Goal:** Delete the three completely orphaned integration modules. They have zero internal consumers, no real implementations, and target systems that don't exist.

**Why:** These 2,772 lines add zero value today and inflate the project's surface area. They make the library look like vaporware.

### Phase 1A: Delete Agent-OS Integration

| Item | Detail |
|------|--------|
| **Delete** | `src/agent-os-integration/` (7 files, 1,871 lines) |
| **Delete** | `tests/agent-os-integration.test.ts` (745 lines) |
| **Remove exports** | Lines 243-302 from `src/index.ts` (60 lines of exports) |
| **What's lost** | `AgentOSMemoryAdapter`, `AgentOSBoundaryAdapter`, `AgentOSKernelHooks`, `AgentOSConsentBridge`, `AgentOSPythonClient`, `generatePythonClientCode()`, `generateAgentOSIntegrationModule()` |
| **Who breaks** | Nobody. Zero internal imports except `index.ts` |
| **Risk** | None. Mock-only implementations of interfaces for a system that doesn't exist |

### Phase 1B: Delete SIEM Integration

| Item | Detail |
|------|--------|
| **Delete** | `src/siem-integration/` (3 files, 928 lines) |
| **Remove exports** | Lines 332-350 from `src/index.ts` (19 lines) |
| **What's lost** | `SIEMReporter`, CEF format conversion, UDP syslog transport, batch event queuing |
| **Who breaks** | Nobody. Zero internal imports. No test file exists |
| **Risk** | None |

### Phase 1C: Delete Daemon Connector

| Item | Detail |
|------|--------|
| **Delete** | `src/daemon-connector/` (3 files, 973 lines) |
| **Remove exports** | Lines 352-378 from `src/index.ts` (27 lines) |
| **What's lost** | `DaemonConnector`, `MockDaemonConnector`, Unix socket + HTTP protocol client |
| **Who breaks** | Nobody. Zero internal imports. No test file exists |
| **Risk** | None. Duplicate of boundary-integration adapter pattern |

### Phase 1D: Remove stale documentation referencing deleted modules

| Item | Detail |
|------|--------|
| **Update** | `README.md` - remove sections about Agent-OS, SIEM, Daemon Connector |
| **Update** | `CHANGELOG.md` - add entry noting removal and reason |
| **Update** | Any `specs.md` / `system-arch.md` references |

**Exit criteria:** `npm test` still passes. `npm run build` still passes. `src/index.ts` no longer exports anything from the three deleted directories. Line count reduced by ~2,772 source lines and ~745 test lines.

**Net removal:** ~3,517 lines deleted. Zero functionality lost.

---

## PHASE 2: CORE HARDENING

**Goal:** Get the five core modules to 90%+ test coverage with meaningful assertions. This is the actual product.

**Core modules (the product):**

| Module | Files | Lines | Current Test |
|--------|-------|-------|-------------|
| `src/contracts/` | factory.ts, lifecycle.ts, validator.ts | ~1,556 | system.test.ts (partial) |
| `src/enforcement/` | engine.ts | ~435 | system.test.ts (partial) |
| `src/audit/` | logger.ts | ~150 | system.test.ts (partial) |
| `src/storage/` | repository.ts, memory-adapter.ts | ~440 | persistent-storage.test.ts |
| `src/types/` | contract.ts, audit.ts, index.ts | ~190 | (type-only, no tests needed) |
| **Total** | | **~2,771** | |

**Work:**

| Task | Detail |
|------|--------|
| Write `tests/contracts.test.ts` | Dedicated test suite for ContractFactory, ContractLifecycleManager, ContractValidator. Cover every state transition (Draft->Review->Active->Expired/Revoked/Amended). Cover validation edge cases. Cover factory defaults |
| Write `tests/enforcement.test.ts` | Dedicated test suite for EnforcementEngine. Cover all four hooks (memory creation, abstraction, recall, export). Cover fail-closed default behavior. Cover scope dimension checking across all 5 dimensions. Cover emergency override interaction |
| Write `tests/audit.test.ts` | Dedicated test suite for AuditLogger. Cover every audit event type. Cover log retrieval and filtering. Cover immutability guarantees |
| Expand `tests/persistent-storage.test.ts` | Add tests for ContractRepository query options, edge cases, concurrent access patterns |
| Measure and enforce | Run `npm run test:coverage`, set per-file thresholds for these 5 modules at 90% |

**Exit criteria:** `src/contracts/`, `src/enforcement/`, `src/audit/`, `src/storage/` each have 90%+ line coverage with per-file thresholds enforced in `jest.config.cjs`. The core contract->enforce->audit loop is bulletproof.

---

## PHASE 3: DECOMPOSE THE GOD CLASS

**Goal:** Break `src/system.ts` (1,599 lines, 100+ public methods) into a lean facade that exposes the core and lets consumers access subsystems directly.

**Problem:** `system.ts` has 58 thin wrapper methods that do nothing but forward to subsystem managers. This makes the class enormous, hides the real API, and forces every subsystem change to ripple through `system.ts`.

**Work:**

### Phase 3A: Expose subsystems as public properties

Change from wrapper methods to direct subsystem access:

```typescript
// BEFORE (58 wrapper methods like this):
triggerEmergencyOverride(reason: string) {
  return this.emergencyOverrideManager.triggerOverride(reason);
}

// AFTER (expose the manager directly):
class LearningContractsSystem {
  readonly sessions: SessionManager;
  readonly expiry: TimeboundExpiryManager;
  readonly emergencyOverride: EmergencyOverrideManager;
  readonly users: UserManager;
  readonly permissions: PermissionManager;
  readonly plainLanguage: PlainLanguageInterface; // new facade
}

// Consumer usage:
lcs.sessions.start(userId);
lcs.emergencyOverride.trigger(reason);
lcs.users.connect(userId, userName);
```

### Phase 3B: Remove wrapper methods

| Subsystem | Wrapper Methods to Remove | Lines Saved |
|-----------|--------------------------|-------------|
| Emergency Override | 7 methods | ~50 |
| Session Management | 13 methods | ~100 |
| Timebound Expiry | 12 methods | ~90 |
| User Management | 17 methods (16 thin + 1 with logic) | ~130 |
| Plain Language | 9 methods (8 thin + 1 with logic) | ~80 |
| **Total** | **58 methods** | **~450 lines** |

### Phase 3C: Keep only core methods on system.ts

Methods that should STAY on `LearningContractsSystem` (they contain real orchestration logic, not just forwarding):

- `createContract()` - coordinates factory + lifecycle + audit + storage
- `activateContract()` - coordinates lifecycle transition + audit
- `revokeContract()` - coordinates lifecycle + forgetting + audit
- `amendContract()` - coordinates lifecycle + new draft + audit
- `enforceMemoryCreation()` / `enforceAbstraction()` / `enforceRecall()` / `enforceExport()` - the four enforcement hooks
- `getContract()` / `findContracts()` / `getAuditLog()` - core queries
- `createContractEnforcedVault()` / `createBoundaryEnforcedSystem()` - factory methods

**Target:** `system.ts` drops from ~1,599 lines to ~600-700 lines. The class becomes a clean orchestrator of contract lifecycle + enforcement, not a facade for every subsystem.

### Phase 3D: Update tests

- Update `tests/system.test.ts` to use new subsystem access patterns
- Update `tests/session.test.ts`, `tests/emergency-override.test.ts`, etc. to test subsystems directly instead of through system wrappers

**Exit criteria:** `system.ts` is under 700 lines. No thin wrapper methods remain. All subsystems are accessible as public readonly properties. All tests pass.

---

## PHASE 4: PUBLIC API CLEANUP

**Goal:** Make `src/index.ts` export a clean, intentional API surface instead of a dump of everything.

**Work:**

### Phase 4A: Move mocks to a testing export

| Task | Detail |
|------|--------|
| Create `src/testing/index.ts` | Export all `Mock*` classes from here |
| Add package.json exports field | `"./testing": "./dist/testing/index.ts"` |
| Remove from `src/index.ts` | `MockMemoryVaultAdapter`, `MockBoundaryDaemonAdapter` |

### Phase 4B: Remove redundant type aliases

| Problem | Fix |
|---------|-----|
| `DaemonBoundaryMode as RealDaemonBoundaryMode` (line 359) | Already deleted in Phase 1C |
| `ContractResolver as BoundaryContractResolver` (line 164) | Use a single canonical name |
| `AuditLogger as VaultAuditLogger` (line 118) | Use a single canonical name |
| Multiple `ContractEvent`, `EnforcementEvent` aliases | Consolidate or namespace |

### Phase 4C: Organize exports by concern

Structure `src/index.ts` into clear sections:
1. Core (system, contracts, enforcement, audit, storage, types)
2. Extensions (session, expiry, emergency-override, user-management)
3. Integrations (vault, boundary - if kept)

### Phase 4D: Add explicit `@public` / `@internal` JSDoc tags

Mark every exported class/type as `@public` (intended API) or `@internal` (subject to change). This sets expectations for consumers.

**Exit criteria:** `src/index.ts` is under 150 lines. Zero `Mock*` classes in the main export. No aliased re-exports. Clear sectioned organization.

---

## PHASE 5: DEFER INTEGRATIONS TO SEPARATE PACKAGES

**Goal:** Extract vault-integration and boundary-integration into optional plugin packages. They're well-designed but premature in the core.

**Why last:** These modules are architecturally sound (factory pattern, adapter interfaces, on-demand instantiation). They're not hurting anything. But they add 3,403 lines and 2 test suites to a library whose core is only 2,771 lines. Extracting them makes the core package lean.

### Phase 5A: Extract vault-integration

| Task | Detail |
|------|--------|
| Create `packages/vault-adapter/` | New package: `@learning-contracts/vault-adapter` |
| Move | `src/vault-integration/` -> `packages/vault-adapter/src/` |
| Move | `tests/vault-integration.test.ts` -> `packages/vault-adapter/tests/` |
| Add peer dependency | `"learning-contracts": "^0.1.0"` |
| Update `src/system.ts` | Remove `createContractEnforcedVault()` factory method, or make it accept the vault class as a parameter |
| Remove exports | Lines 78-119 from `src/index.ts` |

### Phase 5B: Extract boundary-integration

| Task | Detail |
|------|--------|
| Create `packages/boundary-adapter/` | New package: `@learning-contracts/boundary-adapter` |
| Move | `src/boundary-integration/` -> `packages/boundary-adapter/src/` |
| Move | `tests/boundary-integration.test.ts` -> `packages/boundary-adapter/tests/` |
| Add peer dependency | `"learning-contracts": "^0.1.0"` |
| Update `src/system.ts` | Remove `createBoundaryEnforcedSystem()` factory method |
| Remove exports | Lines 121-165 from `src/index.ts` |

### Phase 5C: Monorepo setup (if extracting)

| Task | Detail |
|------|--------|
| Add workspaces | `package.json` workspaces field pointing to `packages/*` |
| Add `packages/` to `.gitignore` build artifacts | Ensure `dist/` in each package is ignored |
| Update CI | Build and test each package independently |

**Exit criteria:** Core package is under 6,000 total lines (source + tests). Vault and boundary adapters are independent packages with their own tests, builds, and changelogs. Core package has zero dependency on external system adapters.

---

## PHASE SUMMARY

| Phase | Goal | Lines Removed | Lines Added | Net Change |
|-------|------|--------------|-------------|------------|
| **0** | Fix tests | 0 | ~5 | +5 |
| **1** | Delete orphaned modules | ~3,517 | ~20 (changelog) | -3,497 |
| **2** | Harden core tests | 0 | ~1,500 (new tests) | +1,500 |
| **3** | Decompose god class | ~450 | ~50 (property declarations) | -400 |
| **4** | Clean public API | ~100 | ~60 (testing export) | -40 |
| **5** | Extract integrations | ~3,403 (from core) | ~200 (package configs) | -3,203 (from core) |

**End state after all phases:**
- Core package: ~5,500 lines (source + tests)
- 5 focused modules: contracts, enforcement, audit, storage, types
- 4 extension modules: session, expiry, emergency-override, user-management
- 2 optional packages: `@learning-contracts/vault-adapter`, `@learning-contracts/boundary-adapter`
- 90%+ test coverage on core
- Clean, documented public API
- A library that does one thing well

---

## DECISION LOG

Decisions that should be made BEFORE starting each phase:

| Phase | Decision Needed |
|-------|----------------|
| **1** | Archive deleted code to a `legacy/` branch, or just delete? Recommendation: delete. Git history preserves it. |
| **2** | Target coverage: 90% or 95%? Recommendation: 90% statements, 85% branches. |
| **3** | Breaking API change acceptable? Recommendation: yes. Zero users in alpha. |
| **4** | Should mocks be a separate npm package or a subpath export? Recommendation: subpath (`learning-contracts/testing`). |
| **5** | Monorepo or separate repos? Recommendation: monorepo with npm workspaces. Easier to develop, single CI. |
| **All** | Should plain-language module stay in core or be extracted? Recommendation: keep for now (it's a differentiator), but flag for extraction if the core grows. |
