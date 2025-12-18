# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-18

### Added
- Initial release of Learning Contracts system
- Five contract types: Observation, Episodic, Procedural, Strategic, Prohibited
- Complete contract lifecycle management (Draft → Review → Active → Expired/Revoked/Amended)
- Four mandatory enforcement hooks:
  - Before Memory Creation
  - During Abstraction
  - Before Recall
  - During Export
- Comprehensive scope validation system
- Memory forgetting mechanisms (freeze, tombstone, deep purge)
- Full audit logging for all operations
- Contract storage and retrieval with query capabilities
- TypeScript type definitions
- Comprehensive test suite
- Usage examples
- Complete API documentation

### Design Principles
- Explicit consent required for all learning
- Fail-closed by default (no contract = no learning)
- Revocability as first-class operation
- Human supremacy (owner can override any contract)
- No dark patterns or implicit consent
- All transitions logged and irreversible in audit history
