/// <reference lib="dom" />
import { ExecuteHandler, StateMachine, Transition } from "./state-machine.ts";
import {
  EntryTweetResult,
  getTweetText,
  isPromotionTweet,
  isQuoteRetweet,
  parseDetailTweet,
  parseEntryTweet,
  Tweet,
} from "./tweet-parser.ts";
import { COMPOSE_POST_PATH, DATA_ATTRS, SELECTORS } from "./selectors.ts";

type StateContext = {
  searchTimelineObserver: MutationObserver;
  twitterPageObserver: MutationObserver;
  tweetDetailObserver: MutationObserver;
  listeners: number[];
  tweet: Tweet;
  currentUrl: string;
};

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

const detectPageType = () => {
  const url = document.location;

  if (isKEEBPDSearchURL(new URL(url.href))) {
    const hasTimeline = !!document.querySelector(SELECTORS.SEARCH_TIMELINE);
    return { type: "search" as const, ready: hasTimeline };
  }

  if (url.pathname === COMPOSE_POST_PATH) {
    const hasButton = !!document.querySelector(SELECTORS.COMPOSE_BUTTON);
    return { type: "compose" as const, ready: hasButton };
  }

  if (url.pathname.match(/^\/.+\/status\/\d+/)) {
    const hasDetail = !!document.querySelector(SELECTORS.TWEET_DETAIL_TIMELINE);
    return { type: "detail" as const, ready: hasDetail };
  }

  return { type: "other" as const, ready: false };
};

const dispatchCurrentPageEvents = () => {
  const currentState = stateMachine.getState();
  const pageInfo = detectPageType();

  console.log(
    "[KEEB_PD] Page check:",
    document.location.pathname,
    "state:",
    currentState,
    "page:",
    pageInfo.type,
  );

  if (currentState === "OBSERVING_PAGE") {
    switch (pageInfo.type) {
      case "search":
        if (pageInfo.ready) {
          stateMachine.tryDispatch({
            type: "SEARCH_PAGE_READY",
            url: document.location.href,
            css_selector: SELECTORS.SEARCH_TIMELINE,
          });
        }
        break;
      case "compose":
        if (pageInfo.ready) {
          stateMachine.tryDispatch({
            type: "COMPOSE_PAGE_READY",
            url: document.location.pathname,
            css_selector: SELECTORS.COMPOSE_BUTTON,
          });
        }
        break;
      case "detail":
        if (pageInfo.ready) {
          stateMachine.tryDispatch({
            type: "TWEET_DETAIL_PAGE_READY",
            url: document.location.pathname,
            css_selector: SELECTORS.TWEET_DETAIL_TIMELINE,
          });
        }
        break;
    }
  }

  if (stateMachine.canHandle("PAGE_CHANGE")) {
    const url = currentState === "MONITORING_SEARCH"
      ? document.location.href
      : document.location.pathname;

    stateMachine.tryDispatch({
      type: "PAGE_CHANGE",
      url: url,
    });
  }
};

const observeTwitterPage: ExecuteHandler<StateContext> = (_event, context) => {
  context.twitterPageObserver.observe(document, {
    subtree: true,
    childList: true,
  });

  setTimeout(() => {
    dispatchCurrentPageEvents();
  }, 100);
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
  console.log("[KEEB_PD] Search timeline observer disconnected");
};

const disconnectTweetDetailObserver: ExecuteHandler<StateContext> = (
  _event,
  context,
) => {
  context.tweetDetailObserver.disconnect();
  console.log("[KEEB_PD] Tweet detail observer disconnected");
};

const setupComposePage: ExecuteHandler<StateContext> = (event, context) => {
  if (event.type !== "COMPOSE_PAGE_READY") return;
  const composeButton = document.querySelector(event.css_selector)!;
  const text = getTweetText(context.tweet);
  const unsetButton = composeButton.parentElement!;
  const div = document.createElement("div");
  div.addEventListener("click", (target) => {
    const currentTarget = target.currentTarget;
    if (currentTarget instanceof HTMLDivElement) {
      navigator.clipboard.writeText(text).then(() =>
        console.log("[KEEB_PD] Tweet text copied to clipboard")
      ).catch((err) => console.error("[KEEB_PD] Clipboard write failed:", err));
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

const setupRetweetListener = (tweetElement: Element, tweet: Tweet) => {
  const retweetButton = tweetElement.querySelector(SELECTORS.RETWEET_BUTTON) ??
    tweetElement.querySelector(SELECTORS.UNRETWEET_BUTTON);
  if (retweetButton) {
    if (retweetButton.hasAttribute(DATA_ATTRS.KEEB_LISTENER)) {
      return;
    }
    retweetButton.setAttribute(DATA_ATTRS.KEEB_LISTENER, "true");

    retweetButton.addEventListener("click", () => {
      stateMachine.dispatch({
        type: "TWEET_CONTEXT_UPDATED",
        tweet: { ...tweet },
      });
      console.log(
        "[KEEB_PD] Tweet context updated:",
        tweet.userName,
        "R" + tweet.round,
      );
    });
  }
};

const extractTweetElements = (
  mutations: MutationRecord[],
  options: {
    skipPromotions?: boolean;
    allowNested?: boolean;
  } = {},
): Element[] => {
  const { skipPromotions = false, allowNested = false } = options;

  return mutations.reduce((accumulatedNodes, mutation) => {
    const { addedNodes } = mutation;
    const filteredNodes = Array.from(addedNodes).filter((node) => {
      if (skipPromotions && (isPromotionTweet(node) || isQuoteRetweet(node))) {
        return false;
      }
      if (!(node instanceof Element)) return false;

      if (allowNested) {
        return node.getAttribute("data-testid") === DATA_ATTRS.CELL_INNER_DIV ||
          node.querySelector(SELECTORS.CELL_INNER_DIV);
      } else {
        return node.getAttribute("data-testid") === DATA_ATTRS.CELL_INNER_DIV;
      }
    }).reduce((elements, node) => {
      if (node instanceof Element) {
        if (node.getAttribute("data-testid") === DATA_ATTRS.CELL_INNER_DIV) {
          return [...elements, node];
        } else if (allowNested) {
          const innerDivs = node.querySelectorAll(SELECTORS.CELL_INNER_DIV);
          return [...elements, ...Array.from(innerDivs)];
        }
      }
      return elements;
    }, [] as Element[]);

    return [...accumulatedNodes, ...filteredNodes];
  }, [] as Element[]);
};

const processTweetElements = (
  elements: Element[],
  options: {
    parseFunction: (node: Node) => EntryTweetResult;
    logPrefix: string;
    setupRetweet?: boolean;
    setupRetweetViaListener?: boolean;
  },
) => {
  const {
    parseFunction,
    logPrefix,
    setupRetweet = true,
    setupRetweetViaListener = false,
  } = options;

  if (elements.length > 0) {
    console.log(`[KEEB_PD] ${logPrefix}:`, elements.length);
  }

  elements.forEach((tweetElement) => {
    const tweetData = parseFunction(tweetElement);
    if (tweetData.isEntryTweet) {
      console.log(
        `[KEEB_PD] ${logPrefix} KEEB_PD tweet:`,
        tweetData.tweet.userName,
        "R" + tweetData.tweet.round,
      );

      if (setupRetweet) {
        setupRetweetListener(tweetElement, tweetData.tweet);
      }

      if (setupRetweetViaListener) {
        const retweetButton =
          tweetElement.querySelector(SELECTORS.RETWEET_BUTTON) ??
            tweetElement.querySelector(SELECTORS.UNRETWEET_BUTTON);
        if (retweetButton) {
          retweetButton.addEventListener("click", () => {
            stateMachine.dispatch({
              type: "TWEET_CONTEXT_UPDATED",
              tweet: { ...tweetData.tweet },
            });
          });
        }
      }
    }
  });
};

const scanTweetsForRetweetListeners = () => {
  const allTweets = Array.from(
    document.querySelectorAll(SELECTORS.CELL_INNER_DIV),
  );
  processTweetElements(allTweets, {
    parseFunction: parseDetailTweet,
    logPrefix: "Found existing KEEB_PD tweet",
    setupRetweet: true,
  });
};

const setupTweetDetailPage: ExecuteHandler<StateContext> = (event, context) => {
  if (event.type !== "TWEET_DETAIL_PAGE_READY") return;

  context.currentUrl = document.location.pathname;

  context.tweetDetailObserver.observe(document, {
    subtree: true,
    childList: true,
  });

  console.log("[KEEB_PD] Tweet detail page monitoring started");
};

const twitterPageObserver = new MutationObserver(() => {
  dispatchCurrentPageEvents();
});

const tweetDetailObserver = new MutationObserver((mutations, _observer) => {
  if (!stateMachine.is("MONITORING_TWEET_DETAIL")) return;

  const validNodes = extractTweetElements(mutations, {
    skipPromotions: false,
    allowNested: true,
  });

  processTweetElements(validNodes, {
    parseFunction: parseDetailTweet,
    logPrefix: "New tweets detected",
    setupRetweet: true,
  });
});

const searchTimelineObserver = new MutationObserver((mutations, _observer) => {
  const validNodes = extractTweetElements(mutations, {
    skipPromotions: true,
    allowNested: false,
  });

  processTweetElements(validNodes, {
    parseFunction: parseEntryTweet,
    logPrefix: "Processing new tweets in search timeline",
    setupRetweet: false,
    setupRetweetViaListener: true,
  });
});

const stateMachine = new StateMachine<StateContext>("IDLE", {
  searchTimelineObserver,
  twitterPageObserver,
  tweetDetailObserver,
  listeners: [],
  tweet: {
    date: "",
    fav: 0,
    retweet: 0,
    round: "",
    url: "",
    userName: "",
  },
  currentUrl: "",
});

stateMachine.addListener((result) => {
  if (result.success) {
    console.log(`[KEEB_PD] State: ${result.from} → ${result.to}`);
  } else {
    console.log(
      `[KEEB_PD] State transition failed: ${result.from} (${result.reason})`,
    );
  }
});
const transitions: Transition<StateContext>[] = [
  {
    from: "IDLE",
    to: "OBSERVING_PAGE",
    event: "START",
    execute: observeTwitterPage,
  },
  {
    // User navigated to KEEB_PD search page and timeline is ready
    from: "OBSERVING_PAGE",
    event: "SEARCH_PAGE_READY",
    to: "MONITORING_SEARCH",
    condition: (event, _context) => {
      if (event.type !== "SEARCH_PAGE_READY") return false;
      if (!isKEEBPDSearchURL(new URL(event.url))) return false;
      const searchTimelineElement = document.querySelector(event.css_selector);
      return !!searchTimelineElement;
    },
    execute: observeSearchTimeline,
  },
  {
    from: "MONITORING_SEARCH",
    event: "TWEET_CONTEXT_UPDATED",
    to: "MONITORING_SEARCH",
    execute: (event, context) => {
      if (event.type !== "TWEET_CONTEXT_UPDATED") return;
      context.tweet = { ...event.tweet };
    },
  },
  {
    from: "MONITORING_SEARCH",
    event: "PAGE_CHANGE",
    to: "OBSERVING_PAGE",
    condition: (event, _context) => {
      if (event.type !== "PAGE_CHANGE") return false;
      const url = new URL(event.url);
      if (isKEEBPDSearchURL(url)) {
        return false;
      }
      return true;
    },
    execute: disconnectSearchTimeline,
  },
  {
    // User navigated from search to compose page, inject copy button
    from: "MONITORING_SEARCH",
    event: "COMPOSE_PAGE_READY",
    to: "MONITORING_COMPOSE",
    condition: (event, _context) => {
      if (event.type !== "COMPOSE_PAGE_READY") return false;
      if (event.url !== COMPOSE_POST_PATH) return false;
      const composeButton = document.querySelector(event.css_selector);
      return !!composeButton;
    },
    execute: (event, context) => {
      disconnectSearchTimeline(event, context);
      setupComposePage(event, context);
    },
  },
  {
    from: "MONITORING_COMPOSE",
    event: "PAGE_CHANGE",
    to: "OBSERVING_PAGE",
    condition: (event, _context) => {
      if (event.type !== "PAGE_CHANGE") return false;
      return event.url !== COMPOSE_POST_PATH;
    },
  },
  {
    // User navigated to an individual tweet detail page
    from: "OBSERVING_PAGE",
    event: "TWEET_DETAIL_PAGE_READY",
    to: "MONITORING_TWEET_DETAIL",
    condition: (event, _context) => {
      if (event.type !== "TWEET_DETAIL_PAGE_READY") return false;
      if (!event.url.match(/^\/.+\/status\/\d+/)) return false;
      const tweetDetailElement = document.querySelector(event.css_selector);
      return !!tweetDetailElement;
    },
    execute: setupTweetDetailPage,
  },
  {
    from: "MONITORING_TWEET_DETAIL",
    event: "TWEET_CONTEXT_UPDATED",
    to: "MONITORING_TWEET_DETAIL",
    execute: (event, context) => {
      if (event.type !== "TWEET_CONTEXT_UPDATED") return;
      context.tweet = { ...event.tweet };
    },
  },
  {
    // User navigated from tweet detail to compose page, inject copy button
    from: "MONITORING_TWEET_DETAIL",
    event: "COMPOSE_PAGE_READY",
    to: "MONITORING_COMPOSE",
    condition: (event, _context) => {
      if (event.type !== "COMPOSE_PAGE_READY") return false;
      if (event.url !== COMPOSE_POST_PATH) return false;
      const composeButton = document.querySelector(event.css_selector);
      return !!composeButton;
    },
    execute: (event, context) => {
      disconnectTweetDetailObserver(event, context);
      setupComposePage(event, context);
    },
  },
  {
    // User navigated to a different tweet detail page while already on detail view
    from: "MONITORING_TWEET_DETAIL",
    event: "TWEET_DETAIL_PAGE_READY",
    to: "MONITORING_TWEET_DETAIL",
    condition: (event, context) => {
      if (event.type !== "TWEET_DETAIL_PAGE_READY") return false;
      // Check if new URL is a different detail page than current
      const isDetailPage = !!event.url.match(/^\/\w+\/status\/\d+/);
      const isUrlChanged = context.currentUrl !== event.url;
      return isDetailPage && isUrlChanged;
    },
    execute: (event, context) => {
      if (event.type !== "TWEET_DETAIL_PAGE_READY") return;
      console.log(`[KEEB_PD] Tweet detail page navigation: ${event.url}`);
      // Update current URL and scan new page for KEEB_PD tweets
      context.currentUrl = event.url;
      scanTweetsForRetweetListeners();
    },
  },
  {
    from: "MONITORING_TWEET_DETAIL",
    event: "PAGE_CHANGE",
    to: "OBSERVING_PAGE",
    condition: (event, _context) => {
      if (event.type !== "PAGE_CHANGE") return false;
      if (event.url.match(/^\/.+\/status\/\d+/)) return false;
      return true;
    },
    execute: disconnectTweetDetailObserver,
  },
];

stateMachine.addTransitions(transitions);
stateMachine.dispatch({ type: "START" });
