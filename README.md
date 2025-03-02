# commit-action

[![License](http://img.shields.io/badge/license-mit-blue.svg?style=flat-square)](https://raw.githubusercontent.com/suzuki-shunsuke/commit-action/main/LICENSE) | [action.yaml](action.yaml)

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
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          persist-credentials: false

      # Fix files
      # ...

      - name: Push changes to the remote branch
        uses: suzuki-shunsuke/commit-action@db754eb4adb44fb5aee5879a3bd08785efec198e # v0.0.4
```

commit-action fails if it pushes a commit.
If no change is pushed, commit-action does nothing and exits successfully.

### branch, repository

By default, commit-action pushes a commit to `${GITHUB_HEAD_REF:-${GITHUB_REF_NAME}}` in `$GITHUB_REPOSITORY`, but you can change them.

### GitHub Access token

`${{github.token}}` is used by default, but we don't recommend it because `${{github.token}}` doesn't trigger a new workflow run.
We recommend GitHub App installation access tokens.
You can create a GitHub App installation access token and pass it to commit-action yourself, but you can also pass a pair of GitHub App ID and private key.
Then commit-action creates a GitHub App installation access token with minimum `repositories` and `permissions`.

```yaml
- uses: suzuki-shunsuke/commit-action@db754eb4adb44fb5aee5879a3bd08785efec198e # v0.0.4
  with:
    app_id: ${{secrets.APP_ID}}
    app_private_key: ${{secrets.APP_PRIVATE_KEY}}
```

### files

commit-action commits all created, updated, and deleted files by default, but you can also commit only specific files.
And you can also change the commit message.

```yaml
- uses: suzuki-shunsuke/commit-action@db754eb4adb44fb5aee5879a3bd08785efec198e # v0.0.4
  with:
    commit_message: "style: format code"
    files: |
      README.md
      package-lock.json
```

### Fix workflow files

If you want to fix workflow files, the permission `workflows:write` is required.
The input `workflow` changes the behaviour when workflow files are changed.
The input is used if `app_id` and `app_private_key` are passed.
The following values are available:

1. `allow` (default) - Grant workflows:write permission when issuing an access token
1. `deny` - Fail if workflow files are changed
1. `ignore` - Ignore workflow files
