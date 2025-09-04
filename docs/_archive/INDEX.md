# Documentation Index

## Core Documentation

- [README](../README.md) - Project overview and quick start
- [API Reference](API.md) - Complete HTTP API documentation
- [Certificate Management](CERTS.md) - HTTPS certificate automation and troubleshooting
- [Metrics](METRICS.md) - Prometheus metrics and monitoring integration
- [DEV_PLAN](DEV_PLAN.md) - Development phases and progress tracking
- [CONTRIBUTING](CONTRIBUTING.md) - Code style and contribution guidelines
- [ARCHITECTURE](ARCHITECTURE.md) - System design and component overview

## Security and Quality

- [SECURITY](SECURITY.md) - Security policy, vulnerability reporting, and hardening
- [THREAT_MODEL](THREAT_MODEL.md) - System risks, trust boundaries, and mitigations
- [CODE_QUALITY](CODE_QUALITY.md) - Coding standards and performance guidelines
- [TESTING](TESTING.md) - Testing conventions and coverage requirements
- [AUDIT_CHECKLIST](AUDIT_CHECKLIST.md) - Pre-release and code review checklists

## Governance

- [GOVERNANCE](GOVERNANCE.md) - Roles, responsibilities, and decision making
- [RFC_TEMPLATE](RFC_TEMPLATE.md) - Template for significant change proposals

## Configuration

- [Example Config](../configs/.env.example) - Environment variable reference

## Guidance for Claude Code

When working on this project:

1. **Always read DEV_PLAN.md first** to understand current phase and progress
2. **Run `make audit` before opening pull requests** - all quality checks must pass
3. **Update checkboxes** in DEV_PLAN.md when implementing features
4. **Keep edits surgical** - avoid large refactors unless explicitly requested
5. **Follow existing patterns** - check similar code before adding new functionality
6. **Maintain performance budget** - keep resource usage minimal
7. **Test thoroughly** - both unit and integration tests for new features
8. **Use structured logging** - follow zerolog patterns in CODE_QUALITY.md
9. **Handle errors properly** - wrap with context using fmt.Errorf