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

  let version = "";

  if (releaseCandidateType === "release") {
    /**
     * Creating a release
     */

    version = currentBranch.substring("release/".length);
  } else if (releaseCandidateType === "hotfix") {
    /**
     * Creating a hotfix release
     */
    const now = pullRequest.merged_at
      ? new Date(pullRequest.merged_at)
      : new Date();
    version = `hotfix-${now.getFullYear()}${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}${String(now.getDate()).padStart(2, "0")}${String(
      now.getHours()
    ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  }

  /**
   * Merging the release or hotfix branch back to the develop branch if needed
   */
  console.log(
    `on-release: ${releaseCandidateType}(${version}): Execute merge workflow`
  );
  await tryMerge(currentBranch, Config.developBranch);

  console.log(`on-release: release(${version}): Generating release notes`);
  const { data: latestRelease } = await octokit.rest.repos
    .getLatestRelease(Config.repo)
    .catch(() => ({ data: null }));

  const { data: releaseNotes } = await octokit.rest.repos.generateReleaseNotes({
    ...Config.repo,
    tag_name: version,
    target_commitish: Config.prodBranch,
    previous_tag_name: latestRelease?.tag_name,
  });

  let releaseNotesBody = releaseNotes.body;

  const pullRequestBody = pullRequest.body;
  if (pullRequestBody) {
    // try to extract release summary
    const lines = pullRequestBody.split(`\n`);
    const sepIndex = lines.findIndex((line) => line.startsWith("---"));
    if (sepIndex !== -1) {
      const summary = lines.slice(sepIndex + 1).join(`\n`);
      releaseNotesBody = `${releaseNotesBody}

${summary}`;
    }
  }

  await octokit.rest.repos.createRelease({
    ...Config.repo,
    tag_name: version,
    target_commitish: Config.prodBranch,
    name: releaseNotes.name || version,
    body: releaseNotesBody,
  });

  console.log(`on-release: success`);
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
