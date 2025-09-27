import * as core from "@actions/core";
import * as github from "@actions/github";
import * as commit from "./commit";

export const main = async () => {
  const defaultBranch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME;
  const branch = core.getInput("branch") || defaultBranch;
  const failOnSelfPush = core.getBooleanInput("fail_on_self_push");
  if (!branch) {
    core.setFailed("Branch input is required.");
    return;
  }
  const repoFullName = core.getInput("repository");
  let owner = github.context.repo.owner;
  let repo = github.context.repo.repo;
  if (repoFullName) {
    const [o, r] = repoFullName.split("/");
    if (!o || !r) {
      core.setFailed("Invalid repository format. Use 'owner/repo'.");
      return;
    }
    owner = o;
    repo = r;
  }
  const octokit = github.getOctokit(core.getInput("github_token"));
  const result = await commit.createCommit(octokit, {
    owner: owner,
    repo: repo,
    branch: branch,
    message: core.getInput("commit_message") || "Commit changes",
    files: core.getMultilineInput("files"),
    rootDir: core.getInput("root_dir"),
    baseBranch: core.getInput("parent_branch"),
    deleteIfNotExist: true,
    logger: {
      info: core.info,
    },
  });
  const pushed = result?.commit.sha !== undefined && result?.commit.sha !== "";
  core.setOutput("sha", result?.commit.sha || "");
  core.setOutput("pushed", pushed);
  const isSameTarget = `${owner}/${repo}` === `${github.context.repo.owner}/${github.context.repo.repo}` && branch === defaultBranch;
  const selfPush = pushed && isSameTarget;
  core.setOutput("self_push", selfPush);
  if (selfPush) {
    if (failOnSelfPush) {
      core.setFailed("a commit was pushed");
      return;
    }
    core.notice("a commit was pushed");
  }
};
