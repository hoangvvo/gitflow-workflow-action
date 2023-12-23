import * as core from "@actions/core";
import * as github from "@actions/github";

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) throw new Error(`process.env.GITHUB_TOKEN is not defined`);

export const octokit = github.getOctokit(githubToken);

export const Config = {
  developBranch: core.getInput("develop_branch"),
  prodBranch: core.getInput("main_branch"),
  mergeBackFromProd: !!core.getInput("merge_back_from_main"),
  repo: {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
  },
};
