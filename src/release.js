// @ts-check
const core = require("@actions/core");
const { Config, octokit } = require("./shared.js");

exports.createReleasePR = async function createReleasePR() {
  const version = core.getInput("version");

  console.log(`Checking release version`);
  if (!version) throw new Error(`Missing input.version`);

  console.log(`Generating release notes`);

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

  console.log(`Creating release branch`);
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

  console.log(`Creating Pull Request`);

  const { data: pullRequest } = await octokit.rest.pulls.create({
    ...Config.repo,
    title: `Release ${releaseNotes.name}`,
    body: releaseNotes.body,
    head: releaseBranch,
    base: Config.prodBranch,
    maintainer_can_modify: false,
  });

  console.log(`Pull request has been created at ${pullRequest.url}`);
};
