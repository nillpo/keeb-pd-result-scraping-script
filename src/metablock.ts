// Tampermonkey などが自動更新に使う配布先（GitHub Releases の最新リリース）
const releaseUrl =
  "https://github.com/nillpo/keeb-pd-result-scraping-script/releases/latest/download/keeb-pd-result-scraper.user.js";

// @version は package.json の version から渡す（builder.ts）
export const createMetablock = (version: string) => `// ==UserScript==
// @name         KEEB_PD Result Scraper
// @namespace    nillpo
// @version      ${version}
// @description  Scrapes and processes KEEB_PD results from Twitter
// @author       nillpo
// @match        https://twitter.com/*
// @match        https://x.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=twitter.com
// @downloadURL  ${releaseUrl}
// @updateURL    ${releaseUrl}
// ==/UserScript==
`;
