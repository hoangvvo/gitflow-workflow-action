import * as github from "@actions/github";
import { components } from "@octokit/openapi-types";
import assert from "assert";
import { sendToSlack } from "./integration-slack.js";
import { Config, octokit } from "./shared.js";
import { Result, SlackIntegrationOptions } from "./types.js";
import { isReleaseCandidate, tryMerge } from "./utils.js";

async function executeOnRelease(): Promise<Result> {
  if (Config.isDryRun) {
    console.log(`on-release: dry run. Exiting...`);
    return {
      type: "none",
    };
  }

  const pullRequest = github.context.payload
    .pull_request as components["schemas"]["pull-request"];

  if (!pullRequest) {
    console.log(`on-release: pull request is not defined. Exiting...`);
    return {
      type: "none",
    };
  }

  if (!pullRequest.merged) {
    console.log(`on-release: pull request is not merged. Exiting...`);
    return {
      type: "none",
    };
  }

  /**
   * Precheck
   * Check if the pull request has a release label, targeting main branch, and if it was merged
   */
  const pullRequestNumber = pullRequest.number;
  assert(
    pullRequestNumber,
    `github.context.payload.pull_request?.number is not defined`,
  );

  const releaseCandidateType = isReleaseCandidate(pullRequest, true);
  if (!releaseCandidateType)
    return {
      type: "none",
    };

  const currentBranch = pullRequest.head.ref;

  let version = "";

  if (releaseCandidateType === "release") {
    /**
     * Creating a release
     */
    version = currentBranch.substring(Config.releaseBranchPrefix.length);
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

  console.log(
    `on-release: ${releaseCandidateType}(${version}): Generating release`,
  );

  const pullRequestBody = pullRequest.body;

  assert(pullRequestBody, `pull request body is not defined`);

  const { data: release } = await octokit.rest.repos.createRelease({
    ...Config.repo,
    tag_name: version,
    target_commitish: Config.prodBranch,
    name: version,
    body: pullRequestBody,
  });

  /**
   * Merging the release or hotfix branch back to the develop branch if needed
   */
  console.log(
    `on-release: ${releaseCandidateType}(${version}): Execute merge workflow`,
  );

  await tryMerge(
    Config.mergeBackFromProd ? Config.prodBranch : currentBranch,
    Config.developBranch,
  );

  console.log(`on-release: success`);

  console.log(`post-release: process release ${release.name}`);
  if (Config.slackOptionsStr) {
    let slackOpts: SlackIntegrationOptions;
    try {
      slackOpts = JSON.parse(Config.slackOptionsStr);
    } catch {
      throw new Error(
        `integration(slack): Could not parse ${Config.slackOptionsStr}`,
      );
    }
    /**
     * Slack integration
     */
    await sendToSlack(slackOpts, release);
  }

  console.log(`post-release: success`);

  return {
    type: releaseCandidateType,
    version,
    release_url: release.html_url,
  };
}

export { executeOnRelease };
