const { Constants } = require("./constants");
const { Config, octokit } = require("./shared");

/**
 *
 * @param {string} headBranch
 * @param {string} baseBranch
 */
exports.tryMerge = async function tryMerge(headBranch, baseBranch) {
  const { data: compareCommitsResult } =
    await octokit.rest.repos.compareCommits({
      ...Config.repo,
      base: baseBranch,
      head: headBranch,
    });

  if (compareCommitsResult.status !== "identical") {
    console.log(
      `${headBranch} branch is not up to date with ${baseBranch} branch. Attempting to merge.`
    );
    try {
      await octokit.rest.repos.merge({
        ...Config.repo,
        base: baseBranch,
        head: headBranch,
      });
    } catch (err) {
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
      `${headBranch} branch is already up to date with ${baseBranch} branch.`
    );
  }
};

/**
 *
 * @param {import("@octokit/plugin-rest-endpoint-methods").RestEndpointMethodTypes["pulls"]["get"]["response"]["data"]} pullRequest
 */
exports.isReleaseCandidate = function isReleaseCandidate(
  pullRequest,
  shouldLog = false
) {
  if (pullRequest.base.ref !== Config.prodBranch) {
    if (shouldLog)
      console.log(
        `on-release: ${pullRequest.number} does not merge to main_branch. Exiting...`
      );
    return false;
  }

  if (pullRequest.labels.some((label) => label.name === Constants.Release)) {
    return "release";
  }

  if (pullRequest.labels.some((label) => label.name === Constants.Hotfix))
    return "hotfix";

  if (shouldLog)
    console.log(
      `on-release: pull request does not have either ${Constants.Release} or ${Constants.Hotfix} labels. Exiting...`
    );
  return false;
};
