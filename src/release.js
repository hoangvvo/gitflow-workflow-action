// @ts-check
import * as core from "@actions/core";
import assert from "assert";
import { Constants } from "./constants.js";
import { Config, octokit } from "./shared.js";
import { createExplainComment } from "./utils.js";

/**
 * @returns {Promise<Result>}
 */
export async function createReleasePR() {
  const version = core.getInput("version");

  console.log(`create_release: Checking release version`);
  assert(version, "input.version is not defined");

  console.log(`create_release: Generating release notes`);

  // developBranch and mainBranch are almost identical
  // so we can use developBranch for ahead-of-time release note
  const { data: latestRelease } = await octokit.rest.repos
    .getLatestRelease(Config.repo)
    .catch(() => ({ data: null }));

  const { data: releaseNotes } = await octokit.rest.repos.generateReleaseNotes({
    ...Config.repo,
    tag_name: version,
    target_commitish: Config.developBranch,
    previous_tag_name: latestRelease?.tag_name,
  });

  console.log(`create_release: Creating release branch`);
  const releaseBranch = `release/${version}`;

  const developBranchSha = (
    await octokit.rest.repos.getBranch({
      ...Config.repo,
      branch: Config.developBranch,
    })
  ).data.commit.sha;

  // create release branch from latest sha of develop branch
  await octokit.rest.git.createRef({
    ...Config.repo,
    ref: `refs/heads/${releaseBranch}`,
    sha: developBranchSha,
  });

  console.log(`create_release: Creating Pull Request`);

  const { data: pullRequest } = await octokit.rest.pulls.create({
    ...Config.repo,
    title: `Release ${releaseNotes.name || version}`,
    body: `${releaseNotes.body}
    
## Release summary
`,
    head: releaseBranch,
    base: Config.prodBranch,
    maintainer_can_modify: false,
  });

  await octokit.rest.issues.addLabels({
    ...Config.repo,
    issue_number: pullRequest.number,
    labels: [Constants.Release],
  });

  await createExplainComment(pullRequest.number);

  console.log(
    `create_release: Pull request has been created at ${pullRequest.html_url}`,
  );

  return {
    type: "release",
    pull_number: pullRequest.number,
    version,
    release_branch: releaseBranch,
  };
}
