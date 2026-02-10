# READINESS PLAN: Preparing Learning Contracts for Real-World Adoption

**Goal:** Transform this library from an internally coherent alpha into a package that an AI agent developer can `npm install`, wire into their agent's memory layer, and have working contract-based learning governance in under an hour.

**Guiding principle:** Every phase must produce a shippable state. No phase depends on systems that don't exist. No speculative infrastructure.

---

## PHASE 1: FIX WHAT'S BROKEN

**Goal:** A developer can clone, install, build, lint, and test on the first try.

### 1A: Fix monorepo dependency resolution

The workspace packages (`packages/vault-adapter/`, `packages/boundary-adapter/`) declare `learning-contracts@^0.1.0` as a peer dependency pointing at npm (where it doesn't exist). `npm ci` fails with E404 on a fresh clone.

| Task | Detail |
|------|--------|
| Fix peer dependency resolution | Change workspace package peer deps to use the local root package. Add `"learning-contracts": "workspace:*"` or switch to `"file:.."` reference. Alternatively, mark peer deps as optional with `peerDependenciesMeta` |
| Verify `npm ci` works | Fresh clone → `npm ci` → no errors |
| Verify `npm install` works | Fresh clone → `npm install` → no errors |

**Exit criteria:** `git clone && npm ci && npm test && npm run build` succeeds on a clean machine.

### 1B: Fix the 35 ESLint errors

The `createXContract()` helpers and `deepPurge()` use `any` types for parameters that flow into security-critical operations.

| Task | Detail |
|------|--------|
| Type `scope` parameter | Replace `any` with `Partial<LearningScope>` on `createObservationContract`, `createEpisodicContract`, `createProceduralContract`, `createStrategicContract`, `createProhibitedContract` in `src/system.ts:279-313` |
| Type `options` parameter | Replace `any` with typed options objects (e.g., `{ classificationCap?: number; retention?: RetentionDuration; retentionUntil?: Date }`) |
| Type `ownerConfirmation` in `deepPurge` | Replace `any` at `src/system.ts:503` with `{ owner: string; confirmation_token: string; timestamp: Date }` |
| Fix unsafe enum comparisons | `src/system.ts:586,599` — use typed enum values instead of string comparison |
| Fix remaining `@typescript-eslint/no-unsafe-argument` errors | Ensure all arguments passed to typed functions match their declared types |

**Exit criteria:** `npx eslint src` reports 0 errors.

### 1C: Wire structured errors into the core

`src/system.ts` throws plain `Error('Contract not found')` at 10+ locations while 829 lines of structured error infrastructure (`src/errors/`) goes unused.

| Task | Detail |
|------|--------|
| Replace `throw new Error('Contract not found')` | Use `throw new ContractError('Contract not found', ErrorCode.CONTRACT_NOT_FOUND, { contract_id: contractId })` throughout `src/system.ts` |
| Replace `throw new Error('Rate limit exceeded...')` | Use structured error with `ErrorCode.SYSTEM_RESOURCE_EXHAUSTED` |
| Add error context | Include `contract_id`, `user_id`, and `operation` in all error contexts |
| Update tests | Any tests that catch `Error` need to catch `ContractError` / `LearningContractsError` instead |

**Exit criteria:** `grep -r "throw new Error" src/system.ts` returns 0 matches. All errors thrown by system.ts are structured `LearningContractsError` subclasses.

**Files touched:** `src/system.ts`, possibly test files that assert on error types.

---

## PHASE 2: STABILIZE THE DOCUMENTED API

**Goal:** Everything the README says works, actually works. No phantom methods.

### 2A: Audit README against implementation

The README documents methods that were removed during the refocus (god class decomposition). Several advertised methods no longer exist on `LearningContractsSystem`.

| Task | Detail |
|------|--------|
| Audit every code example in README.md | Compare each method call against actual exports in `src/system.ts` and subsystem interfaces |
| Fix or remove broken examples | If `system.startPlainLanguageConversation()` doesn't exist, update README to show `system.conversations.startConversation(userId)` |
| Fix session management examples | Update to use `system.sessions.startSession()` instead of any removed wrapper |
| Fix vault integration examples | Either document the `ContractEnforcedVault` from `packages/vault-adapter/` directly, or remove vault examples from core README |
| Verify every example compiles | Extract README code blocks and type-check them (can be a test or script) |

### 2B: Write a "Getting Started" section (under 100 lines)

The current README is comprehensive but overwhelming. Add a focused quick-start at the top.

| Task | Detail |
|------|--------|
| Write 5-step quick start | Install → Create system → Create contract → Activate → Enforce memory creation → Check result |
| Include a "What just happened?" explanation | 3-4 sentences explaining the value: "You just created an explicit consent agreement that governs what your AI can learn. Without this contract, all learning operations would be denied." |
| Link to full examples | Point to `examples/basic-usage.ts` for comprehensive scenarios |

### 2C: Trim documentation to what helps adopters

| Task | Detail |
|------|--------|
| Archive internal docs | Move `AUDIT_REPORT.md`, `ENCRYPTION_SECURITY_REVIEW.md`, `REFOCUS_PLAN.md`, `KEYWORDS.md` to `docs/internal/` |
| Keep adopter-facing docs in root | `README.md`, `User-Manual.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE` |
| Update `specs.md` | Ensure it reflects the post-refocus architecture, not the pre-refocus one |

**Exit criteria:** Every code example in README.md compiles. A new developer can read the Getting Started section and have a working system in <5 minutes. Root directory has <8 markdown files.

---

## PHASE 3: BUILD THE INTEGRATION BRIDGE

**Goal:** Define a clear, minimal interface that any AI memory system can implement to get contract-based governance.

This is the critical phase. The library currently has rich internal machinery but no clean path for "I have an AI agent with a memory store — how do I plug learning contracts into it?"

### 3A: Define the `ContractAwareMemoryStore` interface

Create a single adapter interface that represents "a memory store that respects learning contracts." This is the glue between any AI memory system and the contracts library.

| Task | Detail |
|------|--------|
| Create `src/integration/memory-store.ts` | Define the minimal interface an AI memory system must implement |
| Keep it minimal | 4-6 methods: `store()`, `recall()`, `forget()`, `listByContract()` |
| Make enforcement automatic | The wrapper should call enforcement hooks before delegating to the underlying store — consumers shouldn't have to call `checkMemoryCreation()` manually |

```typescript
// What a consumer implements:
interface MemoryStore {
  store(memory: MemoryInput): Promise<StoredMemory>;
  recall(query: RecallQuery): Promise<StoredMemory[]>;
  forget(memoryIds: string[]): Promise<void>;
  list(contractId: string): Promise<StoredMemory[]>;
}

// What the library provides:
class ContractGovernedStore {
  constructor(store: MemoryStore, system: LearningContractsSystem);
  // Same interface as MemoryStore, but enforcement happens automatically
  store(memory: MemoryInput, contractId: string): Promise<GovernedResult<StoredMemory>>;
  recall(query: RecallQuery, contractId: string): Promise<GovernedResult<StoredMemory[]>>;
  // On contract revocation, automatically tombstones associated memories
  // On contract expiry, automatically freezes associated memories
}
```

### 3B: Create middleware / hook pattern for framework integration

Many AI agents use middleware patterns (like LangChain callbacks, or custom pipelines). Provide a way to wire enforcement into these.

| Task | Detail |
|------|--------|
| Create `src/integration/middleware.ts` | Export hook functions that can be called from any middleware framework |
| `createEnforcementMiddleware(system)` | Returns `{ beforeStore, beforeRecall, beforeAbstract, beforeExport }` functions |
| Keep framework-agnostic | Plain functions that take context and return allow/deny — no framework dependency |

### 3C: Create contract discovery helpers

When an AI agent wants to store a memory, it needs to find the applicable contract. Make this easy.

| Task | Detail |
|------|--------|
| Improve `findApplicableContract()` | Support wildcard domains, context hierarchy, tool inheritance |
| Add `getOrDeny(domain, context, tool)` | Single call that finds applicable contract and returns enforcement result — the "one function an agent calls" |
| Handle multiple matching contracts | Define precedence: PROHIBITED > most-specific-scope > most-recent |

**Exit criteria:** A developer with an existing memory store can wrap it in `ContractGovernedStore` and have full contract enforcement with <10 lines of integration code. The library provides a clean middleware pattern for framework integration.

**Files created:** `src/integration/memory-store.ts`, `src/integration/middleware.ts`, `src/integration/index.ts`

---

## PHASE 4: PROVE IT WORKS

**Goal:** One complete, runnable example of an AI agent using learning contracts to govern its memory.

### 4A: Build a self-contained example agent

Create `examples/agent-with-memory/` — a minimal AI agent that:
1. Has an in-memory knowledge store (simple Map-based)
2. Uses learning contracts to govern what it can learn
3. Demonstrates the full lifecycle:
   - User creates a contract allowing the agent to learn coding tips
   - Agent stores a learned tip → allowed
   - Agent tries to store something outside scope → denied
   - User revokes the contract → memories tombstoned
   - Agent tries to recall → denied

| Task | Detail |
|------|--------|
| Create `examples/agent-with-memory/agent.ts` | Simple agent class with `learn()`, `recall()`, `forget()` methods |
| Create `examples/agent-with-memory/memory-store.ts` | Map-based store implementing `MemoryStore` interface |
| Create `examples/agent-with-memory/demo.ts` | Runnable script showing full lifecycle |
| Add `npm run example` script | Runs the demo with `ts-node` or `tsx` |

### 4B: Add integration tests for the bridge

| Task | Detail |
|------|--------|
| Create `tests/integration/memory-store.test.ts` | Test `ContractGovernedStore` with a mock memory store |
| Test enforcement flows | Store allowed, store denied, recall with expired contract, revocation triggers forget |
| Test contract discovery | Multiple contracts, scope matching, PROHIBITED override |
| Test lifecycle integration | Session end freezes memories, timebound expiry freezes memories |

**Exit criteria:** `npm run example` runs and prints a complete demo of contract-governed learning. Integration tests cover the full enforcement loop through the bridge layer.

---

## PHASE 5: SHIP 0.1.0

**Goal:** Publish a stable, documented, installable package.

### 5A: Finalize the package

| Task | Detail |
|------|--------|
| Update version to `0.1.0` | Remove `-alpha` suffix |
| Verify `npm pack --dry-run` | Check package contents, ensure no test files or internal docs leak |
| Verify exports | `import { LearningContractsSystem } from 'learning-contracts'` works from a consuming project |
| Add `exports` field to package.json | Modern Node.js subpath exports for `learning-contracts/integration`, `learning-contracts/errors` |
| Run full CI pipeline | All tests, lint, typecheck, build on Node 18/20/22 |

### 5B: Write migration guide from alpha

| Task | Detail |
|------|--------|
| Document breaking changes | Methods moved to subsystems, removed wrapper methods, new integration interface |
| Provide before/after examples | Show old `system.triggerEmergencyOverride()` → new `system.emergencyOverride.triggerOverride()` |

### 5C: Prepare for npm publish

| Task | Detail |
|------|--------|
| Verify `.npmignore` | Exclude tests, docs, examples, internal configs |
| Add `repository`, `homepage`, `bugs` fields | Already present, verify correctness |
| Test `npm publish --dry-run` | Verify package structure |
| Set up automated publish via CI | GitHub Actions workflow on tag push |

**Exit criteria:** `npm publish` succeeds. A consumer can `npm install learning-contracts` and follow the Getting Started guide to have contract-governed AI memory in <30 minutes.

---

## PHASE SUMMARY

| Phase | Goal | Effort | Produces |
|-------|------|--------|----------|
| **1** | Fix install, lint, errors | Small | A repo that works on first clone |
| **2** | Stabilize documented API | Medium | README that matches reality |
| **3** | Build integration bridge | Medium | Clean path for AI agents to adopt |
| **4** | Prove it works | Medium | Runnable demo + integration tests |
| **5** | Ship 0.1.0 | Small | Published, installable package |

**End state:** A developer building an AI agent with memory can:
1. `npm install learning-contracts`
2. Implement the 4-method `MemoryStore` interface on their existing store
3. Wrap it in `ContractGovernedStore`
4. Create contracts that govern what their agent can learn
5. All enforcement happens automatically — no manual hook calls needed
6. Full audit trail, revocation, expiry, and forgetting come for free

The library is ready for the world when the world arrives.

---

## DECISION LOG

| Phase | Decision Needed |
|-------|----------------|
| **1A** | Use `workspace:*` protocol (requires npm 7+) or `file:..` references for workspace peer deps? Recommendation: `workspace:*` — it's the npm standard for monorepos. |
| **1B** | Fix lint errors by adding types, or by relaxing lint rules? Recommendation: add types — a governance library should be strict about type safety. |
| **3A** | Should `ContractGovernedStore` be synchronous or async? Recommendation: async — real memory stores are always async (DB, network). |
| **3A** | Should the governed store automatically find applicable contracts, or require the caller to pass a contract ID? Recommendation: both — `store(memory, contractId)` for explicit use, `storeWithDiscovery(memory, { domain, context })` for automatic contract lookup. |
| **3B** | Should middleware hooks be synchronous (blocking) or async? Recommendation: synchronous for enforcement (must block), async for audit (can fire-and-forget). |
| **4A** | Use `tsx` or `ts-node` for running examples? Recommendation: `tsx` — faster, no config needed. |
| **5A** | Publish workspace packages alongside root, or defer? Recommendation: defer. Publish `learning-contracts` only. Vault/boundary adapters publish when their target systems exist. |
