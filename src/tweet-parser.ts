import { DATA_ATTRS, SELECTORS } from "./selectors.ts";

export type Tweet = {
  date: string;
  fav: number;
  retweet: number;
  url: string;
  userName: string;
  round: string;
};
export type EntryTweetResult = {
  isEntryTweet: true;
  tweet: Tweet;
} | { isEntryTweet: false; reason: string };

export function getTweetText(tweet: Tweet) {
  return `#KEEB_PD_R${tweet.round} で一番ふぁぼ${
    tweet.fav ? `(❤${tweet.fav})` : ""
  }が多かったのは ${tweet.userName} さんでした🎉🎉🎉🎉
おめでとうございます!! 🎉🎉🎉🎉🎉🎉🎉
#KEEB_PD_R${tweet.round} #KEEB_PD`;
}

export function isPromotionTweet(node: Node) {
  if (
    node instanceof HTMLDivElement &&
    node.getAttribute("data-testid") === DATA_ATTRS.CELL_INNER_DIV
  ) {
    const promo = node.querySelector(
      `article[data-testid="tweet"] > div > div > div:last-child > div > div:last-child > div > div > span`,
    );
    if (promo === null) return false;
    if (promo.textContent === "プロモーション") return true;
  }
  return false;
}

export function isQuoteRetweet(node: Node) {
  if (
    node instanceof HTMLDivElement &&
    node.getAttribute("data-testid") === DATA_ATTRS.CELL_INNER_DIV
  ) {
    const quoted = node.querySelectorAll(
      'article > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(3) > div > div[tabindex="0"] > div  time',
    );
    return quoted.length > 0;
  }
  return false;
}

export function parseEntryTweet(
  node: Node,
): EntryTweetResult {
  if (!(node instanceof HTMLDivElement)) {
    return { isEntryTweet: false, reason: "node is not HTMLDivElement" };
  }
  if (node.getAttribute("data-testid") !== DATA_ATTRS.CELL_INNER_DIV) {
    return { isEntryTweet: false, reason: "node is not cellInnerDiv" };
  }
  if (isPromotionTweet(node)) {
    return { isEntryTweet: false, reason: "node is promotion tweet" };
  }
  if (isQuoteRetweet(node)) {
    return { isEntryTweet: false, reason: "node is quote retweet" };
  }
  const tweetMeta = {
    date: "",
    fav: 0,
    retweet: 0,
    url: "",
    userName: "",
    round: "",
  };
  const favElm = node.querySelector(SELECTORS.LIKE_COUNT)?.textContent;
  if (!favElm) {
    return { isEntryTweet: false, reason: "like element not found" };
  }
  const retweetElement = node.querySelector(SELECTORS.RETWEET_COUNT)
    ?.textContent;
  const unretweetElement = node.querySelector(SELECTORS.UNRETWEET_COUNT)
    ?.textContent;
  if (!retweetElement && !unretweetElement) {
    return { isEntryTweet: false, reason: "retweet element not found" };
  }
  tweetMeta.fav = Number(favElm);
  tweetMeta.retweet = retweetElement
    ? Number(retweetElement)
    : Number(unretweetElement);

  const userMetaElement = node.querySelector(SELECTORS.USER_NAME);
  if (!userMetaElement) {
    return { isEntryTweet: false, reason: "user meta element not found" };
  }

  const userNameElements = userMetaElement.querySelector(
    SELECTORS.USER_NAME_SPAN,
  )?.childNodes;
  if (!userNameElements) {
    return { isEntryTweet: false, reason: "user name elements not found" };
  }

  const userName = Array.from(userNameElements, (node) => {
    if (node instanceof HTMLSpanElement) return node.textContent;
    if (node instanceof HTMLImageElement) return node.alt; // emoji
  }).join("");
  tweetMeta.userName = userName.trim();

  const tweetDetailElement = userMetaElement.querySelector(
    SELECTORS.TWEET_DETAIL_LINK,
  );
  if (!tweetDetailElement) {
    return { isEntryTweet: false, reason: "tweet detail element not found" };
  }
  tweetMeta.date = tweetDetailElement.getElementsByTagName("time")[0]
    ?.getAttribute("datetime") ?? "invalid date";
  tweetMeta.url = tweetDetailElement.getAttribute("href") ?? "invalid url";

  const tweet = node.querySelector(SELECTORS.TWEET_TEXT);
  if (!tweet) {
    return { isEntryTweet: false, reason: "tweet text element not found" };
  }

  const tweetText = tweet.textContent || "";

  if (!tweetText.includes("#KEEB_PD")) {
    return { isEntryTweet: false, reason: "KEEB_PD hashtag not found" };
  }

  const round = tweetText.match(/(?<=KEEB_PD_R)\d+/);
  if (!round) {
    return { isEntryTweet: false, reason: "round information not found" };
  }
  tweetMeta.round = round[0];

  return {
    isEntryTweet: true,
    tweet: tweetMeta,
  };
}

export function parseDetailTweet(
  node: Node,
): EntryTweetResult {
  if (!(node instanceof HTMLDivElement)) {
    return { isEntryTweet: false, reason: "node is not HTMLDivElement" };
  }
  if (node.getAttribute("data-testid") !== DATA_ATTRS.CELL_INNER_DIV) {
    return { isEntryTweet: false, reason: "node is not cellInnerDiv" };
  }
  if (isPromotionTweet(node)) {
    return { isEntryTweet: false, reason: "node is promotion tweet" };
  }
  if (isQuoteRetweet(node)) {
    return { isEntryTweet: false, reason: "node is quote retweet" };
  }

  const article = node.querySelector(SELECTORS.TWEET_ARTICLE);
  if (!article) {
    return { isEntryTweet: false, reason: "article element not found" };
  }

  const tweetMeta = {
    date: "",
    fav: 0,
    retweet: 0,
    url: "",
    userName: "",
    round: "",
  };

  const favElm = node.querySelector(SELECTORS.LIKE_COUNT)?.textContent?.trim();
  tweetMeta.fav = favElm ? Number(favElm) : 0;

  const retweetElement = node.querySelector(SELECTORS.RETWEET_COUNT)
    ?.textContent?.trim();
  const unretweetElement = node.querySelector(SELECTORS.UNRETWEET_COUNT)
    ?.textContent?.trim();

  const retweetCount = retweetElement || unretweetElement;
  tweetMeta.retweet = retweetCount ? Number(retweetCount) : 0;

  const userMetaElement = node.querySelector(SELECTORS.USER_NAME);
  if (!userMetaElement) {
    return { isEntryTweet: false, reason: "user meta element not found" };
  }

  const userNameElements = userMetaElement.querySelector(
    SELECTORS.USER_NAME_SPAN,
  )?.childNodes;
  if (!userNameElements) {
    return { isEntryTweet: false, reason: "user name elements not found" };
  }

  const userName = Array.from(userNameElements, (node) => {
    if (node instanceof HTMLSpanElement) return node.textContent;
    if (node instanceof HTMLImageElement) return node.alt; // emoji
  }).join("");
  tweetMeta.userName = userName.trim();

  const timeElement = node.querySelector("time[datetime]");
  if (!timeElement) {
    return { isEntryTweet: false, reason: "time element not found" };
  }

  const datetime = timeElement.getAttribute("datetime");
  const tweetLink = timeElement.closest("a[href]");

  if (!datetime || !tweetLink) {
    return { isEntryTweet: false, reason: "datetime or tweet link not found" };
  }

  tweetMeta.date = datetime;
  tweetMeta.url = tweetLink.getAttribute("href") ?? "invalid url";

  const tweet = node.querySelector(SELECTORS.TWEET_TEXT);
  if (!tweet) {
    return { isEntryTweet: false, reason: "tweet text element not found" };
  }

  const tweetText = tweet.textContent || "";

  if (!tweetText.includes("#KEEB_PD")) {
    return { isEntryTweet: false, reason: "KEEB_PD hashtag not found" };
  }

  const round = tweetText.match(/(?<=KEEB_PD_R)\d+/);
  if (!round) {
    return { isEntryTweet: false, reason: "round information not found" };
  }
  tweetMeta.round = round[0];

  return {
    isEntryTweet: true,
    tweet: tweetMeta,
  };
}
