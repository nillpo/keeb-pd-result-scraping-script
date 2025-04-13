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
} | { isEntryTweet: false };

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
  if (
    node instanceof HTMLDivElement &&
    node.getAttribute("data-testid") === "cellInnerDiv" &&
    !isPromotionTweet(node) &&
    !isQuoteRetweet(node)
  ) {
    const result = {
      isEntryTweet: true,
      tweet: {
        date: "",
        fav: 0,
        retweet: 0,
        url: "",
        userName: "",
        round: "",
      },
    };
    const favElm = node.querySelector(
      `button[data-testid="like"] span[data-testid="app-text-transition-container"]`,
    )?.textContent;
    const retweetElement = node.querySelector(
      `button[data-testid="retweet"] span[data-testid="app-text-transition-container"]`,
    )?.textContent;
    const unretweetElement = node.querySelector(
      `button[data-testid="unretweet"] span[data-testid="app-text-transition-container"]`,
    )?.textContent;
    result.tweet.fav = Number(favElm ? favElm : 0);
    result.tweet.retweet = retweetElement
      ? Number(retweetElement)
      : unretweetElement
      ? Number(unretweetElement)
      : 0;

    const userMetaElement = node.querySelector(
      `article div[data-testid="User-Name"]`,
    );

    const userNameElements = userMetaElement?.querySelector(
      `div:first-child>div>a[role="link"] > div:first-child > div:first-child > span`,
    )?.childNodes;

    if (userNameElements) {
      const userName = Array.from(userNameElements, (node) => {
        if (node instanceof HTMLSpanElement) return node.textContent;
        if (node instanceof HTMLImageElement) return node.alt; // emoji
      }).join("");
      result.tweet.userName = userName.trim();
    } else {
      result.tweet.userName = "??????";
    }

    const tweetDetailElement = userMetaElement?.querySelector(
      `div:nth-child(2) > div > div:nth-child(3) > a[role="link"]`,
    );
    result.tweet.date = tweetDetailElement?.getElementsByTagName("time")[0]
      ?.getAttribute("datetime") ?? "invalid date";
    result.tweet.url = tweetDetailElement?.getAttribute("href") ??
      "invalid url";

    const tweet = node.querySelector(
      `div[data-testid="tweetText"]`,
    );
    const round = tweet?.textContent?.match(/(?<=KEEB_PD_R)\d+/);
    result.tweet.round = round ? round[0] : "UNKNOWN";
    return result;
  }
  return { isEntryTweet: false };
}
