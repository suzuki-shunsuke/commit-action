import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as github from "@actions/github";
import * as commit from "@suzuki-shunsuke/commit-ts";
import * as githubAppToken from "@suzuki-shunsuke/github-app-token";

type GetTokenResult = {
  token: string;
  appToken?: githubAppToken.Token;
};

export const main = async () => {
  const permissions: githubAppToken.Permissions = {
    contents: "write",
  };

  const emptyCommit = core.getBooleanInput("empty_commit");

  let files: string[] = [];
  if (!emptyCommit) {
    files = await getFiles();
    if (files.length === 0 && !emptyCommit) {
      core.notice("No changes");
      return;
    }
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
  const defaultBranch =
    process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME;
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
  const commitMessage =
    core.getInput("commit_message") ||
    (emptyCommit ? "empty commit" : "commit changes");
  const forcePush = core.getBooleanInput("force_push");
  const rootDir = core.getInput("root_dir");
  const baseBranch = core.getInput("parent_branch");
  const noParent = core.getBooleanInput("orphan");
  const useBaseTree = core.getBooleanInput("use_base_tree");
  const param: Omit<commit.Options, "logger"> = {
    owner: owner,
    repo: repo,
    branch: branch,
    message: commitMessage,
    files: files,
    empty: emptyCommit,
    forcePush,
    rootDir,
    baseBranch,
    deleteIfNotExist: true,
    noParent,
    useBaseTree,
  };
  core.info(`creating a commit: ${JSON.stringify(param)}`);
  const result = await createCommit(permissions, {
    ...param,
    logger: {
      info: core.info,
    },
  });
  const pushed = result?.commit.sha !== undefined && result?.commit.sha !== "";
  core.setOutput("sha", result?.commit.sha || "");
  core.setOutput("pushed", pushed);
  const isSameTarget =
    `${owner}/${repo}` ===
      `${github.context.repo.owner}/${github.context.repo.repo}` &&
    branch === defaultBranch;
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

const createCommit = async (
  permissions: githubAppToken.Permissions,
  opts: commit.Options,
): Promise<commit.Result | undefined> => {
  let appToken: githubAppToken.Token | undefined;
  try {
    const got = await getToken(opts.owner, opts.repo, permissions);
    appToken = got.appToken;
    const octokit = github.getOctokit(got.token);
    return await commit.createCommit(octokit, opts);
  } finally {
    await revokeToken(appToken);
  }
};

const revokeToken = async (appToken: githubAppToken.Token | undefined) => {
  if (!appToken) {
    return;
  }
  if (appToken.expiresAt && githubAppToken.hasExpired(appToken.expiresAt)) {
    core.info("GitHub App token has already expired");
    return;
  }
  core.info("Revoking GitHub App token");
  try {
    await githubAppToken.revoke(appToken.token);
  } catch (e) {
    core.warning(
      `failed to revoke GitHub App token: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
};

const getToken = async (
  owner: string,
  repo: string,
  permissions: githubAppToken.Permissions,
): Promise<GetTokenResult> => {
  const token = core.getInput("github_token");
  if (token) {
    return { token };
  }
  const appId = core.getInput("app_id");
  const appPrivateKey = core.getInput("app_private_key");
  if (appId) {
    if (!appPrivateKey) {
      throw new Error("app_private_key is required when app_id is provided");
    }
    core.info(
      `creating a GitHub App token: ${JSON.stringify({
        owner: owner,
        repositories: [repo],
        permissions: permissions,
      })}`,
    );
    const appToken = await githubAppToken.create({
      appId: appId,
      privateKey: appPrivateKey,
      owner: owner,
      repositories: [repo],
      permissions: permissions,
    });
    core.setSecret(appToken.token);
    return { token: appToken.token, appToken };
  }
  if (appPrivateKey) {
    throw new Error("app_id is required when app_private_key is provided");
  }
  return { token: core.getInput("default_github_token") };
};

const getFiles = async (): Promise<string[]> => {
  const files = core.getMultilineInput("files");
  if (!core.getBooleanInput("list_files_by_git")) {
    return files;
  }
  const out = await exec.getExecOutput(
    "git",
    ["ls-files", "--modified", "--others", "--exclude-standard"].concat(files),
    {
      cwd: core.getInput("root_dir") || undefined,
    },
  );
  const gitLsFilesOutput: string[] = [];
  out.stdout.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed) {
      gitLsFilesOutput.push(trimmed);
    }
  });
  return gitLsFilesOutput;
};
