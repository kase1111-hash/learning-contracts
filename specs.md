Learning Contracts Specification
1. Purpose

Learning Contracts define explicit, enforceable agreements governing what a learning co-worker/assistant is allowed to learn, how it may generalize that learning, how long it may retain it, and under what conditions it may be recalled or revoked.

If the Memory Vault is storage and the Boundary Daemon is space, Learning Contracts are consent for cognition.

Nothing is learned by default.

2. Design Principles

Explicit Consent – Learning requires an affirmative contract.

Scope Before Storage – Permissions are bound before memory creation.

Revocability – Forgetting is a first-class operation.

Non-Emergence by Default – No silent generalization.

Human Supremacy – The owner can override or nullify any contract.

Composable with Security – Contracts stack with Vault + Boundary.

3. Contract Lifecycle
Draft → Review → Activate → Enforce → Expire | Revoke | Amend

All transitions are logged and irreversible in audit history.

4. Contract Types
4.1 Observation Contract

May observe signals

May NOT store memory

May NOT generalize

4.2 Episodic Learning Contract

May store specific episodes

No cross-context generalization

4.3 Procedural Learning Contract

May derive reusable heuristics

Scope-limited

4.4 Strategic Learning Contract

May infer long-term strategies

Requires high-trust boundary mode

4.5 Prohibited Domain Contract

Explicitly forbids learning

Overrides all other contracts

5. Learning Scope Dimensions

Each contract defines its scope across dimensions:

Dimension	Examples
Domain	Finance, design, personal
Temporal	Session-only, time-bound
Contextual	Project, toolchain
Abstraction	Raw data → heuristic
Transferability	This system only

Unspecified dimensions default to deny.

6. Core Contract Schema
{
  "contract_id": "uuid",
  "created_at": "timestamp",
  "created_by": "human",
  "contract_type": "observation|episodic|procedural|strategic|prohibited",
  "scope": {
    "domains": ["string"],
    "contexts": ["string"],
    "tools": ["string"],
    "max_abstraction": "raw|pattern|heuristic|strategy",
    "transferable": false
  },
  "memory_permissions": {
    "may_store": true,
    "classification_cap": 3,
    "retention": "session|timebound|permanent"
  },
  "generalization_rules": {
    "allowed": false,
    "conditions": []
  },
  "recall_rules": {
    "requires_owner": true,
    "boundary_mode_min": "trusted"
  },
  "expiration": "timestamp|null",
  "revocable": true
}
7. Enforcement Points

Learning Contracts are enforced at four mandatory hooks:

Before Memory Creation – permission check

During Abstraction – generalization gate

Before Recall – scope revalidation

During Export – transfer prohibition

Violation results in hard failure, not warning.

8. Default Rules (Fail-Closed)

No contract → no learning

Ambiguous scope → deny

Expired contract → freeze memory

Revoked contract → tombstone memory

9. Revocation & Forgetting

Revocation does NOT delete audit traces.

Effects

Memory marked inaccessible

Derived memories quarantined

Heuristics invalidated

Optional deep purge requires owner ceremony.

10. Interaction with Memory Vault

Contract ID is stored in every Memory Object

Classification may not exceed contract cap

Vault refuses writes without valid contract

11. Interaction with Boundary Daemon

Certain contract types require minimum boundary modes

Boundary downgrade suspends learning

Example:

Strategic Learning → requires Trusted or higher
12. Threat Model
Threats

Silent over-learning

Concept drift

Knowledge laundering

Model curiosity

Owner over-sharing

Mitigations
Threat	Mitigation
Over-generalization	Abstraction caps
Drift	Contract expiration
Leakage	Non-transferable flag
Curiosity	Observation-only contracts
13. Human UX Requirements

Contracts must be readable in plain language

Changes require confirmation

Active contracts visible at all times

No dark patterns. No implicit consent.

14. Non-Goals

Autonomous contract creation

Self-expanding permissions

Retroactive consent

15. Design Constraint

Learning without consent is surveillance. Intelligence without restraint is theft.

Learning Contracts exist to prevent both.
