// @ts-check
import * as github from "@actions/github";
import assert from "assert";
import { Constants, PR_EXPLAIN_MESSAGE } from "./constants";
import { Config, octokit } from "./shared.js";
import { isReleaseCandidate } from "./utils.js";

export async function pullRequestAutoLabel() {
  const pullRequestNumber = github.context.payload.pull_request?.number;
  assert(
    pullRequestNumber,
    `github.context.payload.pull_request?.number is not defined`,
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
}

export async function pullRequestLabelExplainer() {
  const pullRequestNumber = github.context.payload.pull_request?.number;
  assert(
    pullRequestNumber,
    `github.context.payload.pull_request?.number is not defined`,
  );

  const { data: pullRequest } = await octokit.rest.pulls.get({
    ...Config.repo,
    pull_number: pullRequestNumber,
  });

  if (isReleaseCandidate(pullRequest)) {
    await octokit.rest.issues.createComment({
      ...Config.repo,
      issue_number: pullRequestNumber,
      body: PR_EXPLAIN_MESSAGE,
    });
  }
}
