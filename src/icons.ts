const SVG_NS = "http://www.w3.org/2000/svg";

type IconShape = {
  tag: "path" | "ellipse";
  attrs: Readonly<Record<string, string>>;
};

type IconDefinition = {
  // <svg> 要素に付ける、塗りと線の指定
  attrs: Readonly<Record<string, string>>;
  shapes: readonly IconShape[];
};

// 線画アイコン（SF Symbols のような、太さが均一で端が丸い線）
const outline = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.75",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
} as const;

// 塗りつぶしアイコン
const solid = { fill: "currentColor" } as const;

// すべて viewBox 0 0 24 24 で、色は currentColor（親要素の color に追従する）
// innerHTML や DOMParser を使わず createElementNS で組み立てる（Twitter/X の Trusted Types を避けるため）
const definitions = {
  // arrow.down.to.line
  download: {
    attrs: outline,
    shapes: [
      { tag: "path", attrs: { d: "M12 4v11" } },
      { tag: "path", attrs: { d: "M7.5 10.8 12 15.3l4.5-4.5" } },
      { tag: "path", attrs: { d: "M5.5 19.5h13" } },
    ],
  },
  // trash
  trash: {
    attrs: outline,
    shapes: [
      { tag: "path", attrs: { d: "M4.5 6.5h15" } },
      {
        tag: "path",
        attrs: { d: "M9.5 6.5V5.2c0-.7.5-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2v1.3" },
      },
      {
        tag: "path",
        attrs: { d: "M6.5 8.5l.8 10.2c.1 1 .9 1.8 1.9 1.8h5.6c1 0 1.8-.8 1.9-1.8l.8-10.2" },
      },
      { tag: "path", attrs: { d: "M10.2 11v6M13.8 11v6" } },
    ],
  },
  // chevron.down
  chevron: {
    attrs: outline,
    shapes: [{ tag: "path", attrs: { d: "M6 9.5l6 6 6-6" } }],
  },
  // heart.fill
  heart: {
    attrs: solid,
    shapes: [
      {
        tag: "path",
        attrs: {
          d: "M12 20.5c-.4 0-.8-.1-1.1-.4C6 16.5 2.8 13.6 2.8 9.8c0-2.5 2-4.5 4.5-4.5 1.8 0 3.4 1 4.7 2.8 1.3-1.8 2.9-2.8 4.7-2.8 2.5 0 4.5 2 4.5 4.5 0 3.8-3.2 6.7-8.1 10.3-.3.3-.7.4-1.1.4Z",
        },
      },
    ],
  },
  // pawprint.fill
  paw: {
    attrs: solid,
    shapes: [
      {
        tag: "ellipse",
        attrs: { cx: "5.6", cy: "10.4", rx: "1.9", ry: "2.5", transform: "rotate(-25 5.6 10.4)" },
      },
      {
        tag: "ellipse",
        attrs: { cx: "9.4", cy: "6.3", rx: "1.9", ry: "2.5", transform: "rotate(-8 9.4 6.3)" },
      },
      {
        tag: "ellipse",
        attrs: { cx: "14.6", cy: "6.3", rx: "1.9", ry: "2.5", transform: "rotate(8 14.6 6.3)" },
      },
      {
        tag: "ellipse",
        attrs: { cx: "18.4", cy: "10.4", rx: "1.9", ry: "2.5", transform: "rotate(25 18.4 10.4)" },
      },
      {
        tag: "path",
        attrs: {
          d: "M12 11.5c-2.4 0-5.6 3.1-5.6 5.6 0 1.7 1.3 2.7 2.9 2.7.9 0 1.8-.4 2.7-.4s1.8.4 2.7.4c1.6 0 2.9-1 2.9-2.7 0-2.5-3.2-5.6-5.6-5.6Z",
        },
      },
    ],
  },
} satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof definitions;

// size は CSS の長さ（例: "1em"）。色は呼び出し側の color で決める
export function createIcon(name: IconName, size: string): SVGSVGElement {
  const { attrs, shapes } = definitions[name];
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("aria-hidden", "true");
  svg.style.flexShrink = "0";
  for (const [key, value] of Object.entries(attrs)) {
    svg.setAttribute(key, value);
  }
  for (const shape of shapes) {
    const element = document.createElementNS(SVG_NS, shape.tag);
    for (const [key, value] of Object.entries(shape.attrs)) {
      element.setAttribute(key, value);
    }
    svg.append(element);
  }
  return svg;
}
