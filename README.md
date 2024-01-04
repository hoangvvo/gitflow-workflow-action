# gitflow-workflow-action

A GitHub actions that automate the [Gitflow workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) where one has a `develop` branch for continuous development and a `main` (production) branch that would automatically deploy to production. In between that, a `release` branch is created from `develop` to perform release preparation tasks before being merged to `main` branch. Occasionally, a `hotfix` branch is created from `main` for hot fixes.

![Gitflow](https://user-images.githubusercontent.com/40987398/187112231-30c0f1f1-8153-44f7-82b3-df6ff475e525.svg)

## Usage

Create `.github/workflows/release.yml`:

```yaml
on:
  workflow_dispatch:
    inputs:
      version:
        type: string
        required: true
        description: "Version to release"
  pull_request:
    types:
      - opened
      - closed
      - labeled

name: Release

jobs:
  release_workflow:
    runs-on: ubuntu-latest
    steps:
      - name: gitflow-workflow-action release workflows
        uses: hoangvvo/gitflow-workflow-action@<TAG>
        with:
          develop_branch: "develop"
          main_branch: "main"
          merge_back_from_main: false
          version: ${{ inputs.version }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Name                   | Description                                                                                                                                                | Default   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `develop_branch`       | Name of the develop branch                                                                                                                                 | `develop` |
| `main_branch`          | Name of the main branch                                                                                                                                    | `main`    |
| `merge_back_from_main` | If `"true"`, there will be a merge back from `main` instead of the release branch to `develop` after a release is created                                  | `"false"` |
| `version`              | Version to release                                                                                                                                         |           |
| `dry_run`              | If `"true"`, the action will not create any PRs or releases. It will only print out the steps it would take and some outputs like pull_numbers_in_release. | `"false"` |
| `release_summary`      | Specify the release summary to be put in the last section of the release PR                                                                                | `""`      |

Alternatively, the following environment variables can be used: `DEVELOP_BRANCH`, `MAIN_BRANCH`, `MERGE_BACK_FROM_MAIN`, `VERSION`, `DRY_RUN`, `RELEASE_SUMMARY`.

## Outputs

Depending on the workflow types, some outputs might be present:

| Name                      | Description                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `type`                    | Type of the release: `release`, `hotfix`, `none`                                                                           |
| `version`                 | Version of the release.                                                                                                    |
| `pull_number`             | Pull request number. (only for `workflow_dispatch`)                                                                        |
| `pull_numbers_in_release` | Comma separated pull request numbers as shown in the What's changed section of the release. (only for `workflow_dispatch`) |
| `release_branch`          | Name of the release branch. (only after merging release PR)                                                                |
| `release_url`             | URL to the release page. (only after merging release PR)                                                                   |
| `latest_release_tag_name` | Name of the latest release tag (only for `workflow_dispatch`).                                                             |

## Workflows

There are two different workflows covered by this action:

### Create "Deploy to production" PR

![image](https://user-images.githubusercontent.com/40987398/187032548-b51992fa-ae11-48e4-a4c7-1cd815d173f7.png)

This applies when this workflow is triggered from the "Run workflow" window (`workflow_dispatch`).

The process of creating a release start with creating a PR with release note that contains all the new changes in the body. The new branch would be called `release/x.y.z`.

This basically "freezes" the `develop` branch for releases. Other PRs can be merged to `develop` during the `release` branch lifetime without affecting it.

### Workflows for release lifecycle

This detects when the pull request created with the use case above.

This workflow does several things:

- Autolabel `release` and `hotfix` according to the branch name.
- If the PR is labelled `release` or `hotfix` and merged to `main`, it will create a release, merge back to `develop` branch, and trigger integrations. This is the process in Gitflow.

Note: It does not handle the deployment process. That is for your team to implement separately.

## Integration: Post to Slack

It is often that an anouncement is made to a Slack channel after a release. To do so, specify `SLACK_TOKEN` env and `slack` input.

Alternatively, you can also use the environment variable `SLACK_OPTIONS` instead of `slack` input.

```yaml
jobs:
  release_workflow:
    steps:
      - name: gitflow-workflow-action release workflows
        uses: hoangvvo/gitflow-workflow-action@<TAG>
        with:
          slack: >
            {
              "channel": "hoang-test",
              "username_mapping": {
                "hoangvvo": "U03B3E4UPV3"
              }
            }
        env:
          SLACK_TOKEN: ${{ secrets.SLACK_TOKEN }}
```

## Example: Prefill release summary

Using the `pull_numbers_in_release` output and dry run mode, you can prefill the PR body with the release summary depending on your PR template.

Let's assume the PR template is:

```md
## What does this PR do?

xxx <-- we want to extract this

## How should this be manually tested?

xxx

## What are the requirements to deploy to production?

xxx

## Any background context you want to provide beyond Shortcut?

xxx

## Screenshots (if appropriate)

xxx
```

```yaml
jobs:
  release_workflow:
    runs-on: ubuntu-latest
    steps:
      - id: release_workflow_dry_run
        name: gitflow-workflow-action release workflows
        uses: hoangvvo/gitflow-workflow-action@<TAG>
        with:
          develop_branch: "develop"
          main_branch: "main"
          dry_run: true

      - id: generate_pr_summary
        name: generate pr summary
        if: ${{ steps.release_workflow_dry_run.outputs.type == 'release' and steps.release_workflow_dry_run.outputs.pull_numbers_in_release }}
        uses: actions/github-script@v7
        with:
          scripts: |
            const pull_numbers_in_release = "${{ steps.release_workflow_dry_run.outputs.pull_numbers_in_release }}";
            const mergedPrNumbers = Array.from(new Set(pull_numbers_in_release.split(',').map(Number)));
            // Get the PRs and parse the release summary
            const mergedPrs = await Promise.all(mergedPrNumbers.map(async (prNumber) => {
              const pr = await github.rest.pulls.get({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: prNumber
              });
              if (!pr.data.body) {
                return;
              }
              const regex = /\#\# What does this PR do\?([\s\S]*?)\n\#\#/gm;
              let match = regex.exec(pr.data.body)?.[1]?.trim();
              // try to remove empty lines
              match = match?.split('\n').map(s => s.trim()).filter(Boolean).map(
                s => s.startsWith('-') || s.startsWith('*') ? s : `* ${s}`
              ).join('\n');
              return `${pr.data.title}\n${match}`;
            })).then((prs) => prs.filter(Boolean));
            const releaseSummary = mergedPrs.join('\n\n');
            return { releaseSummary };

      - id: release_workflow
        name: gitflow-workflow-action release workflows
        uses: hoangvvo/gitflow-workflow-action@<TAG>
        with:
          develop_branch: "develop"
          main_branch: "main"
          merge_back_from_main: false
          version: ${{ inputs.version }}
          release_summary: ${{ steps.generate_pr_summary.outputs.releaseSummary }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## License

[MIT](LICENSE)
