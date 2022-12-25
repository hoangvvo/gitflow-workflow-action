const core = require("@actions/core");
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
      core.summary.addHeading('Back-merge', 2).addRaw(`The ${headBranch} branch was successfully merge into ${baseBranch} branch.`)
    } catch (err) {
      // could not automatically merge
      // try creating a PR
      try {
        const { data: pullRequest } = await octokit.rest.pulls
        .create({
          ...Config.repo,
          base: baseBranch,
          head: headBranch,
          title: `Merge ${headBranch} branch into ${baseBranch}`,
          body: `In Gitflow, \`release\` and \`hotfix\` branches get merged back into \`develop\` branch.
See [Gitflow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) for more details.`,
        })  
        core.summary.addHeading('Back-merge', 2).addRaw(`A PR was created for back-merge, please review [here](${pullRequest.html_url})`)
      } catch (error) {
        core.error(`Couldn't perform back-merge! Merge error: ${err}, PR error ${error}`)
      }
      
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
    const message = `on-release: ${pullRequest.number} does not merge to main_branch. Exiting...`
    if (shouldLog) 
      console.log(message);
    
    core.summary.addHeading('Not release candidate', 2).addRaw(message)
    return false;
  }

  if (pullRequest.labels.some((label) => label.name === Constants.Release)) {
    return "release";
  }

  if (pullRequest.labels.some((label) => label.name === Constants.Hotfix))
    return "hotfix";

  const message = `on-release: pull request does not have either ${Constants.Release} or ${Constants.Hotfix} labels. Exiting...`
  if (shouldLog)
    console.log(message);
  
    core.summary.addHeading('Not release candidate', 2).addRaw(message)
  return false;
};
