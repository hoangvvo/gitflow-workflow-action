# gitflow-workflow-action

A GitHub actions that automate the [Gitflow workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) where one has a `develop` branch for continuous development and a `main` (production) branch that would automatically deploy to production. In between that, a `release` branch is created from `develop` to perform release preparation tasks before being merged to `main` branch. Occasionally, a `hotfix` branch is created from `main` for hot fixes.

![Gitflow](https://user-images.githubusercontent.com/40987398/187112231-30c0f1f1-8153-44f7-82b3-df6ff475e525.svg)

## Create "Deploy to production" PR

![image](https://user-images.githubusercontent.com/40987398/187032548-b51992fa-ae11-48e4-a4c7-1cd815d173f7.png)

We can add a workflow that creates a PR for `release`. It will create a PR with release note that contains all the new changes in the body. The new branch would be called `release/x.y.z`.

This basically "freezes" the `develop` branch for releases. Other PRs can be merged to `develop` during the `release` branch lifetime without affecting it.

Create `.github/workflows/create-release.yml`

```yaml
on:
  workflow_dispatch:
    inputs:
      version:
        type: string
        required: true
        description: "Version to release"

name: Create release

jobs:
  pre_release:
    runs-on: ubuntu-latest
    steps:
      - name: gitflow-workflow-action create release
        uses: hoangvvo/gitflow-workflow-action
        with:
          develop_branch: "develop"
          main_branch: "main"
          version: ${{ inputs.version }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Workflows for release lifecycle

Create `.github/workflows/post-release.yml`

```yaml
on:
  pull_request:
    types:
      - opened
      - closed
      - labeled

name: Release workflows

jobs:
  release_workflow:
    runs-on: ubuntu-latest
    steps:
      - name: gitflow-workflow-action release workflows
        uses: hoangvvo/gitflow-workflow-action
        with:
          develop_branch: "develop"
          main_branch: "main"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

This workflow does several things:

- Autolabel `release` and `hotfix` according to the branch name.
- If the PR is labelled `release` or `hotfix` and merged to `main`, it will create a release, merge back to `develop` branch, and trigger integrations. This is the process in Gitflow.

Note: It does not handle the deployment process. That is for your team to implement separately.

### Integration: Post to Slack

It is often that an anouncement is made to a Slack channel after a release. To do so, specify `SLACK_TOKEN` env and `slack` input.

```yaml
jobs:
  release_workflow:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - name: gitflow-workflow-action release workflows
        uses: hoangvvo/gitflow-workflow-action
        with:
          develop_branch: "develop"
          main_branch: "main"
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

## License

[MIT](LICENSE)
