// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  getTweetText,
  isPromotionTweet,
  isQuoteRetweet,
  parseEntryTweet,
  type Tweet,
} from "./tweet-parser.ts";
import { createNode, promotion, quote, tweetHtml } from "./test-fixtures.ts";

describe("getTweetText", () => {
  const tweet: Tweet = {
    date: "2026-02-15T14:30:45.000Z",
    fav: 10,
    retweet: 1,
    url: "/u/status/1",
    userName: "ふぁぼ太郎",
    round: "123",
  };

  it("ラウンド・ふぁぼ数・ユーザー名を含む祝福メッセージを作る", () => {
    const text = getTweetText(tweet);
    expect(text).toContain("#KEEB_PD_R123 で一番ふぁぼ(❤10)が多かったのは ふぁぼ太郎 さんでした");
    expect(text.endsWith("#KEEB_PD_R123 #KEEB_PD")).toBe(true);
  });

  it("ふぁぼ数が 0 のときは (❤0) を省く", () => {
    expect(getTweetText({ ...tweet, fav: 0 })).toContain("で一番ふぁぼが多かったのは");
  });
});

describe("parseEntryTweet", () => {
  it("ツイートのメタ情報を取り出す", () => {
    const result = parseEntryTweet(createNode(tweetHtml()));
    expect(result).toEqual({
      isEntryTweet: true,
      tweet: {
        date: "2026-02-15T14:30:45.000Z",
        fav: 42,
        retweet: 7,
        url: "/user/status/1",
        userName: "ふぁぼ太郎",
        round: "123",
      },
    });
  });

  it("リツイート済み（unretweet）でもリツイート数を取れる", () => {
    const result = parseEntryTweet(
      createNode(tweetHtml({ retweetTestId: "unretweet", retweet: "9" })),
    );
    expect(result).toMatchObject({ isEntryTweet: true, tweet: { retweet: 9 } });
  });

  it("ユーザー名の絵文字（img の alt）を文字列に含める", () => {
    const nameHtml = '<span>たろう</span><img alt="🎉" src="x.svg"><span>さん</span>';
    const result = parseEntryTweet(createNode(tweetHtml({ nameHtml })));
    expect(result).toMatchObject({ isEntryTweet: true, tweet: { userName: "たろう🎉さん" } });
  });

  it("time や href が無ければ invalid の値になる", () => {
    const html = tweetHtml()
      .replace(/<time[^>]*><\/time>/, "")
      .replace(/ href="[^"]*"/, "");
    const result = parseEntryTweet(createNode(html));
    expect(result).toMatchObject({
      isEntryTweet: true,
      tweet: { date: "invalid date", url: "invalid url" },
    });
  });

  it.each([
    ["like element not found", { fav: null }],
    ["retweet element not found", { retweetTestId: null }],
    ["tweet text element not found", { text: null }],
    ["round information not found", { text: "ラウンド番号のない投稿" }],
  ] as const)("%s", (reason, options) => {
    expect(parseEntryTweet(createNode(tweetHtml(options)))).toEqual({
      isEntryTweet: false,
      reason,
    });
  });

  it("User-Name が無ければ失敗する", () => {
    const html = tweetHtml().replace('data-testid="User-Name"', 'data-testid="other"');
    expect(parseEntryTweet(createNode(html))).toEqual({
      isEntryTweet: false,
      reason: "user meta element not found",
    });
  });

  it("div でないノード / cellInnerDiv でない div は対象外", () => {
    expect(parseEntryTweet(document.createElement("span"))).toEqual({
      isEntryTweet: false,
      reason: "node is not HTMLDivElement",
    });
    expect(parseEntryTweet(document.createElement("div"))).toEqual({
      isEntryTweet: false,
      reason: "node is not cellInnerDiv",
    });
  });

  it("プロモーションと引用リツイートは理由つきで除外する", () => {
    expect(parseEntryTweet(createNode(promotion))).toEqual({
      isEntryTweet: false,
      reason: "node is promotion tweet",
    });
    expect(parseEntryTweet(createNode(quote))).toEqual({
      isEntryTweet: false,
      reason: "node is quote retweet",
    });
  });
});

describe("isPromotionTweet", () => {
  it("プロモーション表記のあるツイートは true", () => {
    // article > div > div > div:last-child > div > div:last-child > div > div > span
    expect(isPromotionTweet(createNode(promotion))).toBe(true);
  });

  it("通常のツイートや別の文言は false", () => {
    expect(isPromotionTweet(createNode(tweetHtml()))).toBe(false);
    expect(isPromotionTweet(createNode(promotion.replace("プロモーション", "広告")))).toBe(false);
  });

  it("div 以外 / cellInnerDiv でない div は false", () => {
    expect(isPromotionTweet(document.createElement("span"))).toBe(false);
    expect(isPromotionTweet(document.createElement("div"))).toBe(false);
  });
});

describe("isQuoteRetweet", () => {
  // article > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(3) > div > div[tabindex="0"] > div time

  it("引用元の time があれば true", () => {
    expect(isQuoteRetweet(createNode(quote))).toBe(true);
  });

  it("通常のツイートは false", () => {
    expect(isQuoteRetweet(createNode(tweetHtml()))).toBe(false);
  });

  it("div 以外 / cellInnerDiv でない div は false", () => {
    expect(isQuoteRetweet(document.createElement("span"))).toBe(false);
    expect(isQuoteRetweet(document.createElement("div"))).toBe(false);
  });
});
