# Branch Protection Configuration

This document outlines the required branch protection rules to maintain code quality and enforce the CI/CD pipeline discipline for the Foundation TypeScript Monorepo.

## 🛡️ Required Branch Protection Rules

### Main Branch Protection

Configure the following settings for the `main` branch in your GitHub repository settings:

#### General Settings

- **Restrict pushes that create files** ✅
- **Require a pull request before merging** ✅
- **Require approvals: 1** (minimum, adjust based on team size)
- **Dismiss stale PR approvals when new commits are pushed** ✅
- **Require review from code owners** ✅ (if CODEOWNERS file exists)

#### Status Checks

**Require status checks to pass before merging** ✅

Required status checks:

- `ci-pipeline` (from CI workflow)
- `TypeScript typecheck`
- `Lint`
- `Unit tests`
- `Acceptance tests`
- `Static analysis`

**Require branches to be up to date before merging** ✅

#### Additional Restrictions

- **Restrict pushes that create files** ✅
- **Do not allow bypassing the above settings** ✅
- **Allow force pushes: Everyone** ❌ (disabled)
- **Allow deletions** ❌ (disabled)

### Develop Branch Protection (if applicable)

Similar rules as main, but potentially with:

- Reduced approval requirements (0-1 approvals)
- Allow administrators to bypass

## 🔧 GitHub CLI Configuration

You can set up branch protection using GitHub CLI:

```bash
# Install GitHub CLI if not already installed
# brew install gh (macOS)
# gh auth login

# Configure main branch protection
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["ci-pipeline"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null

# Verify protection is set
gh api repos/:owner/:repo/branches/main/protection
```

## 🏗️ Setup Instructions

### 1. Navigate to Repository Settings

1. Go to your GitHub repository
2. Click **Settings** tab
3. Select **Branches** from the left sidebar

### 2. Add Branch Protection Rule

1. Click **Add rule**
2. Enter branch name pattern: `main`
3. Configure settings as outlined above

### 3. Required Status Checks Setup

Ensure your CI workflow names match the status checks:

```yaml
# .github/workflows/ci.yml
name: CI

jobs:
  ci-pipeline: # This becomes the status check name
    name: CI Pipeline
    # ... rest of configuration
```

### 4. Verification

After setting up branch protection:

1. Try to push directly to main (should be blocked)
2. Create a test PR to verify status checks are required
3. Verify approval requirements work

## 📋 CODEOWNERS Configuration

Create a `.github/CODEOWNERS` file to automatically request reviews:

```text
# Global owners
* @team-leads @senior-developers

# Frontend code
packages/app/ @frontend-team

# Backend services
services/ @backend-team

# Infrastructure
docker-compose.yml @devops-team
.github/ @devops-team

# Documentation
docs/ @tech-writers @team-leads

# Security-related files
packages/security/ @security-team
```

## 🚨 Enforcement Guidelines

### For Development Teams

1. **No direct pushes to main** - All changes via pull requests
2. **CI must pass** - All status checks required before merge
3. **Code review required** - At least one approval needed
4. **PR template completion** - Follow the comprehensive checklist
5. **Boy Scout Rule** - Leave code better than you found it

### For Repository Administrators

1. **Regular audit** - Review protection settings monthly
2. **Status check updates** - Keep required checks current with CI pipeline
3. **Bypass documentation** - Document any emergency bypasses
4. **Team training** - Ensure all team members understand the workflow

## 🔄 Emergency Procedures

### Hotfix Process

For critical production issues:

1. **Create hotfix branch** from main
2. **Make minimal fix** - Focus only on the critical issue
3. **Fast-track PR** - Expedited review process
4. **Post-hotfix follow-up** - Create issue for proper fix

### Bypass Procedures

If admin bypass is necessary:

1. **Document the reason** - Create issue explaining bypass
2. **Notify team** - Announce in team channels
3. **Schedule follow-up** - Plan to fix underlying issue
4. **Review protection** - Ensure rules still appropriate

## 📊 Monitoring and Metrics

Track the following metrics to ensure protection effectiveness:

- **Direct push attempts** - Should be zero
- **Failed PR status checks** - Track common failure reasons
- **Review turnaround time** - Monitor for bottlenecks
- **Bypass frequency** - Should be rare and documented

## 🎯 Success Criteria

Branch protection is working effectively when:

- ✅ Zero direct pushes to main branch
- ✅ All PRs pass CI before merge
- ✅ Code review participation is high
- ✅ Static analysis delta tracking is consistent
- ✅ Team follows Boy Scout Rule practices
- ✅ Documentation stays current with changes

## 🔧 Troubleshooting

### Common Issues

**Status checks not appearing:**

- Verify workflow names match required checks
- Ensure workflows run on pull requests
- Check workflow permissions

**Cannot merge despite passing checks:**

- Verify branch is up to date
- Check if new commits reset approvals
- Confirm all required checks completed

**Admins can't bypass protection:**

- Check "Do not allow bypassing" setting
- Verify admin permissions
- Review organization-level restrictions

---

**Last Updated:** {{date}}
**Maintained By:** DevOps Team
**Review Schedule:** Monthly
