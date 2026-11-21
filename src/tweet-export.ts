import type { Tweet } from "./tweet-parser.ts";

// ダウンロードするJSONの形式。構造を変えるときは schemaVersion を上げる
export type TweetExport = {
  schemaVersion: 1;
  // 全ツイートが同じラウンドならその番号、ラウンドが混在している場合と0件の場合は null
  round: string | null;
  // ダウンロードした日時（ISO 8601）
  collectedAt: string;
  tweets: Tweet[];
};

export function createTweetExport(tweets: Tweet[], collectedAt: Date): TweetExport {
  const rounds = new Set(tweets.map((tweet) => tweet.round));
  return {
    schemaVersion: 1,
    round: rounds.size === 1 ? [...rounds][0] : null,
    collectedAt: collectedAt.toISOString(),
    tweets,
  };
}
