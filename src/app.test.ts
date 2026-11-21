// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createApp, filterTweetNodes } from "./app.ts";
import { PANEL_ID } from "./panel.ts";
import { createNode, promotion, quote, tweetHtml } from "./test-fixtures.ts";

const SEARCH_URL = "/search?f=live&q=%23KEEB_PD_R123%20min_faves%3A5";
const TIMELINE_LABEL = "タイムライン: タイムラインを検索";

type FakeObserver = {
  callback: MutationCallback;
  observe: Mock<MutationObserver["observe"]>;
  disconnect: Mock<MutationObserver["disconnect"]>;
};

const mutation = (...nodes: Node[]): MutationRecord =>
  ({ addedNodes: nodes }) as unknown as MutationRecord;

const setup = () => {
  const observers: FakeObserver[] = [];
  const app = createApp({
    document,
    createObserver: (callback) => {
      const observer: FakeObserver = {
        callback,
        observe: vi.fn<MutationObserver["observe"]>(),
        disconnect: vi.fn<MutationObserver["disconnect"]>(),
      };
      observers.push(observer);
      return observer;
    },
  });
  // createApp は twitterPageObserver → searchTimelineObserver の順に作る
  const [twitter, timeline] = observers;
  const fire = (observer: FakeObserver, ...records: MutationRecord[]) =>
    observer.callback(records, {} as MutationObserver);
  return {
    app,
    twitter,
    timeline,
    // ページの変化を知らせる
    pageMutated: () => fire(twitter),
    // タイムラインにツイートが追加された
    tweetsAdded: (...nodes: Node[]) => fire(timeline, mutation(...nodes)),
  };
};

type Harness = ReturnType<typeof setup>;

const navigate = (path: string) => history.pushState({}, "", path);

const toSearchPage = (h: Harness) => {
  document.body.innerHTML = `<div aria-label="${TIMELINE_LABEL}"></div>`;
  navigate(SEARCH_URL);
  h.pageMutated();
};

const toComposePage = (h: Harness) => {
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div id="compose"><button data-testid="unsentButton"></button></div>`,
  );
  navigate("/compose/post");
  h.pageMutated();
};

const tweetNode = (href: string, options: Parameters<typeof tweetHtml>[0] = {}) =>
  createNode(tweetHtml({ href, ...options }));

const panelButton = (label: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>(`#${PANEL_ID} button`)).find((b) =>
    b.textContent?.includes(label),
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  // jsdom には matchMedia が無い（パネルのテーマ判定が使う）
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  navigate("/");
  document.body.innerHTML = "";
});

afterEach(() => {
  Reflect.deleteProperty(URL, "createObjectURL");
  Reflect.deleteProperty(URL, "revokeObjectURL");
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("filterTweetNodes", () => {
  it("cellInnerDiv の要素だけを、複数の mutation をまたいで返す", () => {
    const a = tweetNode("/a/status/1");
    const b = tweetNode("/b/status/2");
    const other = document.createElement("div");
    const text = document.createTextNode("text");
    expect(filterTweetNodes([mutation(a, other, text), mutation(b)])).toEqual([a, b]);
  });

  it("プロモーションと引用リツイートは除外する", () => {
    const normal = tweetNode("/a/status/1");
    expect(filterTweetNodes([mutation(createNode(promotion), createNode(quote), normal)])).toEqual([
      normal,
    ]);
  });

  it("何も追加されていなければ空", () => {
    expect(filterTweetNodes([])).toEqual([]);
    expect(filterTweetNodes([mutation()])).toEqual([]);
  });
});

describe("遷移: ページ監視の開始と検索ページ", () => {
  it("start() で OBSERVING_TWITTER_PAGE になり、document を監視する", () => {
    const h = setup();
    expect(h.app.getState()).toBe("INITIAL");
    h.app.start();
    expect(h.app.getState()).toBe("OBSERVING_TWITTER_PAGE");
    expect(h.twitter.observe).toHaveBeenCalledWith(document, { subtree: true, childList: true });
    expect(h.timeline.observe).not.toHaveBeenCalled();
  });

  it("KEEB_PD の検索URLでもタイムラインが無ければ LOADING_SEARCH_PAGE で待つ", () => {
    const h = setup();
    h.app.start();
    navigate(SEARCH_URL);
    h.pageMutated();
    expect(h.app.getState()).toBe("LOADING_SEARCH_PAGE");
  });

  it.each([["/search?q=%23KEEB_PD_R1"], ["/search?f=live&q=foo"], ["/home"]])(
    "KEEB_PD の検索URLでなければ遷移しない: %s",
    (path) => {
      const h = setup();
      h.app.start();
      document.body.innerHTML = `<div aria-label="${TIMELINE_LABEL}"></div>`;
      navigate(path);
      h.pageMutated();
      expect(h.app.getState()).toBe("OBSERVING_TWITTER_PAGE");
    },
  );

  it("タイムラインが現れると MONITORING_SEARCH_PAGE になり、監視とパネルを始める", () => {
    const h = setup();
    h.app.start();
    toSearchPage(h);
    expect(h.app.getState()).toBe("MONITORING_SEARCH_PAGE");
    expect(h.timeline.observe).toHaveBeenCalledWith(document, { subtree: true, childList: true });
    expect(document.querySelectorAll(`#${PANEL_ID}`)).toHaveLength(1);
    expect(h.app.getContext().listeners).toHaveLength(1);
  });
});

describe("ツイートの収集", () => {
  const monitoring = () => {
    const h = setup();
    h.app.start();
    toSearchPage(h);
    return h;
  };

  it("有効なツイートを url をキーに収集し、同じ url は上書きする", () => {
    const h = monitoring();
    h.tweetsAdded(tweetNode("/a/status/1", { fav: "3" }), tweetNode("/b/status/2"));
    h.tweetsAdded(tweetNode("/a/status/1", { fav: "9" }));
    const collected = h.app.getContext().collectedTweets;
    expect([...collected.keys()]).toEqual(["/a/status/1", "/b/status/2"]);
    expect(collected.get("/a/status/1")?.fav).toBe(9);
  });

  it("解析できないノード・ラウンドの無いツイートは収集しない", () => {
    const h = monitoring();
    h.tweetsAdded(tweetNode("/a/status/1", { text: "ラウンド番号なし" }), createNode(promotion));
    expect(h.app.getContext().collectedTweets.size).toBe(0);
  });

  it("リツイートボタンを押すと、そのツイートが投稿用のコンテキストに入る", () => {
    const h = monitoring();
    const node = tweetNode("/a/status/1", { fav: "5" });
    h.tweetsAdded(node);
    node.querySelector<HTMLButtonElement>('button[data-testid="retweet"]')?.click();
    expect(h.app.getContext().tweet).toMatchObject({ url: "/a/status/1", fav: 5, round: "123" });
  });

  it("リツイート済み（unretweet）のボタンでも同じ", () => {
    const h = monitoring();
    const node = tweetNode("/a/status/1", { retweetTestId: "unretweet" });
    h.tweetsAdded(node);
    node.querySelector<HTMLButtonElement>('button[data-testid="unretweet"]')?.click();
    expect(h.app.getContext().tweet.url).toBe("/a/status/1");
  });

  it("検索ページの監視中でなければ、ツイートが追加されても収集しない", () => {
    const h = setup();
    h.app.start();
    expect(() => h.tweetsAdded(tweetNode("/a/status/1"))).not.toThrow();
    expect(h.app.getContext().collectedTweets.size).toBe(0);
  });
});

describe("パネル", () => {
  const monitoring = () => {
    const h = setup();
    h.app.start();
    toSearchPage(h);
    return h;
  };

  it("1秒ごとに収集件数を反映する", () => {
    const h = monitoring();
    h.tweetsAdded(tweetNode("/a/status/1"));
    vi.advanceTimersByTime(1000);
    expect(document.querySelector(`#${PANEL_ID} .kp-count`)?.textContent).toBe("1件");
  });

  it("ダウンロードで JSON を保存し、後始末をする", () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:test");
    const revokeObjectURL = vi.fn();
    // jsdom の URL には無いので、テストのあいだだけ差し込む（afterEach で消す）
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });

    const h = monitoring();
    h.tweetsAdded(tweetNode("/a/status/1"));
    vi.advanceTimersByTime(1000);
    panelButton("ダウンロード")?.click();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0][0].type).toBe("application/json");
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/^keeb-pd-tweets-\d{4}-\d{2}-\d{2}T[\d-]+Z\.json$/);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
    expect(document.querySelector("a[download]")).toBeNull(); // body に残さない
  });

  it("クリアを2回押すと収集したツイートを全て削除する", () => {
    const h = monitoring();
    h.tweetsAdded(tweetNode("/a/status/1"));
    vi.advanceTimersByTime(1000);
    panelButton("クリア")?.click();
    expect(h.app.getContext().collectedTweets.size).toBe(1);
    panelButton("もう一度押して削除")?.click();
    expect(h.app.getContext().collectedTweets.size).toBe(0);
    expect(document.querySelector(`#${PANEL_ID} .kp-count`)?.textContent).toBe("0件");
  });
});

describe("検索ページから離れたとき", () => {
  it("監視を止め、パネル・interval・収集済みツイートを片付けて OBSERVING_TWITTER_PAGE に戻る", () => {
    const h = setup();
    h.app.start();
    toSearchPage(h);
    h.tweetsAdded(tweetNode("/a/status/1"));

    navigate("/home");
    h.pageMutated();

    expect(h.app.getState()).toBe("OBSERVING_TWITTER_PAGE");
    expect(h.timeline.disconnect).toHaveBeenCalledTimes(1);
    expect(document.getElementById(PANEL_ID)).toBeNull();
    expect(h.app.getContext().listeners).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    expect(h.app.getContext().collectedTweets.size).toBe(0);
  });

  it("別の KEEB_PD 検索URLに移っただけなら監視を続ける", () => {
    const h = setup();
    h.app.start();
    toSearchPage(h);
    h.tweetsAdded(tweetNode("/a/status/1"));
    navigate("/search?f=live&q=%23KEEB_PD_R124");
    h.pageMutated();
    expect(h.app.getState()).toBe("MONITORING_SEARCH_PAGE");
    expect(h.app.getContext().collectedTweets.size).toBe(1);
  });

  it("パネルが既にあっても、検索ページの読み込み時に1つだけ作り直す", () => {
    const h = setup();
    h.app.start();
    document.body.innerHTML = `<div aria-label="${TIMELINE_LABEL}"></div><div id="${PANEL_ID}">古いパネル</div>`;
    navigate(SEARCH_URL);
    h.pageMutated();
    const panels = document.querySelectorAll(`#${PANEL_ID}`);
    expect(panels).toHaveLength(1);
    expect(panels[0].textContent).not.toContain("古いパネル");
  });

  it("離れてから検索ページに戻ると、パネルを作り直す", () => {
    const h = setup();
    h.app.start();
    toSearchPage(h);
    navigate("/home");
    h.pageMutated();
    toSearchPage(h);
    expect(h.app.getState()).toBe("MONITORING_SEARCH_PAGE");
    expect(document.querySelectorAll(`#${PANEL_ID}`)).toHaveLength(1);
  });
});

describe("投稿ページ", () => {
  const onSearch = () => {
    const h = setup();
    h.app.start();
    toSearchPage(h);
    return h;
  };

  it("投稿ページを開き、ボタンが現れると MONITORING_COMPOSE_PAGE になる", () => {
    const h = onSearch();
    navigate("/compose/post");
    h.pageMutated();
    expect(h.app.getState()).toBe("LOADING_COMPOSE_PAGE");
    toComposePage(h);
    expect(h.app.getState()).toBe("MONITORING_COMPOSE_PAGE");
  });

  it("コピー用ボタンを追加し、押すと祝福メッセージをクリップボードに書く", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const h = onSearch();
    const node = tweetNode("/a/status/1", { nameHtml: "<span>ふぁぼ太郎</span>" });
    h.tweetsAdded(node);
    node.querySelector<HTMLButtonElement>('button[data-testid="retweet"]')?.click();
    toComposePage(h);

    const added = document.querySelector<HTMLDivElement>("#compose > div");
    expect(added?.querySelector("svg")).not.toBeNull();
    added?.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain("#KEEB_PD_R123 で一番ふぁぼ(❤42)が多かったのは");
    expect(writeText.mock.calls[0][0]).toContain("ふぁぼ太郎 さん");
  });

  it("クリップボードへの書き込みに失敗したらエラーを出す", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const h = onSearch();
    toComposePage(h);
    document.querySelector<HTMLDivElement>("#compose > div")?.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(console.error).toHaveBeenCalledWith("Clipboard write failed", expect.any(Error));
  });

  it("投稿ページにいる間は収集済みツイートを保つ", () => {
    const h = onSearch();
    h.tweetsAdded(tweetNode("/a/status/1"));
    toComposePage(h);
    h.pageMutated();
    expect(h.app.getState()).toBe("MONITORING_COMPOSE_PAGE");
    expect(h.app.getContext().collectedTweets.size).toBe(1);
  });

  it("KEEB_PD の検索URLに戻ると MONITORING_SEARCH_PAGE に戻る", () => {
    const h = onSearch();
    toComposePage(h);
    navigate(SEARCH_URL);
    h.pageMutated();
    expect(h.app.getState()).toBe("MONITORING_SEARCH_PAGE");
  });

  // 既知のバグ: StateMachine は (from, event) が一致する最初の遷移しか評価しないため、
  // 2本目の PAGE_CHANGED（検索以外へ離れる）に到達できない。修正されたら it.fails を外す
  it.fails("KNOWN BUG: 投稿ページから検索以外へ離れると OBSERVING_TWITTER_PAGE に戻る", () => {
    const h = onSearch();
    h.tweetsAdded(tweetNode("/a/status/1"));
    toComposePage(h);

    navigate("/home");
    h.pageMutated();

    expect(h.app.getState()).toBe("OBSERVING_TWITTER_PAGE");
    expect(h.app.getContext().collectedTweets.size).toBe(0);
  });

  // LOADING_* には PAGE_CHANGED の遷移自体が無く、読み込み中に離れると固まる（これも修正待ち）
  it.todo("読み込み中（LOADING_*）にページを離れても OBSERVING_TWITTER_PAGE に戻る");
});
