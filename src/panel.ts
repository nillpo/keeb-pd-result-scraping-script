import { createIcon, type IconName } from "./icons.ts";
import { installPanelStyles, PANEL_ID } from "./panel-styles.ts";
import type { Tweet } from "./tweet-parser.ts";

export { PANEL_ID };

export type PanelActions = {
  onDownload: () => void;
  onClear: () => void;
};

export type Panel = {
  element: HTMLElement;
  // 1秒ごとなどに呼ぶ。内容が変わっていなければDOMは作り直さない
  update: (tweets: Tweet[]) => void;
};

const COLLAPSED_KEY = "keeb-pd-panel-collapsed";
// 「クリア」を押してから、もう一度押すまでの猶予（ミリ秒）
const CLEAR_CONFIRM_MS = 3000;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function setButtonContent(button: HTMLButtonElement, icon: IconName, label: string): void {
  const text = element("span");
  text.textContent = label;
  button.replaceChildren(createIcon(icon, "1.15em"), text);
}

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
};

const writeCollapsed = (collapsed: boolean): void => {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // ストレージが使えない環境では、折りたたみ状態を保存しない
  }
};

// Twitter/X のテーマ（ライト / Dim / ライツアウト）はOSの設定とは別なので、ページの背景色から判定する
function isDarkPage(): boolean {
  // rgb() / rgba() 以外の表記（color(srgb ...) など）は、値の範囲が違うので判定せずOSの設定に従う
  const color = getComputedStyle(document.body).backgroundColor;
  const values = color.startsWith("rgb") ? color.match(/[\d.]+/g) : null;
  const transparent = values !== null && values.length >= 4 && Number(values[3]) === 0;
  if (values === null || values.length < 3 || transparent) {
    return matchMedia("(prefers-color-scheme: dark)").matches;
  }
  const [r, g, b] = values.map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

const getTop5Tweets = (tweets: Tweet[]): Tweet[] =>
  [...tweets].sort((a, b) => b.fav - a.fav).slice(0, 5);

function openTweet(tweet: Tweet): void {
  const baseUrl =
    globalThis.location.hostname === "x.com" ? "https://x.com" : "https://twitter.com";
  const fullUrl = `${baseUrl}${tweet.url}`;
  globalThis.open(fullUrl, "_blank", "noopener");
  console.log(`Opened tweet in new tab: ${fullUrl}`);
}

function createRow(tweet: Tweet, rank: number): HTMLButtonElement {
  const row = element("button", "kp-row");
  row.type = "button";
  row.title = `${tweet.userName} のツイートを開く`;

  const rankLabel = element("span", "kp-rank");
  rankLabel.textContent = String(rank);

  const name = element("span", "kp-name");
  name.textContent = tweet.userName;

  const fav = element("span", "kp-fav");
  fav.append(createIcon("heart", "0.95em"), String(tweet.fav));

  row.append(rankLabel, name, fav);
  row.addEventListener("click", () => openTweet(tweet));
  return row;
}

export function createPanel(actions: PanelActions): Panel {
  installPanelStyles();

  const root = element("div");
  root.id = PANEL_ID;

  // ヘッダー（クリックで折りたたみ）
  const header = element("button", "kp-header");
  header.type = "button";
  const title = element("span", "kp-title");
  title.append(createIcon("paw", "1.2em"), "KEEB_PD");
  const count = element("span", "kp-count");
  const chevron = createIcon("chevron", "1.1em");
  chevron.classList.add("kp-chevron");
  header.append(title, count, chevron);

  const setCollapsed = (collapsed: boolean): void => {
    root.dataset.collapsed = String(collapsed);
    header.setAttribute("aria-expanded", String(!collapsed));
    header.title = collapsed ? "パネルを開く" : "パネルを閉じる";
  };
  setCollapsed(readCollapsed());
  header.addEventListener("click", () => {
    const collapsed = root.dataset.collapsed !== "true";
    setCollapsed(collapsed);
    writeCollapsed(collapsed);
  });

  // 本体
  const body = element("div", "kp-body");
  const caption = element("div", "kp-caption");
  caption.textContent = "ふぁぼ数 Top 5";
  const list = element("div", "kp-list");

  const actionsRow = element("div", "kp-actions");
  const downloadButton = element("button", "kp-btn kp-btn--primary");
  downloadButton.type = "button";
  downloadButton.title = "収集したツイートをJSONでダウンロード";
  setButtonContent(downloadButton, "download", "ダウンロード");
  downloadButton.addEventListener("click", actions.onDownload);

  // 確認ダイアログの代わりに、2回押して削除する
  const clearButton = element("button", "kp-btn");
  clearButton.type = "button";
  clearButton.title = "収集したツイートをすべて削除";
  let confirmTimer: number | undefined;
  const resetClear = (): void => {
    if (confirmTimer !== undefined) clearTimeout(confirmTimer);
    confirmTimer = undefined;
    clearButton.classList.remove("kp-btn--confirm");
    setButtonContent(clearButton, "trash", "クリア");
  };
  resetClear();
  clearButton.addEventListener("click", () => {
    if (confirmTimer === undefined) {
      clearButton.classList.add("kp-btn--confirm");
      setButtonContent(clearButton, "trash", "もう一度押して削除");
      confirmTimer = window.setTimeout(resetClear, CLEAR_CONFIRM_MS);
      return;
    }
    resetClear();
    actions.onClear();
  });

  actionsRow.append(downloadButton, clearButton);
  body.append(caption, list, actionsRow);
  root.append(header, body);

  // 前回の描画内容。同じなら作り直さない（ホバー中のちらつきを防ぐ）
  let renderedKey: string | undefined;

  const update = (tweets: Tweet[]): void => {
    root.dataset.theme = isDarkPage() ? "dark" : "light";

    count.textContent = `${tweets.length}件`;
    downloadButton.disabled = tweets.length === 0;
    clearButton.disabled = tweets.length === 0;
    if (tweets.length === 0) resetClear();

    const top5 = getTop5Tweets(tweets);
    const key = top5.map((tweet) => `${tweet.url}:${tweet.fav}:${tweet.userName}`).join("|");
    if (key === renderedKey) return;
    renderedKey = key;

    if (top5.length === 0) {
      const empty = element("div", "kp-empty");
      empty.textContent = "まだ収集されていません";
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(...top5.map((tweet, index) => createRow(tweet, index + 1)));
  };

  return { element: root, update };
}
