import "@violentmonkey/types";

type Tweet = {
  date: string;
  fav: number;
  retweet: number;
  url: string;
  userName: string;
};
type EntryTweetResult = {
  isEntryTweet: true;
  tweet: Tweet;
} | { isEntryTweet: false };

export function getTweetText() {
  const userElement = document.querySelectorAll(
    "div[data-testid=attachments] div[data-testid=User-Name] div > div[dir=ltr]:first-child > span",
  )[0];
  if (!userElement || userElement.childNodes.length === 0) {
    throw new Error("can't parse username");
  }
  const userName = Array.from(userElement.childNodes, (node) => {
    if (node instanceof HTMLSpanElement) return node.textContent;
    if (node instanceof HTMLImageElement) return node.alt; // emoji
  }).join("");

  const tweet = document.querySelector(
    `div[data-testid=attachments] div[data-testid="tweetText"]`,
  );

  if (!tweet || tweet.textContent === null) throw new Error("can't get tweet");
  const round = tweet.textContent.match(/(?<=KEEB_PD_R)\d+/);

  if (!userName || !tweet || !round || round.length === 0 || userName === "") {
    throw new Error("can't get text");
  }
  const tweetMeta = getGMTweetMeta();

  return `#KEEB_PD_R${round} で一番ふぁぼ${
    tweetMeta.fav ? `(❤${tweetMeta.fav})` : ""
  }が多かったのは ${userName} さんでした🎉🎉🎉🎉
おめでとうございます!! 🎉🎉🎉🎉🎉🎉🎉
#KEEB_PD_R${round} #KEEB_PD`;
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

    result.tweet.userName = userMetaElement?.querySelector(
      `div:first-child>div>a[role="link"] > div:first-child > div:first-child > span`,
    )?.textContent ?? "invalid user name";
    const tweetDetailElement = userMetaElement?.querySelector(
      `div:nth-child(2) > div > div:nth-child(3) > a[role="link"]`,
    );
    result.tweet.date = tweetDetailElement?.getElementsByTagName("time")[0]
      ?.getAttribute("datetime") ?? "invalid date";
    result.tweet.url = tweetDetailElement?.getAttribute("href") ??
      "invalid url";
    return result;
  }
  return { isEntryTweet: false };
}

export function setGMTweetMeta(tweet: Tweet) {
  GM_setValue("tweet", tweet);
  console.log(tweet);
}

function getGMTweetMeta() {
  return GM_getValue("tweet") as Tweet;
}
