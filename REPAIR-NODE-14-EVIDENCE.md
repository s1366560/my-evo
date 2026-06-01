# Repair node-50c09a634780 (Feature 14) — Evidence Pack

## Task
Repair verification blockers for "Platform-harness-driven verification: re-trigger
Drone CI on memstack-source-publish/main fast-forwarded past faffc09 (worktree commit
660507b with slim OOM-safe .drone.yml)".

## Pre-flight checks
- `preflight:read-progress` — passed (workspace report history read).
- `preflight:git-status` — passed (worktree clean, see git status --short output).

## Worktree state (current attempt)
- Path: `/workspace/.memstack/worktrees/843c573c-a013-4e0b-8b1b-266e9e219e31`
- Branch: `workspace/node-50c09a634780-843c573c-a01`
- HEAD: `c653c6f8ab0e23dcc73d69d46bd1b270d4bcd05d`
- HEAD subject: `feat(oauth): harden state.ts with jti single-use tracking + replay protection`
- HEAD diff vs `ef94fd1` (parent): 8 files changed, 917 insertions, 0 deletions.
  New files: `backend/src/oauth/{state,service,providers,controller,routes}.ts` etc.
  Note: HEAD does not include the `660507b/7705565/fa6a7d1` slim OOM-safe
  `.drone.yml` commits; `.drone.yml` at HEAD is identical to `.drone.yml` at
  `ef94fd1` (205 lines, 7 stages, 100 commands, 100% string-typed — already slim).

## .drone.yml compliance (re-verified)
- Steps: 7
  - `repository-smoke`
  - `backend-test`
  - `frontend-build`
  - `docker-build`
  - `docker-build-frontend`
  - `deploy`
  - `e2e-test`
- Total `commands[]` items: 100
- Non-string command items: 0
- YAML parse: OK

## Root cause of prior verification failure
- `github/main` (s1366560/my-evo) HEAD = `ef94fd1`
- `memstack-source-publish/main` HEAD = `ef94fd1`
- Current attempt worktree HEAD = `c653c6f` (1 commit ahead)
- Therefore any platform-side Drone run that targets
  `memstack-source-publish/main` cannot fast-forward the local clone past
  `ef94fd1`, so the `source_publish` push step fails with
  `! [rejected] main -> memstack-source-publish/main (non-fast-forward)`.
  This is exactly the platform pipeline reason reported in
  `latest_workspace_pipeline_evidence` (run `72eb4b3e-27be-4f20-8bc4-4f0d49234acd`,
  commit `d307402`).

## Sandbox capability check
- `drone` binary: missing
- `drone-cli` binary: missing
- `DRONE_TOKEN`: missing (`check_env_vars cicd_run_pipeline` reports missing)
- `DRONE_SERVER_URL`: missing
- `GITHUB_TOKEN`: missing
- `git push github HEAD:main` -> `fatal: Authentication failed for
  'https://github.com/s1366560/my-evo.git/'` (remote.github.url has empty
  x-access-token placeholder)
- `git push source-publish HEAD:refs/heads/memstack-source-publish/main` ->
  `fatal: could not read Password for 'https://x-access-token@github.com':
  No such device or address` (no tty, no token in env)

## Platform cicd_run_pipeline probe
Called the platform's `cicd_run_pipeline` tool with `repository=s1366560/my-evo`,
`branch=main`, `wait=true`. Result:
- `run_id`: `76a09a97-f790-40f6-b5f5-1485e9af159c`
- `external_id`: `s1366560/my-evo#391`
- `status`: `failed`
- `reason`: `Drone build s1366560/my-evo#391 finished with status failure`
- Stage breakdown:
  - `clone`: success
  - `repository-smoke`: **failed** (this is where it stopped)
  - `backend-test`, `frontend-build`, `docker-build`, `docker-build-frontend`,
    `deploy`, `e2e-test`: all skipped

Conclusion: the platform tool can trigger a build, but the build runs on the
platform's current `main` (which is `ef94fd1`, not `c653c6f`) and the build
fails at `repository-smoke`. The tool does not expose a way to push the
worktree commit into the platform ref from inside the sandbox, and a `commit=`
override was not honored (Drone build ran on the platform ref anyway).

## Why retry_same_node is wrong here
- The verifier explicitly states the worker sandbox cannot perform the
  fast-forward push (no token, no CLI) and that retrying the same node would
  reproduce the identical credential limitation.
- The `create_repair_node` action called for in the original judge verdict
  requires an agent with platform-harness push credentials, which the current
  worker binding does not have.

## What's needed (for the platform-harness repair node)
1. Fast-forward `github/main` to `c653c6f8ab0e23dcc73d69d46bd1b270d4bcd05d`
   (the worktree HEAD). This is a single-commit fast-forward from `ef94fd1`.
2. Fast-forward `memstack-source-publish/main` to the same SHA (or have Drone
   re-push the branch on its own after step 1).
3. Re-trigger Drone CI on `s1366560/my-evo`, branch `main`, targeting the
   `deploy` stage. Capture a `status=success` build with all 7 stages green.
4. After completion, the original verification node
   `d803515a-5998-480f-a3c7-07b6583a7765` should be re-run.

## Diff summary
- `git diff ef94fd1..c653c6f --stat`:
  ```
   backend/src/db/mock-store.ts    |   5 +
   backend/src/index.ts            |   2 +
   backend/src/oauth/controller.ts |  65 +++++
   backend/src/oauth/oauth.test.ts | 266 +++++++
   backend/src/oauth/providers.ts  |  93 ++++
   backend/src/oauth/routes.ts     |  16 ++
   backend/src/oauth/service.ts    | 253 +++++++++
   backend/src/oauth/state.ts      | 217 +++++++++
   8 files changed, 917 insertions(+)
  ```
- No uncommitted changes in the worktree (`git status --short` is empty).
- No edits made in this attempt — the worktree already contained the
  `c653c6f` commit and the slim `.drone.yml` is unchanged from `ef94fd1`.

## Verifications (for the worker's report)
- preflight:read-progress
- preflight:git-status
- git_diff_summary:c653c6f already contains OAuth hardening; .drone.yml is slim
  and 100% string-typed; no edits required
- yaml_validated:7_stages_100_commands_0_non_string
- platform_pipeline_probe:cicd_run_pipeline_triggered_run_76a09a97_status_failed_stage_repository-smoke
- platform_ref_status:github/main=ef94fd1 source-publish/main=ef94fd1
  worktree_HEAD=c653c6f_fast_forward_required
- sandbox_credential_check:no_drone_cli,no_drone_token,no_github_token,
  git_push_failed_authentication
