// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPanel, getTop5Tweets } from "./panel.ts";
import type { Tweet } from "./tweet-parser.ts";

const makeTweet = (n: number, fav: number): Tweet => ({
  date: "2026-02-15T14:30:45.000Z",
  fav,
  retweet: 0,
  url: `/user${n}/status/${n}`,
  userName: `user${n}`,
  round: "1",
});

describe("getTop5Tweets", () => {
  it("ふぁぼ数の多い順に上位5件を返す", () => {
    const tweets = [3, 10, 1, 8, 5, 7, 2].map((fav, i) => makeTweet(i, fav));
    expect(getTop5Tweets(tweets).map((t) => t.fav)).toEqual([10, 8, 7, 5, 3]);
  });

  it("5件未満ならそのまま並べ替えて返す", () => {
    expect(getTop5Tweets([makeTweet(1, 1), makeTweet(2, 2)]).map((t) => t.fav)).toEqual([2, 1]);
    expect(getTop5Tweets([])).toEqual([]);
  });

  it("同数のときは元の順序を保ち、入力を書き換えない", () => {
    const tweets = [makeTweet(1, 5), makeTweet(2, 5), makeTweet(3, 9)];
    const snapshot = [...tweets];
    expect(getTop5Tweets(tweets).map((t) => t.url)).toEqual([
      "/user3/status/3",
      "/user1/status/1",
      "/user2/status/2",
    ]);
    expect(tweets).toEqual(snapshot);
  });
});

describe("createPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    // jsdom には matchMedia が無い
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  const setup = () => {
    const actions = { onDownload: vi.fn(), onClear: vi.fn() };
    const panel = createPanel(actions);
    document.body.append(panel.element);
    const buttons = (label: string) =>
      Array.from(panel.element.querySelectorAll("button")).find((b) =>
        b.textContent?.includes(label),
      );
    return { actions, panel, buttons };
  };

  it("件数と Top5 を表示し、空のときは案内を出す", () => {
    const { panel } = setup();
    panel.update([]);
    expect(panel.element.querySelector(".kp-count")?.textContent).toBe("0件");
    expect(panel.element.querySelector(".kp-empty")).not.toBeNull();

    panel.update([1, 2, 3, 4, 5, 6].map((n) => makeTweet(n, n)));
    expect(panel.element.querySelector(".kp-count")?.textContent).toBe("6件");
    const names = Array.from(panel.element.querySelectorAll(".kp-name"), (e) => e.textContent);
    expect(names).toEqual(["user6", "user5", "user4", "user3", "user2"]);
  });

  it("内容が同じなら一覧のDOMを作り直さない", () => {
    const { panel } = setup();
    const tweets = [makeTweet(1, 5)];
    panel.update(tweets);
    const row = panel.element.querySelector(".kp-row");
    panel.update(tweets);
    expect(panel.element.querySelector(".kp-row")).toBe(row);
  });

  it("ツイートが無いときはダウンロード・クリアを無効にする", () => {
    const { panel, buttons } = setup();
    panel.update([]);
    expect(buttons("ダウンロード")?.disabled).toBe(true);
    expect(buttons("クリア")?.disabled).toBe(true);
    panel.update([makeTweet(1, 1)]);
    expect(buttons("ダウンロード")?.disabled).toBe(false);
  });

  it("クリアは2回押したときだけ実行され、3秒で元に戻る", () => {
    const { panel, actions, buttons } = setup();
    panel.update([makeTweet(1, 1)]);

    buttons("クリア")?.click();
    expect(actions.onClear).not.toHaveBeenCalled();
    expect(buttons("もう一度押して削除")).toBeDefined();

    vi.advanceTimersByTime(3000);
    expect(buttons("もう一度押して削除")).toBeUndefined();
    buttons("クリア")?.click();
    expect(actions.onClear).not.toHaveBeenCalled();

    buttons("もう一度押して削除")?.click();
    expect(actions.onClear).toHaveBeenCalledTimes(1);
  });

  it("ダウンロードボタンで onDownload を呼ぶ", () => {
    const { panel, actions, buttons } = setup();
    panel.update([makeTweet(1, 1)]);
    buttons("ダウンロード")?.click();
    expect(actions.onDownload).toHaveBeenCalledTimes(1);
  });

  it("ヘッダーで折りたたみ、状態を localStorage に保存する", () => {
    const { panel } = setup();
    const header = panel.element.querySelector<HTMLButtonElement>(".kp-header");
    expect(panel.element.dataset.collapsed).toBe("false");
    header?.click();
    expect(panel.element.dataset.collapsed).toBe("true");
    expect(localStorage.getItem("keeb-pd-panel-collapsed")).toBe("1");
    header?.click();
    expect(localStorage.getItem("keeb-pd-panel-collapsed")).toBe("0");
  });

  it("行をクリックするとツイートを新規タブで開く（x.com 以外は twitter.com）", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { panel } = setup();
    panel.update([makeTweet(1, 5)]);
    panel.element.querySelector<HTMLButtonElement>(".kp-row")?.click();
    expect(open).toHaveBeenCalledWith("https://twitter.com/user1/status/1", "_blank", "noopener");
  });

  it("ページの背景色が暗ければ dark テーマにする", () => {
    document.body.style.backgroundColor = "rgb(0, 0, 0)";
    const { panel } = setup();
    panel.update([]);
    expect(panel.element.dataset.theme).toBe("dark");
    document.body.style.backgroundColor = "rgb(255, 255, 255)";
    panel.update([]);
    expect(panel.element.dataset.theme).toBe("light");
    document.body.style.backgroundColor = "";
  });
});
