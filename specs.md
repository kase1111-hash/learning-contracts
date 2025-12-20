Learning Contracts Specification (Revised)
1. Purpose
Learning Contracts define explicit, enforceable agreements that govern what a learning co-worker/assistant is allowed to learn from interactions with you, how (or if) it may generalize that learning, how long it may retain it, and under what conditions it may be recalled or revoked.
If the Memory Vault is secure storage and the Boundary Daemon defines trusted space, then Learning Contracts are explicit consent for cognition.
Nothing is learned by default.
2. Design Principles

Explicit Consent – All learning requires an affirmative, human-approved contract.
Scope Before Storage – Permissions must be clearly defined and approved before any memory is created.
Revocability – Forgetting is a first-class, easy-to-use operation.
Non-Emergence by Default – No silent or automatic generalization is ever allowed.
Human Supremacy – The human owner can override, amend, or nullify any contract at any time.
Composable with Security – Contracts seamlessly stack with the Memory Vault and Boundary Daemon.

3. Contract Lifecycle
textDraft → Review → Activate → Enforce → Expire | Revoke | Amend
All lifecycle transitions are permanently logged in an irreversible audit history.
4. Contract Types
4.1 Observation Contract

May passively observe interactions
May NOT store any memory
May NOT generalize

4.2 Episodic Learning Contract

May store specific, individual episodes or events
No cross-context or cross-episode generalization allowed

4.3 Procedural Learning Contract

May derive reusable heuristics or patterns
Always limited to the approved scope

4.4 Strategic Learning Contract

May infer longer-term strategies
Requires a high-trust boundary mode

4.5 Prohibited Domain Contract

Explicitly forbids all learning in a specified domain or context
Overrides any other contract

5. Learning Scope Dimensions
Every contract clearly defines its boundaries across these dimensions (examples provided):

Domain – e.g., programming, gaming, finance, personal life
Temporal – e.g., this session only, time-bound (30 days), permanent until revoked
Contextual – e.g., specific project, live streaming, particular toolchains
Abstraction Level – e.g., raw data only, simple patterns, reusable heuristics, full strategies
Transferability – whether knowledge may ever leave this system (almost always “no”)

Any dimension left unspecified defaults to deny.
6. Contract Creation and Representation
Contracts are created and managed entirely in plain, human-readable language.

Users describe their intent conversationally (spoken or typed).
An LLM translates the user’s plain-language instructions into precise internal rules.
The underlying technical schema (JSON-like structure) exists only in the background and is never exposed to the user unless explicitly requested for audit purposes.
At every step (draft, review, activation), the system presents the contract back to the user as a clear, concise plain-language summary.

Example plain-language presentation:
“You allow the assistant to learn and reuse coding best practices from your Python sessions in personal projects using VS Code. These tips will be stored permanently and applied automatically in similar future sessions. Nothing will be shared outside this system. You can revoke this contract at any time.”
7. Enforcement Points
Contracts are strictly enforced at four mandatory checkpoints:

Before Memory Creation – permission and scope check
During Abstraction – generalization gate (blocks if not allowed)
Before Recall – scope and rules revalidation
During Export or Transfer – prohibition of unauthorized sharing

Any violation triggers an immediate hard failure (no learning occurs, no warning-only mode).
8. Default Rules (Fail-Closed)

No active contract → no learning permitted
Ambiguous scope → deny learning
Expired contract → associated memories are automatically frozen
Revoked contract → associated memories are tombstoned (marked inaccessible)

9. Revocation & Forgetting
Revocation never deletes audit traces or lifecycle logs.
Immediate effects of revocation:

Existing memories marked inaccessible
Any derived memories quarantined
Learned heuristics invalidated

Optional deep purge (permanent deletion) requires a deliberate owner confirmation ceremony.
10. Interaction with Memory Vault

Every stored Memory Object carries the ID of its governing contract
Memory classification cannot exceed the contract’s allowed cap
The Vault refuses to write any memory without a valid, active contract

11. Interaction with Boundary Daemon

Higher-level contract types (e.g., Strategic) require a minimum boundary trust mode
Downgrading the boundary automatically suspends learning under affected contracts

Example:
Strategic Learning contracts require “Trusted” or higher boundary mode.
12. Threat Model





























ThreatMitigationSilent over-learningExplicit abstraction caps & plain-language reviewConcept driftTime-bound contracts & expirationKnowledge launderingStrict non-transferable defaultsModel curiosityObservation-only contracts availableOwner over-sharingClear plain-language summaries & confirmation requirements
13. Human UX Requirements

All contracts must be presented and editable in clear, plain language
Every change (creation, amendment, revocation) requires explicit human confirmation
All active contracts are continuously visible in the interface
No dark patterns, no pre-checked boxes, no implicit or assumed consent

14. Non-Goals

Autonomous contract creation by the assistant
Self-expanding or auto-renewing permissions
Retroactive consent for past interactions

15. Design Constraint
Learning without explicit consent is surveillance.
Intelligence without clear restraint is theft.
Learning Contracts exist to prevent both—by making consent simple, transparent, and always under human control.
