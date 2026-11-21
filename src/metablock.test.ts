import { describe, expect, it } from "vitest";
import { createMetablock } from "./metablock.ts";

describe("createMetablock", () => {
  const block = createMetablock("1.2.3");

  it("メタブロックの開始・終了行がある", () => {
    const lines = block.trimEnd().split("\n");
    expect(lines[0]).toBe("// ==UserScript==");
    expect(lines.at(-1)).toBe("// ==/UserScript==");
  });

  it("@version に渡したバージョンが入る", () => {
    expect(block).toMatch(/^\/\/ @version\s+1\.2\.3$/m);
  });

  it("twitter.com と x.com に一致する", () => {
    expect(block).toContain("// @match        https://twitter.com/*");
    expect(block).toContain("// @match        https://x.com/*");
  });

  it("自動更新の配布先が同じURLを指す", () => {
    const download = block.match(/@downloadURL\s+(\S+)/)?.[1];
    const update = block.match(/@updateURL\s+(\S+)/)?.[1];
    expect(download).toBeDefined();
    expect(download).toBe(update);
  });
});
