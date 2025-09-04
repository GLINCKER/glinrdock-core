# GLINRDOCK Documentation System v1

## Scope

**In Scope:**
- Internal documentation system integrated with existing FTS5 search
- Organized docs structure within `/docs` folder for offline access
- Migration of existing documentation to structured hierarchy
- Searchable documentation through existing API endpoints
- Minimal dependencies using current tech stack
- Documentation manifest for programmatic access
- Clean table of contents and navigation

**Out of Scope:**
- External documentation hosting or generators (Hugo, GitBook, etc.)
- New dependencies or frameworks
- Rich markdown rendering beyond basic HTML
- Real-time collaborative editing
- Documentation versioning system
- Advanced search features beyond existing FTS5 capabilities

## Milestones

### Milestone 1: Structure & Organization (Current)
- [x] Create PLAN.md with scope and acceptance criteria
- [ ] Create new `/docs` folder structure with README files
- [ ] Move existing documentation files to appropriate folders
- [ ] Update main README.md to reference new docs location
- [ ] Fix relative links and validate file paths

### Milestone 2: App Help Integration
- [ ] Implement backend API for app help (Phase 1)
- [ ] Integrate help documents into FTS5 search system (Phase 2) 
- [ ] Create frontend help viewer with lazy loading (Phase 3)
- [ ] Complete search UI integration (Phase 4)

### Milestone 3: Enhancement & Polish  
- [ ] Add advanced help features and analytics (Phase 5)
- [ ] Implement basic markdown rendering for engineering docs
- [ ] Add documentation health checks
- [ ] Create docs contribution guidelines

**Detailed Implementation Plan**: See [APP_HELP_INTEGRATION.md](./plans/APP_HELP_INTEGRATION.md)

## Acceptance Criteria

**Structure Requirements:**
- PLAN.md exists at repo root with clear scope and next steps
- `/docs/README.md` provides clean table of contents organized by section
- All existing markdown files moved to appropriate folders
- No broken git paths for referenced images or links
- Main README.md documentation section updated to point to `/docs`

**Functionality Requirements:**
- Build and tests continue to pass after reorganization
- All relative links within documentation are functional
- Documentation structure is logical and discoverable
- Files are properly categorized by purpose and audience

**Future-Ready Requirements:**
- Structure supports future external docs generation
- Organization scales for additional documentation types
- Search integration path is clear and minimal

## Immediate Next Steps Checklist

### 1. Structure Setup
- [ ] Create `/docs` folder with all required subdirectories
- [ ] Write `/docs/README.md` with comprehensive table of contents
- [ ] Create individual README files for each section

### 2. File Migration
- [ ] Move existing docs to appropriate folders based on content type
- [ ] Handle duplicate/overlapping filenames with canonical redirects
- [ ] Update internal cross-references between docs

### 3. Quality Assurance
- [ ] Verify all links work correctly
- [ ] Test build process remains functional
- [ ] Validate documentation accessibility

### 5. Launch Preparation
- [ ] Update main README.md documentation section
- [ ] Test backend startup with new structure
- [ ] Verify search functionality baseline