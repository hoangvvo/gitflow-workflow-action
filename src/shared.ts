import * as core from "@actions/core";
import * as github from "@actions/github";
import { ReleaseType } from "semver";

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) throw new Error(`process.env.GITHUB_TOKEN is not defined`);

export const octokit = github.getOctokit(githubToken);

export const Config = {
  developBranch:
    core.getInput("develop_branch") || process.env.DEVELOP_BRANCH || "",
  prodBranch: core.getInput("main_branch") || process.env.MAIN_BRANCH || "",
  mergeBackFromProd:
    (core.getInput("merge_back_from_main") ||
      process.env.MERGE_BACK_FROM_MAIN) == "true",
  repo: {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
  },
  version: core.getInput("version") || process.env.VERSION || "",
  versionIncrement: (core.getInput("version_increment") ||
    process.env.VERSION_INCREMENT ||
    "") as ReleaseType,
  isDryRun: (core.getInput("dry_run") || process.env.DRY_RUN) == "true",
  releaseSummary:
    core.getInput("release_summary") || process.env.RELEASE_SUMMARY || "",
  releaseBranchPrefix: "release/",
  hotfixBranchPrefix: "hotfix/",
  slackOptionsStr: core.getInput("slack") || process.env.SLACK_OPTIONS,
};
