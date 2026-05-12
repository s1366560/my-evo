# Merge Strategy Analysis and Plan

## Current Repository State

### Branch Relationship Summary

```
HEAD (workspace/node-9e97288fcf22-dafc332b-77d)
  ↑ ahead of origin/master by 12 commits
  ↓ behind origin/main by 25 commits
```

### Key Commits Ahead of origin/master (12 commits)

| # | Commit | Message |
|---|--------|---------|
| 1 | 13e9c889 | Merge commit '90a02ec4' |
| 2 | 2e524c1a | Merge commit '5b6daf2e' |
| 3 | 90a02ec4 | chore: add @playwright/test dependency for E2E spec runner |
| 4 | f87d8789 | fix(e2e): fix two Playwright test bugs - inner_text to innerText and accept 201 status |
| 5 | 5b6daf2e | fix(e2e): correct innerText() API call and accept 201 status in evolvers-protocol tests |
| 6 | 8b31f329 | feat(e2e): add evolvers protocol E2E test suite via cherry-pick from 1f137fc6 |
| 7 | 6ac41ea8 | Merge commit 'bf819434' |
| 8 | bf819434 | fix: correct next.js 14 fetch cache syntax in skill route |
| 9 | 228cadb1 | fix: use correct Next.js 14 cache syntax in /api/skill route |
| 10 | a6f21a14 | docs: add Evolver client protocol compatibility evidence to GOAL-COMPLETION.md |
| 11 | 74d57624 | chore: add screenshot capture script for task verification |
| 12 | b350f4ab | feat: add /skill.md route and E2E evolver protocol tests |

### Merge Base
- `git merge-base origin/master HEAD` = `32eaca20` (Merge commit 'd9740edf')

---

## Critical Finding: Repository Has Two Main Branches

```bash
# origin/master = workspace's parent branch (12 commits behind HEAD)
# origin/main   = remote HEAD pointer (25 commits AHEAD of HEAD!)
#                This was pushed after the workspace branch was created
```

### Critical Issue
**The workspace branch is BEHIND origin/main by 25 commits.**

This means:
1. Other workspace agents pushed changes directly to `origin/main`
2. Our workspace branch is based on an older state of `origin/master`
3. Pushing to `origin/master` would NOT incorporate those 25 commits

---

## Merge Strategy Options Analysis

### Option 1: Rebase HEAD onto origin/master (NOT RECOMMENDED)

```bash
git checkout workspace/node-9e97288fcf22-dafc332b-77d
git fetch origin
git rebase origin/master
# Resolve any conflicts
git push --force-with-lease origin workspace/node-9e97288fcf22-dafc332b-77d:master
```

**Pros:**
- Clean, linear commit history
- Easy to review

**Cons:**
- REQUIRES force push (rewrites history)
- Loses 25 commits from origin/main (irreversible without merge)
- Dangerous for shared branches
- Does NOT incorporate origin/main changes

**Conflict Surface:** LOW-MEDIUM (12 commits rebasing cleanly)

---

### Option 2: Merge origin/master into HEAD (NOT RECOMMENDED)

```bash
git checkout workspace/node-9e97288fcf22-dafc332b-77d
git fetch origin
git merge origin/master
# Resolve any conflicts
git push origin workspace/node-9e97288fcf22-dafc332b-77d:master
```

**Pros:**
- Preserves commit history
- No force push needed
- Safe for shared branches

**Cons:**
- Creates merge commit
- Does NOT incorporate origin/main changes
- Still behind origin/main by 25 commits

**Conflict Surface:** LOW (origin/master is 12 commits behind HEAD)

---

### Option 3: Merge origin/main into HEAD, then push (RECOMMENDED)

```bash
git checkout workspace/node-9e97288fcf22-dafc332b-77d
git fetch origin
git merge origin/main
# Resolve conflicts (expected in frontend/src, backend/src, docs/)
git push origin workspace/node-9e97288fcf22-dafc332b-77d:master
git push origin workspace/node-9e97288fcf22-dafc332b-77d:main
```

**Pros:**
- Incorporates ALL changes (workspace + origin/main)
- Standard workflow
- Both branches stay in sync
- No force push needed

**Cons:**
- Requires conflict resolution
- Large diff (hundreds of files)

**Conflict Surface:** HIGH (25 commits vs workspace 12 commits)

---

### Option 4: Cherry-pick Workspace Commits onto origin/main (ALTERNATIVE)

```bash
git checkout -b merge-target origin/main
git cherry-pick b350f4ab 74d57624 a6f21a14 228cadb1 bf819434 8b31f329
# Skip merge commits, only pick real changes
# Resolve conflicts per commit
git push origin merge-target:master
git push origin merge-target:main
```

**Pros:**
- Clean commit history on target branch
- Selective cherry-pick of desired changes only
- Avoids merge commit clutter from workspace branches

**Cons:**
- Time-consuming (6 individual cherry-picks of real commits)
- Conflicts must be resolved per commit
- Loses merge commit structure
- Some workspace commits duplicate origin/main changes

**Conflict Surface:** MEDIUM-HIGH (6 cherry-picks with individual conflicts)

---

## Recommended Strategy: OPTION 3 (Merge origin/main into HEAD)

### Rationale

1. **Completeness**: Incorporates all 25 commits from origin/main + 12 workspace commits
2. **Safety**: No history rewriting (no force push)
3. **Reversibility**: Standard merge, easy to rollback
4. **Testability**: Single merge point, run tests once

### Pre-Merge Checklist

```bash
# 1. Ensure clean working directory
git status

# 2. Fetch latest from all remotes
git fetch --all

# 3. Verify merge base
git merge-base origin/main HEAD

# 4. Create backup branch
git branch backup-$(date +%Y%m%d) HEAD
```

---

## Conflict Resolution Guide

### Expected Conflict Areas

Based on diff analysis, conflicts are likely in:

| Priority | File Pattern | Strategy |
|----------|--------------|----------|
| HIGH | `frontend/package*.json` | Use `origin/main` version (newer deps) |
| HIGH | `backend/package*.json` | Use `origin/main` version (newer deps) |
| HIGH | `frontend/src/app/page.tsx` | Merge both - check for workspace features |
| MEDIUM | `backend/src/index.ts` | Merge both - skill.md route important |
| MEDIUM | `docs/GOAL-COMPLETION.md` | Keep both sections |
| LOW | Other docs/ | Prefer `origin/main` (more complete) |

### Resolution Commands

```bash
# For each conflict:
git checkout --ours <file>   # Keep workspace version
git checkout --theirs <file>  # Keep origin/main version
# OR use mergetool for manual merge
git mergetool

# After resolving all conflicts:
git add .
git commit -m "Merge origin/main into workspace - resolve conflicts"
```

---

## Execution Commands (Copy-Paste Ready)

```bash
#!/bin/bash
set -e
cd /workspace/.memstack/worktrees/dafc332b-77de-4d6a-8bbd-08e7d74bceeb

echo "=== Step 1: Create backup ==="
git branch "backup-$(date +%Y%m%d-%H%M%S)" HEAD

echo "=== Step 2: Fetch latest ==="
git fetch --all

echo "=== Step 3: Merge origin/main ==="
git merge origin/main --no-edit

echo "=== Step 4: Resolve conflicts ==="
# Run mergetool or manually resolve conflicts
# git mergetool

echo "=== Step 5: Commit merge ==="
git add .
git commit -m "Merge origin/main into workspace branch"

echo "=== Step 6: Verify ==="
git log --oneline -5

echo "=== Step 7: Push to origin/master ==="
git push origin HEAD:master

echo "=== Step 8: Push to origin/main ==="
git push origin HEAD:main

echo "=== Done! ==="
```

---

## Verification Steps Post-Merge

```bash
# 1. Verify merge commit exists
git log --oneline | grep -i merge | head -3

# 2. Verify no remaining conflicts
git status

# 3. Run tests
cd backend && npm test
cd ../frontend && npm run build

# 4. Check diff is clean
git diff origin/main HEAD
# Should show: (empty) or minimal

# 5. Verify all branches are aligned
git log --oneline origin/master -3
git log --oneline origin/main -3
git log --oneline HEAD -3
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Merge conflicts in package-lock.json | HIGH | LOW | Run `npm install` after merge |
| Conflict in page components | MEDIUM | MEDIUM | Manual merge, preserve features |
| Lost workspace changes | LOW | HIGH | Backup branch created |
| Broken build after merge | MEDIUM | HIGH | Run `npm run build` before push |

---

## Decision Point Required

Before proceeding with the merge, the workspace leader must decide:

1. **Target Branch**: Which branch should be canonical?
   - `origin/master` (legacy, used by workspace)
   - `origin/main` (newer, pushed by other agents)

2. **Merge Strategy**: Based on the 4 options above (Option 3 recommended)

3. **Conflict Resolution Policy**: Which version to prefer when conflicts occur?
