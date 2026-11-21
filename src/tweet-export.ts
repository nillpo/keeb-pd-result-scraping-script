import type { Tweet } from "./tweet-parser.ts";

// ダウンロードするJSONの形式。構造を変えるときは schemaVersion を上げる
export type TweetExport = {
  schemaVersion: 1;
  // ダウンロードした日時（ISO 8601）
  collectedAt: string;
  tweets: Tweet[];
};

export function createTweetExport(tweets: Tweet[], collectedAt: Date): TweetExport {
  return {
    schemaVersion: 1,
    collectedAt: collectedAt.toISOString(),
    tweets,
  };
}
