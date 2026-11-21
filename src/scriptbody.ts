/// <reference lib="dom" />
import { ExecuteHandler, StateMachine, Transition } from "./state-machine.ts";
import {
  getTweetText,
  isPromotionTweet,
  isQuoteRetweet,
  parseEntryTweet,
  Tweet,
} from "./tweet-parser.ts";
import { createIcon } from "./icons.ts";
import { createPanel, PANEL_ID } from "./panel.ts";
import { createTweetExport } from "./tweet-export.ts";

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

const observeSearchTimeline: ExecuteHandler<StateContext> = (_event, context) => {
  context.searchTimelineObserver.observe(document, {
    subtree: true,
    childList: true,
  });
};

const disconnectSearchTimeline: ExecuteHandler<StateContext> = (_event, context) => {
  context.searchTimelineObserver.disconnect();

  // Remove download panel from DOM
  const panel = document.getElementById(PANEL_ID);
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
      navigator.clipboard
        .writeText(text)
        .then(() => console.log("Text copied!"))
        .catch((err) => console.error("Clipboard write failed", err));
    }
  });

  div.style.cssText = `display: flex; align-items: center; justify-content: center;
     height: 1.5em; width: 1.5em;
     padding: 0.15em;
     color: rgb(29, 155, 240);
     cursor: pointer;`;
  div.append(createIcon("paw", "1.5em"));
  unsetButton.append(div);
};

const downloadTweets = (tweets: Tweet[]): void => {
  // JSONの collectedAt とファイル名のタイムスタンプを同じ時刻にする
  const now = new Date();
  const json = JSON.stringify(createTweetExport(tweets, now), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  a.download = `keeb-pd-tweets-${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`Downloaded ${tweets.length} tweets`);
};

const setupDownloadButton: ExecuteHandler<StateContext> = (event, context) => {
  if (event.type !== "SEARCH_PAGE_LOADED") return;

  // Remove existing panel if present (handles re-navigation)
  document.getElementById(PANEL_ID)?.remove();

  const getTweets = (): Tweet[] => Array.from(context.collectedTweets.values());
  const panel = createPanel({
    onDownload: () => downloadTweets(getTweets()),
    onClear: () => {
      context.collectedTweets.clear();
      panel.update([]);
      console.log("Cleared all collected tweets");
    },
  });

  // Initial update and periodic refresh
  panel.update(getTweets());
  const intervalId = setInterval(() => panel.update(getTweets()), 1000);
  context.listeners.push(intervalId);

  document.body.appendChild(panel.element);
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
  const validNodes = mutations.reduce((accumulatedNodes, mutation) => {
    const { addedNodes } = mutation;
    const filteredNodes = Array.from(addedNodes)
      .filter((node) => {
        if (isPromotionTweet(node) || isQuoteRetweet(node)) {
          return false;
        }
        if (!(node instanceof Element)) return false;
        if (node.getAttribute("data-testid") !== "cellInnerDiv") return false;
        return true;
      })
      .reduce((elements, node) => {
        if (node instanceof Element) {
          return [...elements, node];
        }
        return elements;
      }, [] as Element[]);

    return [...accumulatedNodes, ...filteredNodes];
  }, [] as Element[]);

  console.log("Filtered nodes:", validNodes);

  validNodes.forEach((node) => {
    const retweetButton =
      node.querySelector(`button[data-testid="retweet"]`) ??
      node.querySelector(`button[data-testid="unretweet"]`);
    const tweetData = parseEntryTweet(node);

    console.log(
      "TWEET PARSE",
      tweetData.isEntryTweet ? JSON.stringify(tweetData.tweet) : tweetData.reason,
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
    console.log(`Failed to transition from ${result.from} due to ${result.reason}`);
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
      console.log(`Collected: ${event.tweet.url} (Total: ${context.collectedTweets.size})`);
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
      const composeButton = document.querySelector(event.css_selector);
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
