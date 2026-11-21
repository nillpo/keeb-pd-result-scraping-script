// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createIcon } from "./icons.ts";

describe("createIcon", () => {
  it("指定したサイズの装飾用SVGを作る", () => {
    const svg = createIcon("paw", "2em");
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg.getAttribute("width")).toBe("2em");
    expect(svg.getAttribute("height")).toBe("2em");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.childElementCount).toBeGreaterThan(0);
  });

  it("呼ぶたびに新しい要素を返す", () => {
    expect(createIcon("heart", "1em")).not.toBe(createIcon("heart", "1em"));
  });
});
