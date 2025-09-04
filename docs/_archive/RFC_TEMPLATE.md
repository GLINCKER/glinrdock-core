# RFC: [Title]

- **Date**: YYYY-MM-DD
- **Author**: [Your Name]
- **Status**: Draft | Under Review | Accepted | Rejected | Implemented

## Context

Brief description of the problem or opportunity this RFC addresses.

## Goals

- Primary objective 1
- Primary objective 2  
- Primary objective 3

## Non-Goals

- Explicitly out of scope item 1
- Explicitly out of scope item 2

## Design

### Overview
High-level approach and key design decisions.

### Detailed Design
```
Code examples, API designs, data structures, etc.
```

### API Changes
```go
// New or modified API signatures
func NewFunction(param string) (*Result, error) {
    // implementation
}
```

### Data Model Changes
```sql
-- Database schema changes if applicable
CREATE TABLE new_table (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);
```

## Risks and Mitigations

### Risk 1: [Description]
**Likelihood**: Low | Medium | High  
**Impact**: Low | Medium | High  
**Mitigation**: How we'll address this risk

### Risk 2: [Description]  
**Likelihood**: Low | Medium | High
**Impact**: Low | Medium | High
**Mitigation**: How we'll address this risk

## Testing Plan

### Unit Tests
- Test scenario 1
- Test scenario 2

### Integration Tests  
- Integration scenario 1
- Integration scenario 2

### Performance Tests
- Performance requirement 1
- Performance requirement 2

## Rollout Plan

### Phase 1: Foundation
- [ ] Task 1
- [ ] Task 2

### Phase 2: Implementation
- [ ] Task 3  
- [ ] Task 4

### Phase 3: Validation
- [ ] Task 5
- [ ] Task 6

## Alternatives Considered

### Alternative 1: [Name]
**Pros**: Benefits of this approach  
**Cons**: Drawbacks of this approach  
**Decision**: Why we chose not to pursue this

### Alternative 2: [Name]
**Pros**: Benefits of this approach
**Cons**: Drawbacks of this approach
**Decision**: Why we chose not to pursue this

## Open Questions

- [ ] Question 1 that needs resolution
- [ ] Question 2 that needs resolution

## References

- [Link 1](url): Description
- [Link 2](url): Description