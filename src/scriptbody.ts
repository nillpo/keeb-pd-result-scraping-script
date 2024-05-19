/// <reference lib="dom" />
import "@violentmonkey/types";

function getText() {
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
  return `#KEEB_PD_R${round} で一番ふぁぼが多かったのは ${userName} さんでした🎉🎉🎉🎉
おめでとうございます!! 🎉🎉🎉🎉🎉🎉🎉
#KEEB_PD_R${round} #KEEB_PD`;
}

function isSameBeforeInit(init: string) {
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

const isSameBeforeUrl = isSameBeforeInit(window.crypto.randomUUID());
const isSameSearchBeforeUrl = isSameBeforeInit(window.crypto.randomUUID());

const PATH_NAME = "/compose/post";
let menuId = "";

const isKEEBPDSearchURL = (url: URL) => {
  const query = url.searchParams.get("q");
  if (
    url.searchParams.get("f") === "live" &&
    query &&
    query.match(/#KEEB_PD_R\d+/g) &&
    query.match(/min_faves:\d+/g)
  ) {
    return true;
  }
  return false;
};

const searchTimelineObserver = new MutationObserver((mutations, _observer) => {
  mutations
    .reduce((p, c) => {
      const { addedNodes } = c;
      const nodes = Array.from(addedNodes).filter((node) => {
        if (
          node instanceof HTMLDivElement &&
          node.getAttribute("data-testid") === "cellInnerDiv"
        ) {
          const promo = node.querySelector(
            `article[data-testid="tweet"] > div > div > div:last-child > div > div:last-child > div > div > span`,
          );
          if (promo === null) return true;
          if (promo.textContent === "プロモーション") return false;
          return true;
        }
        return false;
      }).reduce((p, c) => {
        if (c instanceof Element) {
          return [...p, c];
        }
        return p;
      }, [] as Element[]);

      return [...p, ...nodes];
    }, [] as Element[])
    .forEach((node) => {
      const faves = node.querySelector(`div[data-testid="like"]`)!.textContent;
      node
        .querySelector(`div[data-testid$="tweet"`)!
        .addEventListener("click", () => {
          GM_setValue("faves", faves);
        });
    });
});

new MutationObserver((_mutations, _observer) => {
  const url = new URL(document.location.href);

  if (url.pathname === "/search") {
    if (!isSameSearchBeforeUrl(url.href)) {
      console.log("same", url);
      if (isKEEBPDSearchURL(url)) {
        const searchTimelineElement = document.querySelector(
          `div[aria-label="タイムライン: タイムラインを検索"]`,
        );
        if (searchTimelineElement !== null) {
          searchTimelineObserver.observe(searchTimelineElement, {
            subtree: true,
            childList: true,
          });
        } else {
          isSameSearchBeforeUrl(window.crypto.randomUUID());
        }
      } else {
        isSameSearchBeforeUrl(window.crypto.randomUUID());
      }
    }
  } else {
    isSameSearchBeforeUrl(window.crypto.randomUUID());
    searchTimelineObserver.disconnect();
    console.info("disconnect!");
  }
  if (!isSameBeforeUrl(url.href) && url.pathname === PATH_NAME) {
    try {
      const text = getText();
      menuId = GM_registerMenuCommand("copy to clipboard", () => {
        GM_setClipboard(text, "text");
      });
      const appBar = document.querySelector(
        "div[data-viewportview=true] div[data-testid=app-bar-close]",
      )!.parentElement!.parentElement!;
      const div = document.createElement("div");
      div.addEventListener("click", (target) => {
        const currentTarget = target.currentTarget;
        if (currentTarget instanceof HTMLDivElement) {
          GM_setClipboard(text, "text");
        }
      });
      div.style.cssText =
        `height: 1.5em; width: 1.5em; background-image: url("https://abs-0.twimg.com/emoji/v2/svg/1f436.svg"); background-size: 1.5em 1.5em; padding: 0.15em; background-position: center center; background-repeat: no-repeat; -webkit-text-fill-color: transparent;`;
      appBar.append(div);
    } catch (_e) {
      isSameBeforeUrl(window.crypto.randomUUID()); // retry
    }
  } else if (url.pathname !== PATH_NAME) {
    if (menuId !== "") {
      GM_unregisterMenuCommand(menuId);
      menuId = "";
    }
  }
}).observe(document, {
  subtree: true,
  childList: true,
});
