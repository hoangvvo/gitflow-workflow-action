export type Result = {
  type: "release" | "hotfix" | "none";
  version?: string;
  pull_number?: number;
  pull_numbers_in_release?: string;
  release_branch?: string;
  release_url?: string;
  latest_release_tag_name?: string;
};

export type SlackIntegrationOptions = {
  channel: string;
  username_mapping?: {
    [githubUsername: string]: string;
  };
  icon_url?: string;
};
