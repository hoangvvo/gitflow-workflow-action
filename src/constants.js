import { Config } from "./shared.js";

export const PR_EXPLAIN_MESSAGE = `Merging this pull request will trigger Gitflow release actions. A release would be created and ${
  Config.mergeBackFromProd ? `${Config.prodBranch}` : "this branch"
} would be merged back to ${Config.developBranch} if needed.
See [Gitflow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) for more details.`;
