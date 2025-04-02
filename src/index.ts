import * as core from "@actions/core";
import * as github from "@actions/github";
import { executeOnRelease } from "./post-release.js";
import { createReleasePR } from "./release.js";
import { Config } from "./shared.js";
import { Result } from "./types.js";

const start = async () => {
  console.log(`gitflow-workflow-action: running with config`, Config);

  let res;

  if (
    github.context.eventName === "pull_request" &&
    github.context.payload.action === "closed"
  ) {
    console.log(
      `gitflow-workflow-action: Pull request closed. Running executeOnRelease...`,
    );
    res = await executeOnRelease();
  } else if (github.context.eventName === "workflow_dispatch") {
    console.log(
      `gitflow-workflow-action: Workflow dispatched. Running createReleasePR...`,
    );
    res = await createReleasePR();
  } else {
    console.log(
      `gitflow-workflow-action: does not match any conditions to run. Skipping...`,
    );
  }
  if (res) {
    console.log(
      `gitflow-workflow-action: Setting output: ${JSON.stringify(res)}`,
    );
    for (const key of Object.keys(res)) {
      core.setOutput(key, res[key as keyof Result]);
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
