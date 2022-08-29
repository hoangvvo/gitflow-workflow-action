// @ts-check
const core = require("@actions/core");
const github = require("@actions/github");
const assert = require("assert");
const { sendToSlack } = require("./integration-slack.js");
const { Config, octokit } = require("./shared.js");
const { tryMerge, isReleaseCandidate } = require("./utils.js");

exports.executeOnRelease = async function executeOnRelease() {
  if (!github.context.payload.pull_request?.merged) {
    console.log(`on-release:pull request is not merged. Exiting...`);
    return;
  }
  /**
   * Precheck
   * Check if the pull request has a release label, targeting main branch, and if it was merged
   */
  const pullRequestNumber = github.context.payload.pull_request?.number;
  assert(
    pullRequestNumber,
    `github.context.payload.pull_request?.number is not defined`
  );

  const { data: pullRequest } = await octokit.rest.pulls.get({
    ...Config.repo,
    pull_number: pullRequestNumber,
  });

  const releaseCandidateType = isReleaseCandidate(pullRequest, true);
  if (!releaseCandidateType) return;

  const currentBranch = pullRequest.head.ref;

  if (releaseCandidateType === "release") {
    /**
     * Creating a release
     */

    const version = currentBranch.substring("release/".length);

    /**
     * Merging the release branch back to the develop branch if needed
     */
    console.log(`on-release: release(${version}): Execute merge workflow`);
    await tryMerge(currentBranch, Config.developBranch);

    console.log(`on-release: release(${version}): Generating release notes`);
    const { data: latestRelease } = await octokit.rest.repos
      .getLatestRelease(Config.repo)
      .catch(() => ({ data: null }));

    const { data: releaseNotes } =
      await octokit.rest.repos.generateReleaseNotes({
        ...Config.repo,
        tag_name: version,
        target_commitish: Config.developBranch,
        previous_tag_name: latestRelease?.tag_name,
      });

    console.log(`on-release:release(${version}): Creating GitHub release`);
    await octokit.rest.repos.createRelease({
      ...Config.repo,
      tag_name: version,
      target_commitish: Config.prodBranch,
      name: releaseNotes.name,
      body: releaseNotes.body,
    });

    console.log(`on-release: success`);

    return;
  } else if (releaseCandidateType === "hotfix") {
    /**
     * Creating a hotfix release
     */
    const now = pullRequest.merged_at
      ? new Date(pullRequest.merged_at)
      : new Date();
    const version = `hotfix-${now.getFullYear()}${String(
      now.getMonth() + 1
    ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(
      now.getHours()
    ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

    /**
     * Merging the hotfix branch back to the develop branch if needed
     */
    console.log(`on-release: hotfix: Execute merge workflow`);
    await tryMerge(currentBranch, Config.developBranch);

    const { data: latestRelease } = await octokit.rest.repos
      .getLatestRelease(Config.repo)
      .catch(() => ({ data: null }));

    const { data: releaseNotes } =
      await octokit.rest.repos.generateReleaseNotes({
        ...Config.repo,
        tag_name: version,
        target_commitish: Config.developBranch,
        previous_tag_name: latestRelease?.tag_name,
      });

    console.log(`on-release: release(${version}): Creating GitHub release`);
    await octokit.rest.repos.createRelease({
      ...Config.repo,
      tag_name: version,
      target_commitish: Config.prodBranch,
      name: releaseNotes.name,
      body: releaseNotes.body,
    });

    console.log(`on-release: success`);

    return;
  }
};

exports.executePostRelease = async function executePostRelease() {
  /**
   * @type {import("@octokit/plugin-rest-endpoint-methods").RestEndpointMethodTypes["repos"]["createRelease"]["response"]["data"]}
   */
  const release = github.context.payload.release;
  console.log(`post-release: process release ${release.name}`);
  const slackInput = core.getInput("slack");
  if (slackInput) {
    /**
     * Slack integration
     */
    await sendToSlack(slackInput, release);
  }

  console.log(`post-release: success`);
};
