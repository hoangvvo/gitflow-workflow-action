// @ts-check
import slackifyMarkdown from "slackify-markdown";
import { Config } from "./shared.js";
import { removeHtmlComments } from "./utils.js";

/**
 *
 * @param {string} slackInput
 * @param {import("@octokit/plugin-rest-endpoint-methods").RestEndpointMethodTypes["repos"]["createRelease"]["response"]["data"] } release
 */
export async function sendToSlack(slackInput, release) {
  let slackOpts;
  try {
    slackOpts = JSON.parse(slackInput);
  } catch {
    throw new Error(`integration(slack): Could not parse ${slackInput}`);
  }

  console.log(
    `integration(slack): Posting to slack channel #${slackOpts.channel}`,
  );

  const slackToken = process.env.SLACK_TOKEN;
  if (!slackToken) throw new Error("process.env.SLACK_TOKEN is not defined");

  let releaseBody = release.body || "";
  releaseBody = removeHtmlComments(releaseBody);
  releaseBody = slackifyMarkdown(releaseBody);

  // rewrite changelog entries to format
  // [title](link) by name
  releaseBody = releaseBody.replace(
    /- (.*) by (.*) in (.*)/g,
    `- <$3|$1> by $2`,
  );

  const username_mapping = slackOpts["username_mapping"] || {};
  for (const [username, slackUserId] of Object.entries(username_mapping)) {
    releaseBody = releaseBody.replaceAll(`@${username}`, `<@${slackUserId}>`);
  }

  const messagePayload = {
    text: `<${release.html_url}|Release ${release.name || release.tag_name}> to \`${Config.repo.owner}/${Config.repo.repo}\`\n\n${releaseBody}`,
    channel: slackOpts.channel,
    icon_url:
      slackOpts.icon_url ||
      "https://avatars.githubusercontent.com/in/15368?s=88&v=4",
    mrkdwn: true,
  };

  // https://api.slack.com/methods/chat.postMessage
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${slackToken}`,
    },
    body: JSON.stringify(messagePayload),
  });

  const result = await response.json();

  if (!result.ok) {
    throw new Error(`Slack API Error: ${result.error}`);
  }

  return result;
}
