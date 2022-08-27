// @ts-check
const core = require("@actions/core");
const github = require("@actions/github");
const { executePostRelease } = require("./post-release.js");
const { createReleasePR } = require("./pre-release.js");

const start = async () => {
  if (github.context.eventName === "pull_request") {
    await executePostRelease();
  } else if (github.context.eventName === "workflow_dispatch") {
    await createReleasePR();
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
