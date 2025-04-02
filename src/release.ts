// @ts-check
import semverInc from "semver/functions/inc.js";
import { Config, octokit } from "./shared.js";
import { Result } from "./types.js";
import { createExplainComment } from "./utils.js";

export async function createReleasePR(): Promise<Result> {
  const isDryRun = Config.isDryRun;

  const developBranchSha = (
    await octokit.rest.repos.getBranch({
      ...Config.repo,
      branch: Config.developBranch,
    })
  ).data.commit.sha;

  console.log(
    `create_release: Generating release notes for ${developBranchSha}`,
  );

  // developBranch and mainBranch are almost identical
  // so we can use developBranch for ahead-of-time release note
  const { data: latestRelease } = await octokit.rest.repos
    .getLatestRelease(Config.repo)
    .catch(() => ({ data: null }));

  const latest_release_tag_name = latestRelease?.tag_name;

  let version: string;
  if (Config.version) {
    version = Config.version;
  } else if (Config.versionIncrement) {
    const increasedVersion = semverInc(
      latest_release_tag_name || "0.0.0",
      Config.versionIncrement,
      { loose: true },
    );
    if (!increasedVersion) {
      throw new Error(
        `create_release: Could not increment version ${latest_release_tag_name} with ${Config.versionIncrement}`,
      );
    }
    version = increasedVersion;
  } else {
    version = developBranchSha;
  }

  const { data: releaseNotes } = await octokit.rest.repos.generateReleaseNotes({
    ...Config.repo,
    tag_name: version,
    target_commitish: Config.developBranch,
    previous_tag_name: latest_release_tag_name,
  });

  const releasePrBody = `${releaseNotes.body}
    
## Release summary

${Config.releaseSummary}
  `;

  const releaseBranch = `${Config.releaseBranchPrefix}${version}`;
  let pull_number;

  if (!isDryRun) {
    console.log(`create_release: Creating release branch`);

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
      body: releasePrBody,
      head: releaseBranch,
      base: Config.prodBranch,
      maintainer_can_modify: false,
    });

    pull_number = pullRequest.number;

    await octokit.rest.issues.addLabels({
      ...Config.repo,
      issue_number: pullRequest.number,
      labels: ["release"],
    });

    await createExplainComment(pullRequest.number);

    console.log(
      `create_release: Pull request has been created at ${pullRequest.html_url}`,
    );
  } else {
    console.log(
      `create_release: Dry run: would have created release branch ${releaseBranch} and PR with body:\n${releasePrBody}`,
    );
  }

  // Parse the PR body for PR numbers
  let mergedPrNumbers = (releaseNotes.body.match(/pull\/\d+/g) || []).map(
    (prNumber) => Number(prNumber.replace("pull/", "")),
  );
  // remove duplicates due to the "New contributors" section
  mergedPrNumbers = Array.from(new Set(mergedPrNumbers)).sort();

  return {
    type: "release",
    pull_number: pull_number,
    pull_numbers_in_release: mergedPrNumbers.join(","),
    version,
    release_branch: releaseBranch,
    latest_release_tag_name,
  };
}
