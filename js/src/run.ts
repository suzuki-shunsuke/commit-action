import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as github from "@actions/github";
import * as commit from "./commit";
import * as githubAppToken from "@suzuki-shunsuke/github-app-token";

export const main = async () => {
  if (core.getState("post")) {
    const token = core.getState("token");
    if (token) {
      // This is post-cleanup: revoke the token created during main execution
      return githubAppToken.revoke(token);
    }
    return;
  }
  core.saveState("post", "true");

  const permissions: githubAppToken.Permissions = {
    contents: "write",
  };

  let files = await getFiles();
  if (files.length === 0) {
    core.notice("No changes");
    return;
  }
  const workflowOption = core.getInput("workflow");
  if (workflowOption === "ignore") {
    core.notice("Ignore workflow files");
    files = files.filter((f) => !f.startsWith(".github/workflows/"));
    if (files.length === 0) {
      core.notice("No changes after ignoring workflow files");
      return;
    }
  } else if (workflowOption === "allow") {
    if (files.some((f) => f.startsWith(".github/workflows/"))) {
      core.notice("Grant workflows:write permission");
      permissions.workflows = "write";
    }
  }

  // This is main execution: continue with normal processing
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
  let githubToken = core.getInput("github_token");
  if (!githubToken) {
    githubToken = await githubAppToken.create({
      appId: core.getInput("app_id"),
      privateKey: core.getInput("app_private_key"),
      owner: owner,
      repositories: [repo],
      permissions: permissions,
    });
    core.saveState("token", githubToken);
  }
  const octokit = github.getOctokit(githubToken);
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

const getFiles = async (): Promise<string[]> => {
  const files = core.getMultilineInput("files");
  if (files.length > 0) {
    return files;
  }
  const gitLsFilesOutput: string[] = [];
  const out = await exec.getExecOutput(
    "git", ["ls-files", "--modified", "--others", "--exclude-standard"], {
      cwd: core.getInput("root_dir") || undefined,
    });
  out.stdout.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed) {
      gitLsFilesOutput.push(trimmed);
    }
  });
  return gitLsFilesOutput;
};
