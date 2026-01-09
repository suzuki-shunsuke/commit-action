# commit-action

[![DeepWiki](https://img.shields.io/badge/Ask_DeepWiki-000000.svg?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAyCAYAAAAnWDnqAAAAAXNSR0IArs4c6QAAA05JREFUaEPtmUtyEzEQhtWTQyQLHNak2AB7ZnyXZMEjXMGeK/AIi+QuHrMnbChYY7MIh8g01fJoopFb0uhhEqqcbWTp06/uv1saEDv4O3n3dV60RfP947Mm9/SQc0ICFQgzfc4CYZoTPAswgSJCCUJUnAAoRHOAUOcATwbmVLWdGoH//PB8mnKqScAhsD0kYP3j/Yt5LPQe2KvcXmGvRHcDnpxfL2zOYJ1mFwrryWTz0advv1Ut4CJgf5uhDuDj5eUcAUoahrdY/56ebRWeraTjMt/00Sh3UDtjgHtQNHwcRGOC98BJEAEymycmYcWwOprTgcB6VZ5JK5TAJ+fXGLBm3FDAmn6oPPjR4rKCAoJCal2eAiQp2x0vxTPB3ALO2CRkwmDy5WohzBDwSEFKRwPbknEggCPB/imwrycgxX2NzoMCHhPkDwqYMr9tRcP5qNrMZHkVnOjRMWwLCcr8ohBVb1OMjxLwGCvjTikrsBOiA6fNyCrm8V1rP93iVPpwaE+gO0SsWmPiXB+jikdf6SizrT5qKasx5j8ABbHpFTx+vFXp9EnYQmLx02h1QTTrl6eDqxLnGjporxl3NL3agEvXdT0WmEost648sQOYAeJS9Q7bfUVoMGnjo4AZdUMQku50McDcMWcBPvr0SzbTAFDfvJqwLzgxwATnCgnp4wDl6Aa+Ax283gghmj+vj7feE2KBBRMW3FzOpLOADl0Isb5587h/U4gGvkt5v60Z1VLG8BhYjbzRwyQZemwAd6cCR5/XFWLYZRIMpX39AR0tjaGGiGzLVyhse5C9RKC6ai42ppWPKiBagOvaYk8lO7DajerabOZP46Lby5wKjw1HCRx7p9sVMOWGzb/vA1hwiWc6jm3MvQDTogQkiqIhJV0nBQBTU+3okKCFDy9WwferkHjtxib7t3xIUQtHxnIwtx4mpg26/HfwVNVDb4oI9RHmx5WGelRVlrtiw43zboCLaxv46AZeB3IlTkwouebTr1y2NjSpHz68WNFjHvupy3q8TFn3Hos2IAk4Ju5dCo8B3wP7VPr/FGaKiG+T+v+TQqIrOqMTL1VdWV1DdmcbO8KXBz6esmYWYKPwDL5b5FA1a0hwapHiom0r/cKaoqr+27/XcrS5UwSMbQAAAABJRU5ErkJggg==)](https://deepwiki.com/suzuki-shunsuke/commit-action)
[![License](http://img.shields.io/badge/license-mit-blue.svg?style=flat-square)](https://raw.githubusercontent.com/suzuki-shunsuke/commit-action/main/LICENSE) [action.yaml](action.yaml)

commit-action is a GitHub Action to push changes to remote branches by GitHub API.
You can create **verified** commits using GitHub App.

<img width="870" alt="image" src="https://github.com/user-attachments/assets/e9f3880c-1c4e-47e5-a376-13bc25620089" />

## Blog posts

- [2025-02-15 GitHub Actions で Verified Commit でコードを自動修正](https://zenn.dev/shunsuke_suzuki/articles/commit-action)
- [2025-02-15 Fix Code Via GitHub Actions By Verified Commits](https://dev.to/suzukishunsuke/fix-code-via-github-actions-by-verified-commits-3o1d)

## Why Use commit-action?

Unlike similar actions, **commit-action creates and pushes commits by GitHub API instead of Git commands**.
So you can create **verified commits** using GitHub Actions token `${{github.token}}` or a GitHub App installation access token.

Commit signing is so important for security.

https://docs.github.com/en/authentication/managing-commit-signature-verification

To create verified commits using Git, a GPG key or SSH key is required.
It's bothersome to manage GPG keys and SSH keys properly for automation, so it's awesome that commit-action can create verified commits without them.

## GitHub Access Token

You can use the following things:

- :thumbsup: GitHub App Installation access token: We recommend this
- :thumbsdown: GitHub Personal Access Token: This can't create verified commits
- :thumbsdown: `${{secrets.GITHUB_TOKEN}}`: This can't trigger new workflow runs.

https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication#using-the-github_token-in-a-workflow

> When you use the repository's GITHUB_TOKEN to perform tasks, events triggered by the GITHUB_TOKEN, with the exception of workflow_dispatch and repository_dispatch, will not create a new workflow run.

### Required permissions

`contents:write` is required.
Furthermore, if you want to fix workflow files, `workflows:write` is also required.

## How To Use

commit-action is so easy to use.
All inputs are optional.

You only need to run commit-action after fixing code in workflows.
Then it creates and pushes a commit to a remote branch.

```yaml
name: Example
on:
  pull_request: {}
jobs:
  example:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6.0.1
        with:
          persist-credentials: false

      # Fix files
      # ...

      - name: Push changes to the remote branch
        uses: suzuki-shunsuke/commit-action@87b297f0ce551411b43d1880f4fb3cbc60381055 # v0.0.14
```

commit-action fails if it pushes a commit to `${GITHUB_HEAD_REF:-${GITHUB_REF_NAME}}` in `$GITHUB_REPOSITORY`.
If you want to continue without failing, set `fail_on_self_push: false` and check outputs instead (see `self_push`).
If no change is pushed, commit-action does nothing and exits successfully.

### branch, repository

By default, commit-action pushes a commit to `${GITHUB_HEAD_REF:-${GITHUB_REF_NAME}}` in `$GITHUB_REPOSITORY`, but you can change them.

```yaml
- uses: suzuki-shunsuke/commit-action@87b297f0ce551411b43d1880f4fb3cbc60381055 # v0.0.14
  with:
    branch: foo
    repository: suzuki-shunsuke/tfcmt
```

### parent branch

If a new branch is created, the parent branch is the default branch by default.
You can specify the paretn branch.

```yaml
- uses: suzuki-shunsuke/commit-action@87b297f0ce551411b43d1880f4fb3cbc60381055 # v0.0.14
  with:
    branch: foo-2
    parent_branch: foo
```

### GitHub Access token

`${{github.token}}` is used by default, but we don't recommend it because `${{github.token}}` doesn't trigger a new workflow run.
We recommend GitHub App installation access tokens.
You can create a GitHub App installation access token and pass it to commit-action yourself, but you can also pass a pair of GitHub App ID and private key.
Then commit-action creates a GitHub App installation access token with minimum `repositories` and `permissions`.

```yaml
- uses: suzuki-shunsuke/commit-action@87b297f0ce551411b43d1880f4fb3cbc60381055 # v0.0.14
  with:
    app_id: ${{secrets.APP_ID}}
    app_private_key: ${{secrets.APP_PRIVATE_KEY}}
```

### Which Files To Be Committed

By default, commit-action lists all added, modified, and deleted files by `git ls-files --modified --others --exclude-standard` in `root_dir` (The default is `.`).
The input `files` is used as arguments of `git ls-files`.
If the input `list_files_by_git` is set to `false` (the default is `true`), the action uses the input `files` as files to be committed without `git ls-files`.
The repository needs to be checked out before using commit-action unless `list_files_by_git` is set to `false`.
The input `files` is a list of relative paths from `root_dir`.

e.g.

```yaml
- uses: suzuki-shunsuke/commit-action@87b297f0ce551411b43d1880f4fb3cbc60381055 # v0.0.14
  with:
    files: |
      README.md
      package-lock.json
```

### fail_on_self_push

[#204](https://github.com/suzuki-shunsuke/commit-action/pull/204) By default, commit-action fails when a commit is pushed to the same repo and branch as the current workflow run.
When the input `fail_on_self_push` is set to `false` (the default is `true`), the action succeeds in this case.

```yaml
- uses: suzuki-shunsuke/commit-action@87b297f0ce551411b43d1880f4fb3cbc60381055 # v0.0.14
  with:
    fail_on_self_push: false # continue without failing when self-pushing
```

### Outputs

- `pushed`: true if a commit was pushed.
- `sha`: the pushed commit SHA (empty if none).
- `self_push`: true if a commit was pushed to the same repo/branch as the current workflow run.

### Fix workflow files

If you want to fix workflow files, the permission `workflows:write` is required.
The input `workflow` changes the behaviour when workflow files are changed.
The input is used if `app_id` and `app_private_key` are passed.
The following values are available:

1. `allow` (default) - Grant workflows:write permission when issuing an access token
1. `deny` - Fail if workflow files are changed
1. `ignore` - Ignore workflow files

```yaml
- uses: suzuki-shunsuke/commit-action@87b297f0ce551411b43d1880f4fb3cbc60381055 # v0.0.14
  with:
    workflow: ignore # allow (default), deny
```

## Available versions

commit-action's main branch and feature branches don't work.
[Please see the document](https://github.com/suzuki-shunsuke/release-js-action/blob/main/docs/available_versions.md).
