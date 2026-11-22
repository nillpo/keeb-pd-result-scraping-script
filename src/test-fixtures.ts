// テストで使う、X のツイートDOM（セレクタが辿る構造だけを再現）
export type FixtureOptions = {
  fav?: string | null;
  retweetTestId?: "retweet" | "unretweet" | null;
  retweet?: string;
  nameHtml?: string;
  text?: string | null;
  date?: string;
  href?: string;
  extra?: string;
};

// parseEntryTweet のセレクタが辿る構造だけを再現した最小のツイートDOM
export const tweetHtml = (options: FixtureOptions = {}): string => {
  const {
    fav = "42",
    retweetTestId = "retweet",
    retweet = "7",
    nameHtml = "<span>ふぁぼ太郎</span>",
    text = "#KEEB_PD_R123 今回の作品です",
    date = "2026-02-15T14:30:45.000Z",
    href = "/user/status/1",
    extra = "",
  } = options;
  const likeButton =
    fav === null
      ? ""
      : `<button data-testid="like"><span data-testid="app-text-transition-container">${fav}</span></button>`;
  const retweetButton =
    retweetTestId === null
      ? ""
      : `<button data-testid="${retweetTestId}"><span data-testid="app-text-transition-container">${retweet}</span></button>`;
  const tweetText = text === null ? "" : `<div data-testid="tweetText">${text}</div>`;
  return `<div data-testid="cellInnerDiv">
    <article data-testid="tweet">
      <div data-testid="User-Name">
        <div><div><a role="link"><div><div><span>${nameHtml}</span></div></div></a></div></div>
        <div><div><div></div><div></div><div><a role="link" href="${href}"><time datetime="${date}"></time></a></div></div></div>
      </div>
      ${tweetText}
      ${likeButton}${retweetButton}
      ${extra}
    </article>
  </div>`;
};

export const createNode = (html: string): HTMLDivElement => {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container.firstElementChild as HTMLDivElement;
};

// article > div > div > div:last-child > div > div:last-child > div > div > span
export const promotion = `<div data-testid="cellInnerDiv"><article data-testid="tweet"><div><div><div><div><div><div><div><span>プロモーション</span></div></div></div></div></div></div></div></article></div>`;
// article > div > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(3) > div > div[tabindex="0"] > div time
export const quote = `<div data-testid="cellInnerDiv"><article><div><div><div></div><div><div></div><div><div></div><div></div><div><div><div tabindex="0"><div><time></time></div></div></div></div></div></div></div></div></article></div>`;
