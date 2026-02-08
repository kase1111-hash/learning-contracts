# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-alpha] - 2026-01-01

### Added

#### Error Handling Module (`src/errors/`)
- **Structured Error Types** - Comprehensive error handling with SIEM integration
  - 5 severity levels: INFO, LOW, MEDIUM, HIGH, CRITICAL
  - 10 error categories: CONTRACT, ENFORCEMENT, STORAGE, AUTH, NETWORK, SECURITY, etc.
  - 50+ specific error codes for precise error identification
  - Specialized error classes: `ContractError`, `EnforcementError`, `SecurityError`, `StorageError`, `NetworkError`, `IntegrationError`, `AuthError`
- **CentralErrorHandler** - Centralized error handling with automatic SIEM reporting
  - Error buffering and batch reporting
  - Automatic retry with exponential backoff
  - Lockdown triggers on critical security errors
  - Error statistics and aggregation
- **CEF Format Support** - Common Event Format for SIEM ingestion
- **MITRE ATT&CK Technique Tagging** - Security event classification

#### Production Readiness
- **GitHub Actions CI/CD** - Multi-version Node.js testing (18.x, 20.x, 22.x)
- **Dependabot** - Automated dependency updates
- **Test Coverage Thresholds** - Enforced minimum coverage
- **ESLint & Prettier** - Code quality enforcement
- **GitHub Templates** - Issue and PR templates
- **Security Policy** (`SECURITY.md`) - Vulnerability reporting guidelines
- **Contributing Guidelines** (`CONTRIBUTING.md`) - Development workflow
- **Windows Batch Files** - `build.bat` and `start.bat` for Windows users

### Changed
- Version reset to 0.1.0-alpha for first public release
- Updated all module version references to match
- Improved TypeScript strict mode compliance
- Enhanced error messages with actionable remediation suggestions

### Security
- Production guards prevent mock adapters in production environments
- Constant-time comparison for security-sensitive operations
- Secure memory zeroing for sensitive data
- TLS/mTLS support for all external connections

---

## [3.0.0] - 2025-12-23 (Internal)

### Added
- **Memory Vault Integration** - Complete integration with Memory Vault storage system
  - `ContractEnforcedVault` - Wraps vault adapter with contract enforcement
  - `MemoryVaultAdapter` interface - Abstract adapter for vault communication
  - `MockMemoryVaultAdapter` - In-memory adapter for testing
  - TypeScript types matching memory-vault Python package
  - Automatic contract discovery based on domain/context
  - Full enforcement of classification caps and scope restrictions
  - Boundary mode verification for strategic contracts
  - Vault audit logging integrated with main audit system
- New `createContractEnforcedVault()` method on `LearningContractsSystem`
- New test suite for vault integration (28 tests)

### Changed
- Updated main exports to include vault integration components
- Updated README with comprehensive vault integration documentation
- Updated specs.md to version 3.0

## [2.0.0] - 2025-12-23

### Added
- **Plain-Language Interface** - Complete implementation of conversational contract creation
  - `PlainLanguageParser` - Natural language parsing with keyword extraction and intent detection
  - `PlainLanguageSummarizer` - Generate human-readable contract summaries (prose and bullet formats)
  - `ConversationalContractBuilder` - Interactive conversation flow for building contracts
  - 7 contract templates: Coding Best Practices, Gaming/Streaming, Personal Journal, Work Projects, Prohibited Domains, Study Sessions, Strategic Planning
  - System integration via `startPlainLanguageConversation()`, `processConversationInput()`, `getContractSummary()` methods
- New test suite for plain-language interface (35+ tests)

### Changed
- Updated `LearningContractsSystem` with plain-language methods
- Updated main exports to include plain-language components
- Fixed episodic contract factory to provide default retention_until date for timebound contracts

## [1.2.0] - 2025-12-23

### Added
- Documented heuristics invalidation feature in implementation status
- Documented manual contract expiration triggering in implementation status

### Changed
- Clarified timebound auto-expiry description (manual trigger exists, automatic background not yet implemented)
- Updated specs.md to version 1.2

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
