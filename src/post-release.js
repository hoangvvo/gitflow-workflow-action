// @ts-check
import * as core from "@actions/core";
import * as github from "@actions/github";
import assert from "assert";
import { sendToSlack } from "./integration-slack";
import { Config, octokit } from "./shared.js";
import { isReleaseCandidate, tryMerge } from "./utils.js";

async function executeOnRelease() {
  if (!github.context.payload.pull_request?.merged) {
    console.log(`on-release: pull request is not merged. Exiting...`);
    return;
  }

  /**
   * Precheck
   * Check if the pull request has a release label, targeting main branch, and if it was merged
   */
  const pullRequestNumber = github.context.payload.pull_request?.number;
  assert(
    pullRequestNumber,
    `github.context.payload.pull_request?.number is not defined`,
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
      "0",
    )}${String(now.getDate()).padStart(2, "0")}${String(
      now.getHours(),
    ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  }

  /**
   * Merging the release or hotfix branch back to the develop branch if needed
   */
  console.log(
    `on-release: ${releaseCandidateType}(${version}): Execute merge workflow`,
  );
  await tryMerge(currentBranch, Config.developBranch);

  console.log(`on-release: release(${version}): Generating release notes`);

  const pullRequestBody = pullRequest.body;

  assert(pullRequestBody, `pull request body is not defined`);

  const { data: release } = await octokit.rest.repos.createRelease({
    ...Config.repo,
    tag_name: version,
    target_commitish: Config.prodBranch,
    name: version,
    body: pullRequestBody,
  });

  console.log(`on-release: success`);

  console.log(`post-release: process release ${release.name}`);
  const slackInput = core.getInput("slack") || process.env.SLACK_OPTIONS;
  if (slackInput) {
    /**
     * Slack integration
     */
    await sendToSlack(slackInput, release);
  }

  console.log(`post-release: success`);
}

export { executeOnRelease };
