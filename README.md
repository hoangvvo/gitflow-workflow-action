# gitflow-workflow-action

A GitHub actions that automate the [Gitflow workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) where one has a `develop` branch for continuous development and a `production` branch that would automatically deploy to production. In between that, a `release` branch is created to perform preparation tasks (such as bump package.json version for Node project) before being merged to `production` branch.

![Git Workflow](https://user-images.githubusercontent.com/40987398/187031062-099ef39e-9827-410c-851e-701be21f6cf2.svg)

Create `.github/workflows/post-release.yml`

```yaml
on:
  pull_request:
    branches:
      - main
    types:
      - closed

jobs:
  post_release:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    name: Post Release
    steps:
      - name: gitflow-workflow-action post-release
        uses: ./ # Uses an action in the root directory
        with:
          develop_branch: "develop"
          main_branch: "main"
          # if you want to post to slack
          slack_channel: "feature-rollout"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # if you want to post to slack
          SLACK_TOKEN: ${{ secrets.SLACK_TOKEN }}
```

Create `.github/workflows/pre-release.yml`

```yaml
on:
  workflow_dispatch:
    inputs:
      version:
        type: string
        required: true
        description: "semver version to release"

jobs:
  pre_release:
    runs-on: ubuntu-latest
    steps:
      - name: gitflow-workflow-action pre-release
        uses: ./
        with:
          develop_branch: "develop"
          main_branch: "main"
          version: ${{ inputs.version }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

This action does two things:

## Create "Deploy to production" PR dispatchable workflow

![image](https://user-images.githubusercontent.com/40987398/187032548-b51992fa-ae11-48e4-a4c7-1cd815d173f7.png)

This will create a PR that is meant to deploy to `production` branch. It will create a release note that contains all the new changes to the `develop` branch.

Then, it will create a new branch called `release/x.y.z` and create a PR from it. The reason why we do so is because we do not want new changes to `develop` to "sneak in" after the PR is created.

## Post-release hook

You should have your own deployment workflow as this action will not handle it. However, it completes the gitflow workflow (merge from `release` back to `develop`) and provides helpful actions like Post message to Slack.

### Post to Slack

It is often that an anouncement is made to a Slack channel after a release. To do so, specify `SLACK_TOKEN` env and `slack` input.

```yaml
jobs:
  post_release:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    name: Post Release
    steps:
      - name: gitflow-workflow-action post-release
        uses: hoangvvo/gitflow-workflow-action@v0
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
