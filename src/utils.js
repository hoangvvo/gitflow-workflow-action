const { Config, octokit } = require("./shared");

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
