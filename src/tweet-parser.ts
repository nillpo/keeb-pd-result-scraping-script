export type Tweet = {
  date: string;
  fav: number;
  retweet: number;
  url: string;
  userName: string;
  round: string;
};
type EntryTweetResult = {
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
    node.getAttribute("data-testid") === "cellInnerDiv"
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
    node.getAttribute("data-testid") === "cellInnerDiv"
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
  if (node.getAttribute("data-testid") !== "cellInnerDiv") {
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
  const favElm = node.querySelector(
    `button[data-testid="like"] span[data-testid="app-text-transition-container"]`,
  )?.textContent;
  if (!favElm) {
    return { isEntryTweet: false, reason: "like element not found" };
  }
  const retweetElement = node.querySelector(
    `button[data-testid="retweet"] span[data-testid="app-text-transition-container"]`,
  )?.textContent;
  const unretweetElement = node.querySelector(
    `button[data-testid="unretweet"] span[data-testid="app-text-transition-container"]`,
  )?.textContent;
  if (!retweetElement && !unretweetElement) {
    return { isEntryTweet: false, reason: "retweet element not found" };
  }
  tweetMeta.fav = Number(favElm);
  tweetMeta.retweet = retweetElement
    ? Number(retweetElement)
    : Number(unretweetElement);

  const userMetaElement = node.querySelector(
    `article div[data-testid="User-Name"]`,
  );
  if (!userMetaElement) {
    return { isEntryTweet: false, reason: "user meta element not found" };
  }

  const userNameElements = userMetaElement.querySelector(
    `div:first-child>div>a[role="link"] > div:first-child > div:first-child > span`,
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
    `div:nth-child(2) > div > div:nth-child(3) > a[role="link"]`,
  );
  if (!tweetDetailElement) {
    return { isEntryTweet: false, reason: "tweet detail element not found" };
  }
  tweetMeta.date = tweetDetailElement.getElementsByTagName("time")[0]
    ?.getAttribute("datetime") ?? "invalid date";
  tweetMeta.url = tweetDetailElement.getAttribute("href") ?? "invalid url";

  const tweet = node.querySelector(`div[data-testid="tweetText"]`);
  if (!tweet) {
    return { isEntryTweet: false, reason: "tweet text element not found" };
  }
  const round = tweet.textContent?.match(/(?<=KEEB_PD_R)\d+/);
  if (!round) {
    return { isEntryTweet: false, reason: "round information not found" };
  }
  tweetMeta.round = round[0];

  return {
    isEntryTweet: true,
    tweet: tweetMeta,
  };
}
