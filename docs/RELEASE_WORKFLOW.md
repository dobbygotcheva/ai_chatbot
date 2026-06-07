# Release Workflow

**Project**: ai_center  
**First Release**: v0.1.0  
**Maintainers**: Main maintainer + 1 reviewer

---

## Branch Strategy

```
feature/*  →  development  →  release/vX.Y.Z  →  main
              (staging)        (review)         (production)
```

### Protected Branches

| Branch | Protection | Push Access | Merge Access |
|--------|-----------|-------------|--------------|
| `main` | ✅ Protected | No direct push | MR + Reviewer approval required |
| `development` | ✅ Protected | Maintainer only | Maintainer only |
| `release/*` | Recommended: Protected | Maintainer only | Maintainer only |

---

## Release Process

### Step 1: Prepare Release Branch

When features are ready for review:

```bash
# Ensure development is current
git checkout development
git pull origin development

# Create release branch
git checkout -b release/v0.1.0
git push -u origin release/v0.1.0
```

### Step 2: Create Merge Request

1. Go to GitLab → New Merge Request
2. **Source branch**: `release/v0.1.0`
3. **Target branch**: `main`
4. **Assign reviewer**: The designated reviewer
5. **Description**: List all features/changes included

Example MR description:
```markdown
## Release v0.1.0 - Initial Release

### Features
- Feature 1
- Feature 2

### Bug Fixes
- Fix 1

### Testing
- [ ] Tested on staging environment
- [ ] All CI checks passing
```

### Step 3: Review Phase

**Reviewer responsibilities:**
- Review all changes in MR
- Test on staging environment
- Request changes if needed

**If changes requested:**
```bash
git checkout release/v0.1.0
# Make fixes
git add .
git commit -m "fix: address review feedback"
git push origin release/v0.1.0
```

MR updates automatically - reviewer gets notified.

### Step 4: After Approval

Once reviewer approves:

1. **Merge MR to main** (via GitLab UI)
   - Use "Merge Commit" or "Fast-Forward"
   - Do NOT delete source branch yet

2. **Create release tag**
```bash
git checkout main
git pull origin main
git tag -a v0.1.0 -m "Release v0.1.0 - Initial release"
git push origin v0.1.0
```

3. **CI/CD triggers**
   - Production deployment starts automatically
   - Monitor deployment in GitLab CI/CD

### Step 5: Sync Development

After production deployment succeeds:

```bash
git checkout development
git fetch origin
git rebase origin/main
git push --force-with-lease origin development
```

⚠️ **Important**: Coordinate with team before rebasing if others are working on `development`

### Step 6: Cleanup

1. Delete release branch (optional)
```bash
git branch -d release/v0.1.0
git push origin --delete release/v0.1.0
```

2. Update release notes/documentation

---

## Hotfix Process

For urgent production fixes:

```bash
# Create hotfix from main
git checkout main
git checkout -b hotfix/fix-name
# Make fix
git commit -m "fix: critical production issue"

# Merge to main
git checkout main
git merge hotfix/fix-name
git push origin main
git tag -a v0.1.1 -m "Hotfix v0.1.1 - fix description"
git push origin v0.1.1

# Sync to development
git checkout development
git merge main
git push origin development
```

---

## Version Numbering

**Semantic Versioning**: `vMAJOR.MINOR.PATCH`

- **v0.1.0** - Initial release (current)
- **v0.2.0** - Next feature release
- **v0.1.1** - Hotfix/patch
- **v1.0.0** - First stable major release

---

## Release Checklist

### Before Creating Release Branch
- [ ] All intended features merged to `development`
- [ ] Staging environment tested
- [ ] No critical bugs open
- [ ] CI pipeline passing on `development`
- [ ] Version number decided

### Before Merging to Main
- [ ] Reviewer approval obtained
- [ ] All review feedback addressed
- [ ] CI pipeline passing on release branch
- [ ] Production deployment plan ready

### After Merging to Main
- [ ] Tag created and pushed
- [ ] Production deployment verified
- [ ] `development` rebased on `main`
- [ ] Release notes updated
- [ ] Stakeholders notified

---

## Quick Reference Commands

| Action | Command |
|--------|---------|
| Create release branch | `git checkout -b release/v0.1.0 development` |
| Push release branch | `git push -u origin release/v0.1.0` |
| Push fixes to release | `git push` (while on release branch) |
| Create tag | `git tag -a v0.1.0 -m "message"` |
| Push tag | `git push origin v0.1.0` |
| Sync development | `git rebase origin/main && git push --force-with-lease` |
| Check all branches | `git branch -a` |
| View recent tags | `git tag -l --sort=-version:refname \| head -10` |

---

## GitLab CI/CD Integration

Current pipeline stages:
1. **Lint** - Code quality checks
2. **Test** - Unit + E2E tests
3. **Build** - Docker image creation
4. **Deploy Staging** - Auto-deploy from `development`
5. **Deploy Production** - Auto-deploy from `main` or tags

**Pipeline triggers:**
- `development` branch → Staging environment
- `main` branch → Production environment
- Tags → Production environment (backup trigger)

---

## Troubleshooting

### Rebase Conflicts
```bash
git checkout development
git fetch origin
git rebase origin/main
# If conflicts:
# 1. Resolve conflicts in files
# 2. git add <resolved-files>
# 3. git rebase --continue
git push --force-with-lease origin development
```

### Force Push Rejected
If `--force-with-lease` is rejected, someone else pushed:
```bash
git fetch origin
git rebase origin/development
git push --force-with-lease
```

### Rollback Production
If production has issues:
```bash
# Revert to previous tag on main
git checkout main
git revert --no-commit v0.1.0..v0.1.1
git commit -m "revert: rollback to v0.1.0"
git push origin main
```
