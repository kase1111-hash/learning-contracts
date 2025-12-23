# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-12-23

### Changed
- Consolidated specification document with comprehensive implementation status
- Restructured specs.md with table of contents and improved formatting
- Cleaned up README.md by removing misplaced blockchain/ComplianceCouncil content
- Added clear tables for design principles, scope dimensions, and threat model

### Added
- Implementation Status section in specs.md documenting:
  - 13 fully implemented features with file locations
  - 10 unimplemented features with priority levels
- State transition table for contract lifecycle
- Related Systems section referencing Agent OS ecosystem
- Forgetting Operations table (Freeze, Tombstone, Deep Purge)

### Documentation
- specs.md now serves as the authoritative specification document
- README.md focused on developer-facing API documentation
- User-Manuel.md remains for end-user plain-language guidance
- system-arch.md provides ecosystem context

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
