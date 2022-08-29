// @ts-check
const github = require("@actions/github");
const assert = require("assert");
const { Constants } = require("./constants");
const { octokit, Config } = require("./shared");

exports.pullRequestAutoLabel = async function pullRequestAutoLabel() {
  const pullRequestNumber = github.context.payload.pull_request?.number;
  assert(
    pullRequestNumber,
    `github.context.payload.pull_request?.number is not defined`
  );

  const { data: pullRequest } = await octokit.rest.pulls.get({
    ...Config.repo,
    pull_number: pullRequestNumber,
  });

  if (pullRequest.head.ref.startsWith("hotfix/")) {
    await octokit.rest.issues.addLabels({
      ...Config.repo,
      issue_number: pullRequest.number,
      labels: [Constants.Hotfix],
    });
  } else if (pullRequest.head.ref.startsWith("release/")) {
    await octokit.rest.issues.addLabels({
      ...Config.repo,
      issue_number: pullRequest.number,
      labels: [Constants.Release],
    });
  }
};

exports.pullRequestLabelExplainer = async function labelExplainer() {
  const pullRequestNumber = github.context.payload.pull_request?.number;
  assert(
    pullRequestNumber,
    `github.context.payload.pull_request?.number is not defined`
  );

  const { data: pullRequest } = await octokit.rest.pulls.get({
    ...Config.repo,
    pull_number: pullRequestNumber,
  });

  if (pullRequest.base.ref !== Config.prodBranch) {
    console.log(
      `label-explainer: ${pullRequestNumber} does not merge to main_branch. Exiting...`
    );
    return;
  }

  await octokit.rest.issues.createComment({
    ...Config.repo,
    issue_number: pullRequestNumber,
    body: `Merging this pull request will trigger Gitflow release actions. A release would be created and this branch would be merged back to ${Config.developBranch} if needed.
See [Gitflow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) for more details.`,
  });
};
