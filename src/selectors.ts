export const SELECTORS = {
  SEARCH_TIMELINE: `div[aria-label="タイムライン: タイムラインを検索"]`,
  COMPOSE_BUTTON: `button[data-testid="unsentButton"]`,
  TWEET_DETAIL_TIMELINE: `div[aria-label="タイムライン: 会話"]`,

  CELL_INNER_DIV: `div[data-testid="cellInnerDiv"]`,
  TWEET_ARTICLE: `article[data-testid="tweet"]`,
  TWEET_TEXT: `div[data-testid="tweetText"]`,
  USER_NAME: `article div[data-testid="User-Name"]`,

  RETWEET_BUTTON: `button[data-testid="retweet"]`,
  UNRETWEET_BUTTON: `button[data-testid="unretweet"]`,
  LIKE_BUTTON: `button[data-testid="like"]`,

  APP_TEXT_CONTAINER: `span[data-testid="app-text-transition-container"]`,

  LIKE_COUNT:
    `button[data-testid="like"] span[data-testid="app-text-transition-container"]`,
  RETWEET_COUNT:
    `button[data-testid="retweet"] span[data-testid="app-text-transition-container"]`,
  UNRETWEET_COUNT:
    `button[data-testid="unretweet"] span[data-testid="app-text-transition-container"]`,
  USER_NAME_SPAN:
    `div:first-child>div>a[role="link"] > div:first-child > div:first-child > span`,
  TWEET_DETAIL_LINK:
    `div:nth-child(2) > div > div:nth-child(3) > a[role="link"]`,
} as const;

export const DATA_ATTRS = {
  KEEB_LISTENER: "data-keeb-listener",
  CELL_INNER_DIV: "cellInnerDiv",
  TWEET: "tweet",
  USER_NAME: "User-Name",
  LIKE: "like",
  RETWEET: "retweet",
  UNRETWEET: "unretweet",
  UNSENT_BUTTON: "unsentButton",
  TWEET_TEXT: "tweetText",
  APP_TEXT_CONTAINER: "app-text-transition-container",
} as const;

export const COMPOSE_POST_PATH = "/compose/post";
