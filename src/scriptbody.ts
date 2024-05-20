/// <reference lib="dom" />
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

function getTweetText() {
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

function hasValueChangedFromInit(init: string) {
  let before = init;
  return (text: string) => {
    if (before === text) {
      return true;
    } else {
      before = text;
      return false;
    }
  };
}

const hasUrlChanged = hasValueChangedFromInit(window.crypto.randomUUID());
const hasSearchUrlChanged = hasValueChangedFromInit(window.crypto.randomUUID());

const COMPOSE_POST_PATH = "/compose/post";
let copyToClipboardMenuId = "";

const isKEEBPDSearchURL = (url: URL) => {
  const query = url.searchParams.get("q");
  if (
    url.pathname === "/search" &&
    url.searchParams.get("f") === "live" &&
    query &&
    query.match(/#KEEB_PD_R\d+/g) &&
    query.match(/min_faves:\d+/g)
  ) {
    return true;
  }
  return false;
};

function isPromotionTweet(node: Node) {
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

function isQuoteRetweet(node: Node) {
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

function parseEntryTweet(
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

const searchTimelineObserver = new MutationObserver((mutations, _observer) => {
  const a = mutations
    .reduce((p, c) => {
      const { addedNodes } = c;
      const nodes = Array.from(addedNodes).filter((node) => {
        if (
          isPromotionTweet(node) ||
          isQuoteRetweet(node)
        ) {
          return false;
        }
        if (!(node instanceof Element)) return false;
        if (node.getAttribute("data-testid") !== "cellInnerDiv") return false;
        return true;
      }).reduce((p, c) => {
        if (c instanceof Element) {
          return [...p, c];
        }
        return p;
      }, [] as Element[]);

      return [...p, ...nodes];
    }, [] as Element[]);
  console.log("list", a);
  a.forEach((node) => {
    const retweetButton = node.querySelector(`button[data-testid="retweet"]`) ??
      node.querySelector(`button[data-testid="unretweet"]`);
    const result = parseEntryTweet(node);
    if (retweetButton && result.isEntryTweet) {
      console.info(result.tweet);
      retweetButton.addEventListener("click", () => {
        setGMTweetMeta(result.tweet);
      });
    }
  });
});

function setGMTweetMeta(tweet: Tweet) {
  GM_setValue("tweet", tweet);
  console.log(tweet);
}
function getGMTweetMeta() {
  return GM_getValue("tweet") as Tweet;
}

let isSearchTimelineObserverActive = false;

new MutationObserver((_mutations, _observer) => {
  const url = new URL(document.location.href);

  if (isKEEBPDSearchURL(url)) {
    if (!hasSearchUrlChanged(url.href)) {
      console.log("waiting...");
      const searchTimelineElement = document.querySelector(
        `div[aria-label="タイムライン: タイムラインを検索"]`,
      );
      if (searchTimelineElement) {
        console.log("start timeline observe");
        isSearchTimelineObserverActive = true;
        searchTimelineObserver.observe(searchTimelineElement, {
          subtree: true,
          childList: true,
        });
      } else {
        hasSearchUrlChanged(window.crypto.randomUUID());
      }
    }
  } else {
    if (isSearchTimelineObserverActive) {
      hasSearchUrlChanged(window.crypto.randomUUID());
      searchTimelineObserver.disconnect();
      isSearchTimelineObserverActive = false;
      console.info("disconnect!");
    }
  }
  if (url.pathname === COMPOSE_POST_PATH) {
    if (!hasUrlChanged(url.href)) {
      try {
        console.log("register menu command");
        const text = getTweetText();
        copyToClipboardMenuId = GM_registerMenuCommand(
          "copy to clipboard",
          () => {
            GM_setClipboard(text, "text");
          },
        );
        const unsetButton = document.querySelector(
          `button[data-testid="unsentButton"]`,
        )!.parentElement!;
        const div = document.createElement("div");
        div.addEventListener("click", (target) => {
          const currentTarget = target.currentTarget;
          if (currentTarget instanceof HTMLDivElement) {
            GM_setClipboard(text, "text");
          }
        });
        div.style.cssText =
          `height: 1.5em; width: 1.5em; background-image: url("https://abs-0.twimg.com/emoji/v2/svg/1f436.svg"); background-size: 1.5em 1.5em; padding: 0.15em; background-position: center center; background-repeat: no-repeat; -webkit-text-fill-color: transparent;`;
        unsetButton.append(div);
      } catch (_e) {
        console.log("retry", _e);
        hasUrlChanged(window.crypto.randomUUID()); // retry
      }
    }
  } else {
    if (copyToClipboardMenuId !== "") {
      copyToClipboardMenuId = "";
      GM_unregisterMenuCommand(copyToClipboardMenuId);
      hasUrlChanged(window.crypto.randomUUID());
    }
  }
}).observe(document, {
  subtree: true,
  childList: true,
});
