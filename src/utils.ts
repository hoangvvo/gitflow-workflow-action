import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { PR_EXPLAIN_MESSAGE } from "./constants.js";
import { Config, octokit } from "./shared.js";

export async function tryMerge(headBranch: string, baseBranch: string) {
  console.log(
    `Trying to merge ${headBranch} branch into ${baseBranch} branch.`,
  );

  let compareCommitsResult;

  try {
    const { data } = await octokit.rest.repos.compareCommits({
      ...Config.repo,
      base: baseBranch,
      head: headBranch,
    });
    compareCommitsResult = data;
  } catch (error) {
    console.error(`Error comparing commits: ${error}. Skipping merge.`);
    return;
  }

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

export function isReleaseCandidate(
  pullRequest: RestEndpointMethodTypes["pulls"]["get"]["response"]["data"],
  shouldLog = false,
) {
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

export async function createExplainComment(pullRequestNumber: number) {
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

export const removeHtmlComments = (text: string) =>
  text.replace(/<!--.*?-->/gs, "");
