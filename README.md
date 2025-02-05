# commit-action

[![License](http://img.shields.io/badge/license-mit-blue.svg?style=flat-square)](https://raw.githubusercontent.com/suzuki-shunsuke/urfave-cli-help-all/main/LICENSE) | [action.yaml](action.yaml)

GitHub Action to push changes to remote branches by GitHub API.

## Why?

This action creates commits using GitHub API rather than `git`.
This enables you to create **verified** commits using GitHub App.
This action wraps [suzuki-shunsuke/ghcp](https://github.com/suzuki-shunsuke/ghcp) to commit changed files easily.

## Requirements

- `git`: To list changed files
- GitHub Access Token: To push commits. The permission `contents:write` is required

## How To Use

This action uses a GitHub token to push a commit.
And this action uses `git` to list changed files.
So `git` is required and you need to checkout a repository in advance.

To create a verified commit, we recommend using a GitHub App installation token.

> [!WARNING]
> Note that `${{secrets.GITHUB_TOKEN}}` can't trigger a new workflow run.
> https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication#using-the-github_token-in-a-workflow
> > When you use the repository's GITHUB_TOKEN to perform tasks, events triggered by the GITHUB_TOKEN, with the exception of workflow_dispatch and repository_dispatch, will not create a new workflow run.

```yaml
name: Example
on:
  pull_request: {}
jobs:
  example:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@692973e3d937129bcbf40652eb9f2f61becf3332 # v4.1.7
        with:
          persist-credentials: false

      # Change files
      # ...

      - name: Create a GitHub App Installation token
        id: token
        uses: tibdex/github-app-token@3beb63f4bd073e61482598c45c71c1019b59b73a # v2.1.0
        with:
          app_id: ${{secrets.APP_ID}}
          private_key: ${{secrets.APP_PRIVATE_KEY}}
          # contents:write : To push a commit
          permissions: >-
            {
              "contents": "write"
            }
          repositories: >-
            ["${{github.event.repository.name}}"]
      - name: Push changes to the remote branch ($GITHUB_HEAD_REF or $GITHUB_REF)
        uses: suzuki-shunsuke/commit-action@main
        with:
          github_token: ${{steps.token.outputs.token}}
```

Instead of passing a GitHub Access Token, you can pass GitHub App ID and GitHub App Private Key.
Then this action issues a GitHub App installation token by minimum `repositories` and `permissions`.
This makes code simple.

```yaml
name: Example
on:
  pull_request: {}
jobs:
  example:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@692973e3d937129bcbf40652eb9f2f61becf3332 # v4.1.7
        with:
          persist-credentials: false

      # Change files
      # ...

      - name: Push changes to the remote branch ($GITHUB_HEAD_REF or $GITHUB_REF)
        uses: suzuki-shunsuke/commit-action@main
        with:
          app_id: ${{secrets.APP_ID}}
          app_private_key: ${{secrets.APP_PRIVATE_KEY}}
```
