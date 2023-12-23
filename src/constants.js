const { Config } = require("./shared");

exports.Constants = {
  Release: "release",
  Hotfix: "hotfix",
};

exports.PR_EXPLAIN_MESSAGE = `Merging this pull request will trigger Gitflow release actions. A release would be created and this branch would be merged back to ${Config.developBranch} if needed.
See [Gitflow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) for more details.`;
