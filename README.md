# commit-action

[![License](http://img.shields.io/badge/license-mit-blue.svg?style=flat-square)](https://raw.githubusercontent.com/suzuki-shunsuke/urfave-cli-help-all/main/LICENSE) | [action.yaml](action.yaml)

GitHub Action to push changes to remote branches by GitHub API.
You can create **verified** commits using GitHub App.

<img width="870" alt="image" src="https://github.com/user-attachments/assets/e9f3880c-1c4e-47e5-a376-13bc25620089" />

## Why?

This action creates commits using GitHub API instead of `git`.
This enables you to create **verified** commits using GitHub App.
This action wraps [suzuki-shunsuke/ghcp](https://github.com/suzuki-shunsuke/ghcp) to commit changed files easily.

## Requirements

- `git`: To list changed files

## GitHub Access Token

You can use the following things:

- :thumbsup: GitHub App Installation access token: We recommend this
- :thumbsdown: GitHub Personal Access Token: This can't create verified commits
- :thumbsdown: `${{secrets.GITHUB_TOKEN}}`: This can't trigger new workflow runs.

https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication#using-the-github_token-in-a-workflow

> When you use the repository's GITHUB_TOKEN to perform tasks, events triggered by the GITHUB_TOKEN, with the exception of workflow_dispatch and repository_dispatch, will not create a new workflow run.

## How To Use

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

Instead of a GitHub Access Token, you can pass GitHub App ID and GitHub App Private Key.
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
