const core = require("@actions/core");
const github = require("@actions/github");

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) throw new Error(`process.env.GITHUB_TOKEN is not defined`);

exports.octokit = github.getOctokit(githubToken);

exports.Config = {
  developBranch: core.getInput("develop_branch"),
  prodBranch: core.getInput("main_branch"),
  repo: {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
  },
};
