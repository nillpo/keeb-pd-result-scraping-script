/// <reference lib="dom" />
import { ExecuteHandler, StateMachine, Transition } from "./state-machine.ts";
import {
  getTweetText,
  isPromotionTweet,
  isQuoteRetweet,
  parseEntryTweet,
  Tweet,
} from "./tweet-parser.ts";

type StateContext = {
  searchTimelineObserver: MutationObserver;
  twitterPageObserver: MutationObserver;
  listeners: number[];
  tweet: Tweet;
  collectedTweets: Map<string, Tweet>;
};

const COMPOSE_POST_PATH = "/compose/post";

const isKEEBPDSearchURL = (url: URL) => {
  const query = url.searchParams.get("q");
  if (
    url.pathname === "/search" &&
    url.searchParams.get("f") === "live" &&
    query &&
    query.match(/KEEB_PD_R\d+/g)
  ) {
    return true;
  }
  return false;
};

const observeTwitterPage: ExecuteHandler<StateContext> = (_event, context) => {
  context.twitterPageObserver.observe(document, {
    subtree: true,
    childList: true,
  });
};

const observeSearchTimeline: ExecuteHandler<StateContext> = (
  _event,
  context,
) => {
  context.searchTimelineObserver.observe(document, {
    subtree: true,
    childList: true,
  });
};

const disconnectSearchTimeline: ExecuteHandler<StateContext> = (
  _event,
  context,
) => {
  context.searchTimelineObserver.disconnect();

  // Remove download panel from DOM
  const panel = document.getElementById("keeb-pd-download-panel");
  if (panel) panel.remove();

  // Clear counter update intervals
  context.listeners.forEach((id) => clearInterval(id));
  context.listeners = [];

  console.info("disconnect!");
};

const setupComposePage: ExecuteHandler<StateContext> = (event, context) => {
  if (event.type !== "COMPOSE_PAGE_LOADED") return;
  const composeButton = document.querySelector(event.css_selector)!;
  const text = getTweetText(context.tweet);
  const unsetButton = composeButton.parentElement!;
  const div = document.createElement("div");
  div.addEventListener("click", (target) => {
    const currentTarget = target.currentTarget;
    if (currentTarget instanceof HTMLDivElement) {
      navigator.clipboard.writeText(text).then(() =>
        console.log("Text copied!")
      ).catch((err) => console.error("Clipboard write failed", err));
    }
  });

  div.style.cssText = `height: 1.5em; width: 1.5em;
     background-image: url("https://abs-0.twimg.com/emoji/v2/svg/1f436.svg");
     background-size: 1.5em 1.5em;
     padding: 0.15em;
     background-position: center center;
     background-repeat: no-repeat;
     -webkit-text-fill-color: transparent;`;
  unsetButton.append(div);
};

const getTop5Tweets = (tweets: Map<string, Tweet>): Tweet[] => {
  const sortedTweets = Array.from(tweets.values()).sort((a, b) =>
    b.fav - a.fav
  );
  return sortedTweets.slice(0, 5);
};

const setupDownloadButton: ExecuteHandler<StateContext> = (event, context) => {
  if (event.type !== "SEARCH_PAGE_LOADED") return;

  // Remove existing panel if present (handles re-navigation)
  const existing = document.getElementById("keeb-pd-download-panel");
  if (existing) existing.remove();

  // Create floating control panel
  const controlPanel = document.createElement("div");
  controlPanel.id = "keeb-pd-download-panel";
  controlPanel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(29, 155, 240, 0.9);
    padding: 12px;
    border-radius: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;

  // Counter badge
  const counterBadge = document.createElement("div");
  counterBadge.style.cssText = `
    background: rgb(239, 243, 244);
    color: rgb(15, 20, 25);
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 13px;
    text-align: center;
    font-weight: 600;
  `;

  // Download button
  const downloadButton = document.createElement("button");
  downloadButton.textContent = "⬇ Download JSON";
  downloadButton.style.cssText = `
    background: white;
    color: rgb(29, 155, 240);
    border: none;
    padding: 8px 16px;
    border-radius: 20px;
    font-weight: bold;
    cursor: pointer;
    font-size: 14px;
  `;

  // Clear button
  const clearButton = document.createElement("button");
  clearButton.textContent = "🗑 Clear All";
  clearButton.style.cssText = downloadButton.style.cssText;

  // Top 5 Container
  const top5Container = document.createElement("div");
  top5Container.id = "keeb-pd-top5-container";
  top5Container.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 8px;
    max-height: 200px;
    overflow-y: auto;
    display: none;
  `;

  // Title
  const top5Title = document.createElement("div");
  top5Title.textContent = "Top 5 ふぁぼ数";
  top5Title.style.cssText = `
    font-size: 13px;
    font-weight: 600;
    color: rgb(15, 20, 25);
    margin-bottom: 6px;
    text-align: center;
  `;

  // List
  const top5List = document.createElement("div");
  top5List.id = "keeb-pd-top5-list";
  top5List.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 4px;
  `;

  top5Container.appendChild(top5Title);
  top5Container.appendChild(top5List);

  // Create Top 5 item
  const createTop5Item = (tweet: Tweet, rank: number): HTMLDivElement => {
    const item = document.createElement("div");
    item.style.cssText = `
      padding: 6px 8px;
      border-radius: 8px;
      background: rgb(239, 243, 244);
      cursor: pointer;
      transition: background-color 0.2s ease;
      font-size: 12px;
    `;

    // Hover effect
    item.addEventListener("mouseenter", () => {
      item.style.backgroundColor = "rgb(215, 227, 234)";
    });
    item.addEventListener("mouseleave", () => {
      item.style.backgroundColor = "rgb(239, 243, 244)";
    });

    // Content elements
    const rankBadge = document.createElement("span");
    rankBadge.textContent = `${rank}.`;
    rankBadge.style.cssText = `
      font-weight: 700;
      color: rgb(29, 155, 240);
      margin-right: 4px;
    `;

    const userName = document.createElement("span");
    userName.textContent = tweet.userName;
    userName.style.cssText = `
      font-weight: 500;
      color: rgb(15, 20, 25);
      margin-right: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 120px;
      display: inline-block;
      vertical-align: middle;
    `;

    const favCount = document.createElement("span");
    favCount.textContent = `❤${tweet.fav}`;
    favCount.style.cssText = `
      font-weight: 600;
      color: rgb(249, 24, 128);
    `;

    item.appendChild(rankBadge);
    item.appendChild(userName);
    item.appendChild(favCount);

    // Click handler: Open tweet in new tab
    item.addEventListener("click", () => {
      const baseUrl = globalThis.location.hostname === "x.com"
        ? "https://x.com"
        : "https://twitter.com";
      const fullUrl = `${baseUrl}${tweet.url}`;
      globalThis.open(fullUrl, "_blank");
      console.log(`Opened tweet in new tab: ${fullUrl}`);
    });

    return item;
  };

  // Update counter display
  const updateCounter = () => {
    const count = context.collectedTweets.size;
    counterBadge.textContent = `${count} tweet${
      count !== 1 ? "s" : ""
    } collected`;
    downloadButton.disabled = count === 0;
    downloadButton.style.opacity = count === 0 ? "0.5" : "1";
    downloadButton.style.cursor = count === 0 ? "not-allowed" : "pointer";

    // Update Top 5 list
    const top5Tweets = getTop5Tweets(context.collectedTweets);

    if (top5Tweets.length > 0) {
      top5Container.style.display = "block";
    } else {
      top5Container.style.display = "none";
    }

    top5List.innerHTML = "";

    top5Tweets.forEach((tweet, index) => {
      const item = createTop5Item(tweet, index + 1);
      top5List.appendChild(item);
    });
  };

  // Download handler
  downloadButton.addEventListener("click", () => {
    const tweets = Array.from(context.collectedTweets.values());
    const json = JSON.stringify(tweets, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.download = `keeb-pd-tweets-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`Downloaded ${tweets.length} tweets`);
  });

  // Clear handler
  clearButton.addEventListener("click", () => {
    if (confirm(`Clear ${context.collectedTweets.size} collected tweets?`)) {
      context.collectedTweets.clear();
      updateCounter();
      console.log("Cleared all collected tweets");
    }
  });

  // Initial update and periodic refresh
  updateCounter();
  const intervalId = setInterval(updateCounter, 1000);
  context.listeners.push(intervalId);

  // Assemble and attach to page
  controlPanel.appendChild(counterBadge);
  controlPanel.appendChild(top5Container);
  controlPanel.appendChild(downloadButton);
  controlPanel.appendChild(clearButton);
  document.body.appendChild(controlPanel);
};

const twitterPageObserver = new MutationObserver(() => {
  stateMachine.tryDispatch({
    type: "DETECT_SEARCH_URL",
    url: document.location.href,
  });
  stateMachine.tryDispatch({
    type: "SEARCH_PAGE_LOADED",
    css_selector: `div[aria-label="タイムライン: タイムラインを検索"]`,
  });
  stateMachine.tryDispatch({
    type: "DETECT_COMPOSE_URL",
    url: document.location.href,
  });
  stateMachine.tryDispatch({
    type: "COMPOSE_PAGE_LOADED",
    css_selector: `button[data-testid="unsentButton"]`,
  });

  if (stateMachine.canHandle("PAGE_CHANGED")) {
    switch (stateMachine.getState()) {
      case "MONITORING_SEARCH_PAGE": {
        stateMachine.tryDispatch({
          type: "PAGE_CHANGED",
          url: document.location.href,
        });
        break;
      }
      case "MONITORING_COMPOSE_PAGE": {
        stateMachine.tryDispatch({
          type: "PAGE_CHANGED",
          url: document.location.href,
        });
        break;
      }
    }
  }
});

const searchTimelineObserver = new MutationObserver((mutations, _observer) => {
  const validNodes = mutations
    .reduce((accumulatedNodes, mutation) => {
      const { addedNodes } = mutation;
      const filteredNodes = Array.from(addedNodes).filter((node) => {
        if (isPromotionTweet(node) || isQuoteRetweet(node)) {
          return false;
        }
        if (!(node instanceof Element)) return false;
        if (node.getAttribute("data-testid") !== "cellInnerDiv") return false;
        return true;
      }).reduce((elements, node) => {
        if (node instanceof Element) {
          return [...elements, node];
        }
        return elements;
      }, [] as Element[]);

      return [...accumulatedNodes, ...filteredNodes];
    }, [] as Element[]);

  console.log("Filtered nodes:", validNodes);

  validNodes.forEach((node) => {
    const retweetButton = node.querySelector(`button[data-testid="retweet"]`) ??
      node.querySelector(`button[data-testid="unretweet"]`);
    const tweetData = parseEntryTweet(node);

    console.log(
      "TWEET PARSE",
      tweetData.isEntryTweet
        ? JSON.stringify(tweetData.tweet)
        : tweetData.reason,
    );

    // Auto-collect valid tweets
    if (tweetData.isEntryTweet) {
      stateMachine.dispatch({
        type: "COLLECT_TWEET",
        tweet: { ...tweetData.tweet },
      });
    }

    // Keep retweet button functionality for compose page
    if (retweetButton && tweetData.isEntryTweet) {
      retweetButton.addEventListener("click", () => {
        stateMachine.dispatch({
          type: "UPDATE_TWEET_CONTEXT",
          tweet: { ...tweetData.tweet },
        });
      });
    }
  });
});

const stateMachine = new StateMachine<StateContext>("INITIAL", {
  searchTimelineObserver,
  twitterPageObserver,
  listeners: [],
  tweet: {
    date: "",
    fav: 0,
    retweet: 0,
    round: "",
    url: "",
    userName: "",
  },
  collectedTweets: new Map<string, Tweet>(),
});

stateMachine.addListener((result) => {
  if (result.success) {
    console.log(`Transitioned from ${result.from} to ${result.to}`);
  } else {
    console.log(
      `Failed to transition from ${result.from} due to ${result.reason}`,
    );
  }
});
const transitions: Transition<StateContext>[] = [
  {
    from: "INITIAL",
    to: "OBSERVING_TWITTER_PAGE",
    event: "BEGIN_OBSERVING",
    execute: observeTwitterPage,
  },
  {
    from: "OBSERVING_TWITTER_PAGE",
    event: "DETECT_SEARCH_URL",
    to: "LOADING_SEARCH_PAGE",
    condition: (event) => {
      if (event.type !== "DETECT_SEARCH_URL") return false;
      return isKEEBPDSearchURL(new URL(event.url));
    },
  },
  {
    from: "LOADING_SEARCH_PAGE",
    event: "SEARCH_PAGE_LOADED",
    to: "MONITORING_SEARCH_PAGE",
    condition: (event) => {
      if (event.type !== "SEARCH_PAGE_LOADED") return false;
      const searchTimelineElement = document.querySelector(event.css_selector);
      if (!searchTimelineElement) return false;
      return true;
    },
    execute: (event, context) => {
      observeSearchTimeline(event, context);
      setupDownloadButton(event, context);
    },
  },
  {
    from: "MONITORING_SEARCH_PAGE",
    event: "UPDATE_TWEET_CONTEXT",
    to: "MONITORING_SEARCH_PAGE",
    execute: (event, context) => {
      if (event.type !== "UPDATE_TWEET_CONTEXT") return;
      context.tweet = { ...event.tweet };
    },
  },
  {
    from: "MONITORING_SEARCH_PAGE",
    event: "COLLECT_TWEET",
    to: "MONITORING_SEARCH_PAGE",
    execute: (event, context) => {
      if (event.type !== "COLLECT_TWEET") return;
      context.collectedTweets.set(event.tweet.url, event.tweet);
      console.log(
        `Collected: ${event.tweet.url} (Total: ${context.collectedTweets.size})`,
      );
    },
  },
  {
    from: "MONITORING_SEARCH_PAGE",
    event: "PAGE_CHANGED",
    to: "OBSERVING_TWITTER_PAGE",
    condition: (event) => {
      if (event.type !== "PAGE_CHANGED") return false;
      const url = new URL(event.url);
      if (isKEEBPDSearchURL(url)) {
        return false;
      }
      return true;
    },
    execute: (event, context) => {
      disconnectSearchTimeline(event, context);
      context.collectedTweets.clear();
    },
  },
  {
    from: "MONITORING_SEARCH_PAGE",
    event: "DETECT_COMPOSE_URL",
    to: "LOADING_COMPOSE_PAGE",
    condition: (event) => {
      if (event.type !== "DETECT_COMPOSE_URL") return false;
      return new URL(event.url).pathname === COMPOSE_POST_PATH;
    },
  },
  {
    from: "LOADING_COMPOSE_PAGE",
    event: "COMPOSE_PAGE_LOADED",
    to: "MONITORING_COMPOSE_PAGE",
    condition: (event) => {
      if (event.type !== "COMPOSE_PAGE_LOADED") return false;
      const composeButton = document.querySelector(
        event.css_selector,
      );
      return !!composeButton;
    },
    execute: setupComposePage,
  },
  {
    from: "MONITORING_COMPOSE_PAGE",
    event: "PAGE_CHANGED",
    to: "MONITORING_SEARCH_PAGE",
    condition: (event) => {
      if (event.type !== "PAGE_CHANGED") return false;
      return isKEEBPDSearchURL(new URL(event.url));
    },
  },
  {
    from: "MONITORING_COMPOSE_PAGE",
    event: "PAGE_CHANGED",
    to: "OBSERVING_TWITTER_PAGE",
    condition: (event) => {
      if (event.type !== "PAGE_CHANGED") return false;
      const url = new URL(event.url);
      if (isKEEBPDSearchURL(url)) return false;
      if (url.pathname === COMPOSE_POST_PATH) return false;
      return true;
    },
    execute: (_event, context) => {
      context.collectedTweets.clear();
      console.info("Cleared tweets on navigation from compose page");
    },
  },
];

stateMachine.addTransitions(transitions);
stateMachine.dispatch({ type: "BEGIN_OBSERVING" });
