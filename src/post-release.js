// @ts-check
const core = require("@actions/core");
const github = require("@actions/github");
const { WebClient: SlackWebClient } = require("@slack/web-api");
const { Config, octokit } = require("./shared.js");

exports.executePostRelease = async function executePostRelease() {
  /**
   * Precheck
   * Check if the pull request has a release label, targeting main branch, and if it was merged
   */

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
    console.log("PR does not merge to main_branch. Exiting...");
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

  const releaseBranch = pullRequest.head.ref;
  const version = releaseBranch.substring("release/".length);

  /**
   * Merging the release branch back to the develop branch if needed
   */

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

  /**
   * Creating a release
   */

  console.log(`Creating release ${version}`);
  const { data: latestRelease } = await octokit.rest.repos
    .getLatestRelease(Config.repo)
    .catch(() => ({ data: null }));

  const { data: releaseNotes } = await octokit.rest.repos.generateReleaseNotes({
    ...Config.repo,
    tag_name: version,
    target_commitish: Config.developBranch,
    previous_tag_name: latestRelease?.tag_name,
  });

  await octokit.rest.repos.createRelease({
    ...Config.repo,
    tag_name: version,
    target_commitish: Config.prodBranch,
    body: releaseNotes.body,
  });

  /**
   * Slack integration
   */

  const slackStr = core.getInput("slack");
  if (slackStr) {
    const slackOpts = JSON.parse("slack");

    console.log(`Posting to slack channel #${slackOpts.channel}`);
    const slackToken = process.env.SLACK_TOKEN;
    if (!slackToken) throw new Error("process.env.SLACK_TOKEN is not defined");

    const slackWebClient = new SlackWebClient(slackToken);

    const username_mapping = slackOpts["username_mapping"] || {};

    let releaseBody = releaseNotes.body;

    for (const [username, slackUserId] of Object.entries(username_mapping)) {
      releaseBody = releaseBody.replaceAll(`@${username}`, `<@${slackUserId}>`);
    }

    await slackWebClient.chat.postMessage({
      text: `*[Release ${version} to ${Config.repo.owner}/${Config.repo.repo}](${pullRequest.url})*

      ${releaseBody}`,
      channel: slackOpts.channel,
      icon_url: "https://avatars.githubusercontent.com/in/15368?s=88&v=4",
    });
  }
};
