import type * as github from "@actions/github";
import * as core from "@actions/core";
import type { Octokit } from "@octokit/rest";
import { readFile, stat } from "fs/promises";

export interface Logger {
  info(m: string): void;
}

export type Options = {
  owner: string;
  repo: string;
  branch: string;
  message: string;
  empty?: boolean; // if true, create an empty commit
  files?: string[];
  baseSHA?: string; // By default, the base branch's latest commit is used
  baseBranch?: string; // By default, if branch exists, it is used as the base branch. Otherwise, the default branch is used
  noParent?: boolean; // if true, do not use parent commit
  // baseDirectory?: string;
  deletedFiles?: string[]; // files to delete
  deleteIfNotExist?: boolean; // if true, delete files if they don't exist
  forcePush?: boolean; // if true, force push the commit
  logger?: Logger;
};

// Created commit, base ref
export type Result = {
  commit: {
    sha: string;
  };
};

export type GitHub = Octokit | ReturnType<typeof github.getOctokit>;

export const createCommit = async (
  octokit: GitHub,
  opts: Options,
): Promise<Result | undefined> => {
  if (!opts.files?.length && !opts.deletedFiles?.length && !opts.empty) {
    // If no files are passed and empty is false, do nothing
    return undefined;
  }
  validateOptions(opts);
  const logger = opts.logger || {
    info: (message: string) => core.info(message),
  };
  const baseBranch = await getBaseBranch(octokit, opts);
  const treeSHA = await getTreeSHA(octokit, opts, baseBranch, logger);
  // Create a commit
  const parents = opts.noParent
      ? undefined
      : [baseBranch.target.oid];
  logger.info(`creating a commit tree=${treeSHA} parents=${parents}`);
  const commit = await octokit.rest.git.createCommit({
    owner: opts.owner,
    repo: opts.repo,
    message: opts.message,
    tree: treeSHA,
    parents: parents,
  });
  try {
    // Update the reference if the branch exists
    return await updateRef(octokit, opts, commit.data.sha, logger);
  } catch (error: unknown) {
    if (!isError(error)) {
      throw error;
    }
    if (!error.message.includes("Reference does not exist")) {
      throw error;
    }
    // Create a reference if the branch does not exist
    return await createRef(octokit, opts, commit.data.sha, logger);
  }
};

const isError = (value: unknown): value is Error => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const error = value as Record<keyof Error, unknown>;
  if (typeof error.message !== "string") {
    return false;
  }
  return true;
};

type Error = {
  message: string;
};

type FileMode = "100644" | "100755" | "040000" | "160000" | "120000";

type File = {
  path: string;
  content?: string;
  sha?: string | null;
  mode: FileMode;
  type?: "blob" | "tree" | "commit";
};

type DefaultBranchResponse = {
  repository: {
    defaultBranchRef: Ref;
  };
};

const updateRef = async (
  octokit: GitHub,
  opts: Options,
  sha: string,
  logger: Logger,
): Promise<Result> => {
  // Update the reference if the branch exists
  logger.info(`updating ref=heads/${opts.branch} sha=${sha}`);
  const updatedRef = await octokit.rest.git.updateRef({
    owner: opts.owner,
    repo: opts.repo,
    ref: `heads/${opts.branch}`,
    sha: sha,
    force: opts.forcePush || false, // Use force push if specified
  });
  return {
    commit: {
      sha: updatedRef.data.object.sha,
    },
  };
};

const createRef = async (
  octokit: GitHub,
  opts: Options,
  sha: string,
  logger: Logger,
): Promise<Result> => {
  logger.info(`creating ref=heads/${opts.branch} sha=${sha}`);
  const createdRef = await octokit.rest.git.createRef({
    owner: opts.owner,
    repo: opts.repo,
    ref: `refs/heads/${opts.branch}`,
    sha: sha,
  });
  return {
    commit: {
      sha: createdRef.data.object.sha,
    },
  };
};

const getTreeSHA = async (
  octokit: GitHub,
  opts: Options,
  baseBranch: Ref,
  logger: Logger,
): Promise<string> => {
  if (opts.empty) {
    return baseBranch.target.tree.oid;
  }
  const tree: File[] = [];
  for (const filePath of opts.files || []) {
    tree.push(await createTreeFile(opts, filePath));
  }
  for (const filePath of opts.deletedFiles || []) {
    tree.push(await createDeletedTreeFile(opts, filePath));
  }
  const baseTree = opts.noParent ? undefined : baseBranch.target.tree.oid;
  logger.info(`creating a tree with ${tree.length} files base_tree=${baseTree}`);
  const treeResp = await octokit.rest.git.createTree({
    owner: opts.owner,
    repo: opts.repo,
    tree: tree,
    // If not provided, GitHub will create a new Git tree object from only the entries defined in the tree parameter.
    // If you create a new commit pointing to such a tree, then all files which were a part of the parent commit's tree and were not defined in the tree parameter will be listed as deleted by the new commit.
    base_tree: baseTree,
  });
  return treeResp.data.sha;
};

const validateOptions = (opts: Options) => {
  for (const key of ["owner", "repo", "branch", "message"] as const) {
    // Check required options
    if (!opts[key]) {
      throw new Error(`${key} is required`);
    }
  }
};

const createTreeFile = async (
  opts: Options,
  filePath: string,
): Promise<File> => {
  const file = await getFileContentAndMode(
    filePath,
    opts.deleteIfNotExist || false,
  );
  return {
    path: filePath,
    sha: file.sha,
    mode: file.mode,
    type: "blob",
    content: file.content,
  };
};

const createDeletedTreeFile = async (
  opts: Options,
  filePath: string,
): Promise<File> => {
  const file = await getFileContentAndMode(
    filePath,
    opts.deleteIfNotExist || false,
  );
  return {
    path: filePath,
    mode: file.mode,
    type: "blob",
    sha: null,
  };
};

const getBaseBranch = async (octokit: GitHub, opts: Options): Promise<Ref> => {
  if (opts.baseSHA) {
    return {
      target: {
        oid: opts.baseSHA,
        tree: {
          oid: await getTree(octokit, opts.owner, opts.repo, opts.baseSHA),
        },
      },
    };
  }
  if (opts.baseBranch) {
    const branch = await getBranch(octokit, {
      owner: opts.owner,
      repo: opts.repo,
      branch: opts.baseBranch,
    });
    if (branch === undefined) {
      throw new Error(
        `Branch ${opts.branch} does not exist in ${opts.owner}/${opts.repo}`,
      );
    }
    return branch;
  }
  // Check if the specified branch exists
  const branch = await getBranch(octokit, {
    owner: opts.owner,
    repo: opts.repo,
    branch: opts.branch,
  });

  if (branch) {
    return branch;
  }
  return await getDefaultBranch(octokit, opts);
};

const getDefaultBranch = async (
  octokit: GitHub,
  opts: Options,
): Promise<Ref> => {
  const { repository } = await octokit.graphql<DefaultBranchResponse>(
    `query($owner: String!, $repo: String!) {
     repository(owner: $owner, name: $repo) {
       defaultBranchRef {
         target {
           ... on Commit {
             oid
             tree {
               oid
             }
           } 
         }
       }
     }
   } 
  `,
    {
      owner: opts.owner,
      repo: opts.repo,
    },
  );
  return repository.defaultBranchRef;
};

type getBranchInput = {
  owner: string;
  repo: string;
  branch: string;
};

type Ref = {
  target: {
    oid: string;
    tree: {
      oid: string;
    };
  };
};

type getBranchResponse = {
  repository: {
    ref?: Ref;
  };
};

const getBranch = async (
  octokit: GitHub,
  input: getBranchInput,
): Promise<Ref | undefined> => {
  // Get the branch
  const resp = await octokit.graphql<getBranchResponse>(
    `query($owner: String!, $repo: String!, $ref: String!) {
  repository(owner: $owner, name: $repo) {
    ref(qualifiedName: $ref) {
      target {
        ... on Commit {
          oid
          tree {
            oid
          }
        } 
      }
    }
  }
}`,
    {
      owner: input.owner,
      repo: input.repo,
      ref: input.branch,
    },
  );
  return resp.repository.ref;
};

type Err = {
  code: string;
};

const getFileContentAndMode = async (
  filePath: string,
  deleteIfNotExist: boolean,
): Promise<File> => {
  if (!deleteIfNotExist) {
    const [content, stats] = await Promise.all([
      readFile(filePath, "utf8"),
      stat(filePath),
    ]);
    return {
      path: filePath,
      content,
      mode: getFileMode(stats.mode),
      type: "blob",
    };
  }
  try {
    const stats = await stat(filePath);
    const content = await readFile(filePath, "utf8");
    return {
      path: filePath,
      content,
      mode: getFileMode(stats.mode),
      type: "blob",
    };
  } catch (error: unknown) {
    if (typeof error !== "object" || error === undefined) {
      throw error;
    }
    const err = error as Record<keyof Err, unknown>;
    if (typeof err.code !== "string" || err.code !== "ENOENT") {
      throw error;
    }
    // If the file does not exist, remove the file
    return {
      sha: null,
      path: filePath,
      mode: "100644",
      type: "blob",
    };
  }
};

const getFileMode = (mode: number): FileMode => {
  switch (mode & 0o170000) {
    case 0o100755: // executable file
      return "100755";
    case 0o040000: // directory
      return "040000";
    case 0o160000: // symlink
      return "160000";
    case 0o120000: // gitlink
      return "120000";
    default:
      return "100644";
  }
};

type getTreeResponse = {
  repository: {
    object: {
      tree: {
        oid: string;
      }
    };
  };
};

const getTree = async (
  octokit: GitHub,
  owner: string,
  repo: string,
  oid: string,
): Promise<string> => {
  // Get the branch
  const resp = await octokit.graphql<getTreeResponse>(
    `query($owner: String!, $repo: String!, $oid: GitObjectID!) {
  repository(owner: $owner, name: $repo) {
    object(oid: $oid) {
      ... on Commit {
        tree {
          oid
        }
      }
    }
  }
}`,
    {
      owner: owner,
      repo: repo,
      oid: oid,
    },
  );
  return resp.repository.object.tree.oid;
};
