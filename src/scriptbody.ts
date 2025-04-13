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
};

const COMPOSE_POST_PATH = "/compose/post";

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
    url: document.location.pathname,
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
          url: document.location.pathname,
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
      tweetData.isEntryTweet ? JSON.stringify(tweetData.tweet) : "invalid",
    );
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
    execute: observeSearchTimeline,
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
    execute: disconnectSearchTimeline,
  },
  {
    from: "MONITORING_SEARCH_PAGE",
    event: "DETECT_COMPOSE_URL",
    to: "LOADING_COMPOSE_PAGE",
    condition: (event) => {
      if (event.type !== "DETECT_COMPOSE_URL") return false;
      return event.url === COMPOSE_POST_PATH;
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
    to: "OBSERVING_TWITTER_PAGE",
    condition: (event) => {
      if (event.type !== "PAGE_CHANGED") return false;
      return event.url !== COMPOSE_POST_PATH;
    },
  },
];

stateMachine.addTransitions(transitions);
stateMachine.dispatch({ type: "BEGIN_OBSERVING" });
