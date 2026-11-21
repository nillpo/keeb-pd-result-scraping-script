import { describe, expect, it } from "vitest";
import { COMPOSE_POST_PATH, isKEEBPDSearchURL } from "./url.ts";

const check = (path: string) => isKEEBPDSearchURL(new URL(path, "https://x.com"));

describe("isKEEBPDSearchURL", () => {
  it("/search?f=live で q にラウンドのハッシュタグがあれば true", () => {
    expect(check("/search?f=live&q=%23KEEB_PD_R123%20min_faves%3A5")).toBe(true);
    expect(check("/search?q=%23KEEB_PD_R1&f=live")).toBe(true);
  });

  it("連続して呼んでも結果が変わらない", () => {
    const url = new URL("/search?f=live&q=KEEB_PD_R9", "https://x.com");
    expect(isKEEBPDSearchURL(url)).toBe(true);
    expect(isKEEBPDSearchURL(url)).toBe(true);
  });

  it("パスが /search でなければ false", () => {
    expect(check("/explore?f=live&q=KEEB_PD_R1")).toBe(false);
    expect(check("/search/?f=live&q=KEEB_PD_R1")).toBe(false);
  });

  it("f=live でなければ false", () => {
    expect(check("/search?q=KEEB_PD_R1")).toBe(false);
    expect(check("/search?f=top&q=KEEB_PD_R1")).toBe(false);
  });

  it("q が無い・空・ラウンド番号が無ければ false", () => {
    expect(check("/search?f=live")).toBe(false);
    expect(check("/search?f=live&q=")).toBe(false);
    expect(check("/search?f=live&q=KEEB_PD")).toBe(false);
    expect(check("/search?f=live&q=KEEB_PD_R")).toBe(false);
  });
});

describe("COMPOSE_POST_PATH", () => {
  it("投稿ページのパス", () => {
    expect(COMPOSE_POST_PATH).toBe("/compose/post");
  });
});
