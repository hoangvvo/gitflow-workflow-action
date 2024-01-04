import * as core from "@actions/core";
import * as github from "@actions/github";
import { pullRequestAutoLabel, pullRequestLabelExplainer } from "./labeler.js";
import { executeOnRelease } from "./post-release.js";
import { createReleasePR } from "./release.js";

const start = async () => {
  /**
   * @type {Result | undefined}
   */
  let res;
  if (github.context.eventName === "pull_request") {
    if (github.context.payload.action === "closed") {
      console.log(
        `gitflow-workflow-action: Pull request closed. Running executeOnRelease...`,
      );
      res = await executeOnRelease();
    } else if (github.context.payload.action === "opened") {
      console.log(
        `gitflow-workflow-action: Pull request opened. Running pullRequestAutoLabel...`,
      );
      await pullRequestAutoLabel();
    } else if (github.context.payload.action === "labeled") {
      console.log(
        `gitflow-workflow-action: Pull request labeled. Running pullRequestLabelExplainer...`,
      );
      await pullRequestLabelExplainer();
    }
  } else if (github.context.eventName === "workflow_dispatch") {
    console.log(
      `gitflow-workflow-action: Workflow dispatched. Running createReleasePR...`,
    );
    res = await createReleasePR();
  } else {
    console.log(
      `gitflow-workflow-action: does not match any eventName. Skipping...`,
    );
  }
  if (res) {
    console.log(
      `gitflow-workflow-action: Setting output: ${JSON.stringify(res)}`,
    );
    for (const key of Object.keys(res)) {
      core.setOutput(key, res[key]);
    }
  }
};

start()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((err) => {
    core.setFailed(err.message);
    process.exitCode = 1;
  });
