// @ts-check
const core = require("@actions/core");
const github = require("@actions/github");
const { WebClient: SlackWebClient } = require("@slack/web-api");
const { Config, octokit } = require("./shared.js");

exports.executePostRelease = async function executePostRelease() {
  if (github.context.eventName !== "pull_request") {
    console.log(`Not a pull request merge. Exiting...`);
    return;
  }
  const pullRequestNumber = github.context.payload.pull_request?.number;
  if (!pullRequestNumber)
    throw new Error(
      `github.context.payload.pull_request?.number is not defined`
    );

  console.log(`Processing post-release after merging ${pullRequestNumber}`);

  const { data: pullRequest } = await octokit.rest.pulls.get({
    ...Config.repo,
    pull_number: pullRequestNumber,
  });

  if (pullRequest.base.ref !== Config.prodBranch) {
    console.log("Request does not merge to main_branch. Exiting...");
    return;
  }

  if (!pullRequest.merged) {
    console.log("Pull request is not merged. Exiting...");
    return;
  }

  if (!pullRequest.labels.some((label) => label.name === "release")) {
    console.log("Pull request does not have release label. Exiting...");
    return;
  }

  // release branch always has the format
  // `release/${version}`
  const releaseBranch = pullRequest.head.ref;
  const version = releaseBranch.substring("release/".length);

  // Merge back to develop branch
  const { data: compareCommitsResult } =
    await octokit.rest.repos.compareCommits({
      ...Config.repo,
      base: Config.developBranch,
      head: releaseBranch,
    });
  if (compareCommitsResult.status !== "identical") {
    console.log(
      "develop branch is not up to date with release branch. attempting to merge."
    );
    try {
      await octokit.rest.repos.merge({
        ...Config.repo,
        base: Config.developBranch,
        head: releaseBranch,
      });
    } catch (err) {
      // could not automatically merge
      // try creating a PR
      await octokit.rest.pulls
        .create({
          ...Config.repo,
          base: Config.developBranch,
          head: releaseBranch,
          title: `Merge release branch ${releaseBranch} to develop branch`,
          body: `Merge release branch back to develop branch.
  See [Gitflow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow)`,
        })
        .catch(() => {
          /** noop */
        });
    }
  } else {
    console.log(
      "develop branch is up to date with release branch. No need to merge back."
    );
  }

  // Create a release
  console.log(`Creating a release`);
  const { data: release } = await octokit.rest.repos.createRelease({
    ...Config.repo,
    tag_name: version,
    target_commitish: Config.prodBranch,
    generate_release_notes: true,
  });

  // Post to slack if needed
  const slackChannel = core.getInput("slack_channel");
  if (slackChannel) {
    console.log(`Posting to slack channel #${slackChannel}`);
    const slackToken = process.env.SLACK_TOKEN;
    if (!slackToken) throw new Error("process.env.SLACK_TOKEN is not defined");
    const slackWebClient = new SlackWebClient(slackToken);

    await slackWebClient.chat.postMessage({
      text: `*Release ${version} to ${Config.repo.owner}/${Config.repo.repo}*

${release.body}`,
      channel: slackChannel,
      icon_url: "https://avatars.githubusercontent.com/in/15368?s=88&v=4",
    });
  }

  // Merge back to develop branch
};
