// @ts-check
const { WebClient: SlackWebClient } = require("@slack/web-api");
const { Config } = require("./shared.js");

/**
 *
 * @param {string} slackInput
 * @param {import("@octokit/plugin-rest-endpoint-methods").RestEndpointMethodTypes["repos"]["createRelease"]["response"]["data"] } release
 */
exports.sendToSlack = async (slackInput, release) => {
  let slackOpts;
  try {
    slackOpts = JSON.parse(slackInput);
  } catch (err) {
    throw new Error(`integration(slack): Could not parse ${slackInput}`);
  }
  console.log(
    `integration(slack): Posting to slack channel #${slackOpts.channel}`
  );
  const slackToken = process.env.SLACK_TOKEN;
  if (!slackToken) throw new Error("process.env.SLACK_TOKEN is not defined");

  const slackWebClient = new SlackWebClient(slackToken);

  let releaseBody = release.body || "";

  // replace ## title with **title**
  releaseBody = releaseBody.replace(/## (.*)/, `*$1*`);

  // replace * with for list
  releaseBody = releaseBody.replaceAll(`\n* `, `\n- `);

  // rewrite changelog entries to format
  // [title](link) by name
  releaseBody = releaseBody.replace(
    /- (.*) by (.*) in (.*)/,
    `- <$3|$1> by $2`
  );

  const username_mapping = slackOpts["username_mapping"] || {};
  for (const [username, slackUserId] of Object.entries(username_mapping)) {
    releaseBody = releaseBody.replaceAll(`@${username}`, `<@${slackUserId}>`);
  }

  await slackWebClient.chat.postMessage({
    text: `<${release.html_url}|Release ${
      release.name || release.tag_name
    }> to \`${Config.repo.owner}/${Config.repo.repo}\`

${releaseBody}`,
    channel: slackOpts.channel,
    icon_url: "https://avatars.githubusercontent.com/in/15368?s=88&v=4",
    mrkdwn: true,
  });
};
