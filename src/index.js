// @ts-check
const core = require("@actions/core");
const github = require("@actions/github");
const {
  pullRequestAutoLabel,
  pullRequestLabelExplainer,
} = require("./labeler.js");
const { executeOnRelease } = require("./post-release.js");
const { createReleasePR } = require("./release.js");

const start = async () => {
  if (github.context.eventName === "pull_request") {
    if (github.context.payload.action === "closed") {
      await executeOnRelease();
      return;
    } else if (github.context.payload.action === "opened") {
      await pullRequestAutoLabel();
      return;
    } else if (github.context.payload.action === "labeled") {
      await pullRequestLabelExplainer();
      return;
    }
  } else if (github.context.eventName === "workflow_dispatch") {
    await createReleasePR();
    return;
  }
  console.log(
    `gitflow-workflow-action: does not match any eventName. Skipping...`
  );
};

start()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((err) => {
    core.setFailed(err.message);
    process.exitCode = 1;
  });
