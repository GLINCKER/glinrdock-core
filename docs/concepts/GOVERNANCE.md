# Project Governance

## Roles and Responsibilities

### Maintainer
- **Scope**: Full repository access and decision authority
- **Duties**: 
  - Review and merge pull requests
  - Define project direction and roadmap
  - Manage releases and versioning
  - Enforce code quality standards
  - Handle security issues

### Reviewer  
- **Scope**: Code review privileges without merge rights
- **Duties**:
  - Review pull requests for quality and correctness
  - Provide constructive feedback
  - Ensure adherence to coding standards
  - Validate test coverage and documentation

### Contributor
- **Scope**: Submit pull requests and participate in discussions
- **Duties**:
  - Follow contributing guidelines
  - Write tests for new features
  - Document changes appropriately
  - Respond to review feedback promptly

## Decision Making Process

### Lightweight RFC Process

For significant changes, create an RFC in `docs/rfcs/`:

1. **Create**: Copy `RFC_TEMPLATE.md` to `docs/rfcs/YYYY-MM-DD-title.md`
2. **Discuss**: Open pull request for review and feedback
3. **Decide**: Maintainers approve/reject within 1 week
4. **Implement**: Create implementation pull request referencing RFC

### What Requires an RFC

- **Architecture Changes**: New major components or redesigns
- **API Changes**: Breaking changes to public APIs  
- **Security Changes**: Authentication, authorization, or data handling
- **Dependencies**: Adding significant new dependencies
- **Performance**: Changes affecting performance budgets

### What Doesn't Require an RFC

- Bug fixes and small improvements
- Documentation updates
- Test additions
- Refactoring without behavior changes
- Configuration changes

## Review Standards

### Code Review Requirements
- **Minimum**: 1 reviewer approval required
- **Security**: 2 reviewers for security-related changes
- **Breaking**: 2 maintainer approvals for breaking changes
- **Timeframe**: Reviews within 48 hours (business days)

### Merge Criteria
- [ ] All CI checks passing
- [ ] Required approvals obtained  
- [ ] Conventional commit format followed
- [ ] Documentation updated if needed
- [ ] Tests added for new functionality

## Release Process

### Version Numbering
- **Semantic Versioning**: MAJOR.MINOR.PATCH
- **Pre-releases**: Use `-alpha`, `-beta`, `-rc` suffixes
- **Development**: Use `-dev` suffix

### Release Checklist
1. Update CHANGELOG.md with user-facing changes
2. Run full audit checklist (`docs/AUDIT_CHECKLIST.md`)
3. Tag release with `git tag vX.Y.Z`
4. Build and test release binaries
5. Create GitHub release with release notes
6. Update documentation if needed

## Communication

### Channels
- **Issues**: Bug reports and feature requests
- **Discussions**: Design discussions and questions  
- **Pull Requests**: Code review and implementation
- **Security**: Email security@glincker.dev for vulnerabilities

### Response Times
- **Security Issues**: 24 hours initial response
- **Bug Reports**: 48 hours acknowledgment
- **Feature Requests**: 1 week initial review
- **Pull Requests**: 48 hours for initial review