# Security Policy

## Supported Versions

| Version       | Supported          |
| ------------- | ------------------ |
| 0.1.x (alpha) | :white_check_mark: |

> **Note**: This project is currently in alpha (0.1.0-alpha). As it matures, older versions may be deprecated. We recommend always using the latest release.

## Security Architecture

Learning Contracts implements a **delegated encryption architecture** where:

- **Policy Enforcement**: TypeScript layer manages contract rules, scope validation, and audit logging
- **Cryptographic Operations**: Delegated to external systems (Memory Vault, Agent-OS)
- **Fail-Closed Design**: No operation proceeds without explicit consent

### Security Features

- **SHA-256 Content Hashing**: Cryptographic integrity verification
- **File Integrity Verification**: Checksums on stored contract files
- **Constant-Time Comparison**: Timing attack prevention
- **Secure Memory Handling**: Zeroing utilities for sensitive data
- **Production Guards**: Mock adapters blocked in production environments
- **Comprehensive Audit Logging**: Immutable operation history
- **Classification-Based Access Control**: 6-level security classification

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow responsible disclosure:

### Do NOT

- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it's fixed
- Exploit the vulnerability for any purpose

### Do

1. **Email**: Send details to the repository maintainers via GitHub private contact
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 24-72 hours
  - High: 1-2 weeks
  - Medium: 2-4 weeks
  - Low: Next release cycle

### What to Expect

1. Confirmation that your report was received
2. Assessment of the vulnerability's severity
3. Timeline for a fix
4. Credit in the security advisory (unless you prefer anonymity)

## Security Best Practices for Users

### Production Deployment

1. **Never use Mock adapters in production**
   - `MockMemoryVaultAdapter` will throw an error in `NODE_ENV=production`
   - Always implement production adapters

2. **Secure contract storage files**
   - Files are created with `0o600` permissions (owner read/write only)
   - Store in a secure location with appropriate access controls

3. **Enable audit logging**
   - All operations are logged by default
   - Store audit logs securely and monitor for anomalies

4. **Implement proper key management**
   - Memory Vault encryption keys should follow industry best practices
   - Use hardware security modules (HSM) when possible

5. **Network security**
   - Use TLS/mTLS for vault communication
   - Implement proper authentication and authorization

### Development

1. Run `npm audit` regularly to check for vulnerable dependencies
2. Keep dependencies up to date
3. Review all contract changes before activation
4. Test with security scanning tools

## Known Limitations

1. **JavaScript Memory**: Plaintext content in memory cannot be fully protected from memory dumps
2. **Trust Model**: TypeScript layer trusts the Memory Vault for encryption correctness
3. **Audit Log Integrity**: Logs are append-only but not cryptographically signed

## Security Audit History

| Date | Type | Rating | Notes |
|------|------|--------|-------|
| 2025-12-29 | Internal Review | A (Excellent) | All critical/high issues resolved |

See [ENCRYPTION_SECURITY_REVIEW.md](ENCRYPTION_SECURITY_REVIEW.md) for the full security audit report.
