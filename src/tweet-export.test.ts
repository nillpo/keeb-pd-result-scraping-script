import { describe, expect, it } from "vitest";
import { createDownloadFileName, createTweetExport } from "./tweet-export.ts";
import type { Tweet } from "./tweet-parser.ts";

const tweet: Tweet = {
  date: "2026-02-15T14:30:45.000Z",
  fav: 10,
  retweet: 2,
  url: "/user/status/1",
  userName: "テスト",
  round: "123",
};

describe("createTweetExport", () => {
  it("schemaVersion と collectedAt（ISO 8601）を付けて tweets をそのまま入れる", () => {
    const result = createTweetExport([tweet], new Date("2026-02-15T14:30:45.123Z"));
    expect(result).toEqual({
      schemaVersion: 1,
      collectedAt: "2026-02-15T14:30:45.123Z",
      tweets: [tweet],
    });
  });
});

describe("createDownloadFileName", () => {
  it("ISO 8601 の : と . を - に置き換える", () => {
    expect(createDownloadFileName(new Date("2026-02-15T14:30:45.123Z"))).toBe(
      "keeb-pd-tweets-2026-02-15T14-30-45-123Z.json",
    );
  });
});
