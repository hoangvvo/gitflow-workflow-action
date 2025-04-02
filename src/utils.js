import { PR_EXPLAIN_MESSAGE } from "./constants.js";
import { Config, octokit } from "./shared.js";

/**
 *
 * @param {string} headBranch
 * @param {string} baseBranch
 */
export async function tryMerge(headBranch, baseBranch) {
  console.log(
    `Trying to merge ${headBranch} branch into ${baseBranch} branch.`,
  );

  const { data: compareCommitsResult } =
    await octokit.rest.repos.compareCommits({
      ...Config.repo,
      base: baseBranch,
      head: headBranch,
    });

  if (compareCommitsResult.status !== "identical") {
    console.log(
      `${headBranch} branch is not up to date with ${baseBranch} branch. Attempting to merge.`,
    );
    try {
      await octokit.rest.repos.merge({
        ...Config.repo,
        base: baseBranch,
        head: headBranch,
      });
    } catch {
      // could not automatically merge
      // try creating a PR
      await octokit.rest.pulls
        .create({
          ...Config.repo,
          base: baseBranch,
          head: headBranch,
          title: `Merge ${headBranch} branch into ${baseBranch}`,
          body: `In Gitflow, \`release\` and \`hotfix\` branches get merged back into \`develop\` branch.
See [Gitflow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) for more details.`,
        })
        .catch(() => {
          /** noop */
        });
    }
  } else {
    console.log(
      `${headBranch} branch is already up to date with ${baseBranch} branch.`,
    );
  }
}

/**
 *
 * @param {import("@octokit/plugin-rest-endpoint-methods").RestEndpointMethodTypes["pulls"]["get"]["response"]["data"]} pullRequest
 */
export function isReleaseCandidate(pullRequest, shouldLog = false) {
  if (pullRequest.base.ref !== Config.prodBranch) {
    if (shouldLog)
      console.log(
        `on-release: ${pullRequest.number} does not merge to main_branch. Exiting...`,
      );
    return false;
  }

  if (pullRequest.head.ref.startsWith(Config.releaseBranchPrefix)) {
    return "release";
  }

  if (pullRequest.head.ref.startsWith(Config.hotfixBranchPrefix)) {
    return "hotfix";
  }

  if (shouldLog)
    console.log(
      `on-release: pull request does not match either release or hotfix branch pattern. Exiting...`,
    );
  return false;
}

/**
 * @param {number} pullRequestNumber
 */
export async function createExplainComment(pullRequestNumber) {
  const existingComments = await octokit.rest.issues.listComments({
    ...Config.repo,
    issue_number: pullRequestNumber,
  });

  const existingExplainComment = existingComments.data.find(
    (comment) => comment.body === PR_EXPLAIN_MESSAGE,
  );

  if (existingExplainComment) {
    console.log(
      `on-release: pull request ${pullRequestNumber} already has an explain comment.`,
    );
    return;
  }

  await octokit.rest.issues.createComment({
    ...Config.repo,
    issue_number: pullRequestNumber,
    body: PR_EXPLAIN_MESSAGE,
  });
}

/**
 * @param {string} text
 */
export const removeHtmlComments = (text) => text.replace(/<!--.*?-->/gs, "");
