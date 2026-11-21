// フローティングパネルのスタイル。Mac のすりガラス風で、ライト/ダークは data-theme で切り替える
// ホバーやフォーカスなどの擬似クラスが必要なため、インラインstyleではなくスタイルシートで定義する
export const PANEL_ID = "keeb-pd-download-panel";

const css = `
#${PANEL_ID} {
  --kp-bg: rgba(255, 255, 255, 0.72);
  --kp-fg: #1d1d1f;
  --kp-sub: #6e6e73;
  --kp-border: rgba(0, 0, 0, 0.1);
  --kp-hover: rgba(0, 0, 0, 0.06);
  --kp-hover-strong: rgba(0, 0, 0, 0.1);
  --kp-accent: #007aff;
  --kp-danger: #ff3b30;
  --kp-heart: #ff2d55;
  --kp-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
}
#${PANEL_ID}[data-theme="dark"] {
  --kp-bg: rgba(40, 40, 44, 0.72);
  --kp-fg: #f5f5f7;
  --kp-sub: #a1a1a6;
  --kp-border: rgba(255, 255, 255, 0.14);
  --kp-hover: rgba(255, 255, 255, 0.08);
  --kp-hover-strong: rgba(255, 255, 255, 0.14);
  --kp-accent: #0a84ff;
  --kp-danger: #ff453a;
  --kp-heart: #ff375f;
  --kp-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
}

#${PANEL_ID} {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 9999;
  box-sizing: border-box;
  width: 264px;
  overflow: hidden;
  color: var(--kp-fg);
  background: var(--kp-bg);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  border: 0.5px solid var(--kp-border);
  border-radius: 14px;
  box-shadow: var(--kp-shadow);
  font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN",
    "Segoe UI", system-ui, sans-serif;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  #${PANEL_ID}:not([data-theme="dark"]) { background: rgba(246, 246, 248, 0.97); }
  #${PANEL_ID}[data-theme="dark"] { background: rgba(40, 40, 44, 0.97); }
}
#${PANEL_ID} *, #${PANEL_ID} *::before, #${PANEL_ID} *::after { box-sizing: border-box; }

#${PANEL_ID} .kp-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 10px 12px;
  color: inherit;
  background: transparent;
  border: 0;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
#${PANEL_ID} .kp-title { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }
#${PANEL_ID} .kp-count {
  margin-left: auto;
  color: var(--kp-sub);
  font-variant-numeric: tabular-nums;
}
#${PANEL_ID} .kp-chevron { color: var(--kp-sub); transition: transform 0.2s ease; }
#${PANEL_ID}[data-collapsed="true"] .kp-chevron { transform: rotate(-90deg); }

#${PANEL_ID} .kp-body { padding: 0 8px 8px; }
#${PANEL_ID}[data-collapsed="true"] .kp-body { display: none; }

#${PANEL_ID} .kp-caption {
  padding: 2px 8px 6px;
  color: var(--kp-sub);
  font-size: 11px;
  font-weight: 600;
}
#${PANEL_ID} .kp-list { display: flex; flex-direction: column; gap: 2px; max-height: 220px; overflow-y: auto; }
#${PANEL_ID} .kp-empty { padding: 10px 8px; color: var(--kp-sub); text-align: center; }

#${PANEL_ID} .kp-row {
  display: grid;
  grid-template-columns: 1.2em minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 8px;
  width: 100%;
  margin: 0;
  padding: 6px 8px;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 8px;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}
#${PANEL_ID} .kp-row:hover { background: var(--kp-hover); }
#${PANEL_ID} .kp-rank { color: var(--kp-sub); font-variant-numeric: tabular-nums; text-align: right; }
#${PANEL_ID} .kp-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#${PANEL_ID} .kp-fav {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--kp-heart);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

#${PANEL_ID} .kp-actions { display: flex; gap: 8px; margin-top: 8px; }
#${PANEL_ID} .kp-btn {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  height: 32px;
  margin: 0;
  padding: 0 10px;
  color: var(--kp-fg);
  background: var(--kp-hover);
  border: 0;
  border-radius: 8px;
  font: inherit;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease, filter 0.15s ease;
}
#${PANEL_ID} .kp-btn:hover { background: var(--kp-hover-strong); }
#${PANEL_ID} .kp-btn:active { filter: brightness(0.92); }
#${PANEL_ID} .kp-btn--primary { color: #fff; background: var(--kp-accent); }
#${PANEL_ID} .kp-btn--primary:hover { background: var(--kp-accent); filter: brightness(1.08); }
#${PANEL_ID} .kp-btn--primary:active { filter: brightness(0.92); }
#${PANEL_ID} .kp-btn--confirm { color: #fff; background: var(--kp-danger); }
#${PANEL_ID} .kp-btn--confirm:hover { background: var(--kp-danger); filter: brightness(1.08); }
#${PANEL_ID} .kp-btn:disabled { opacity: 0.4; cursor: default; pointer-events: none; }

#${PANEL_ID} button:focus-visible { outline: 2px solid var(--kp-accent); outline-offset: 2px; }
/* ヘッダーはパネルの端まで広がっていて、外側のリングが overflow: hidden で切れるため内側に出す */
#${PANEL_ID} .kp-header:focus-visible { outline-offset: -2px; }

@media (prefers-reduced-motion: reduce) {
  #${PANEL_ID} * { transition: none !important; }
}
`;

let installed = false;

// 何度呼んでも1回だけ追加する
// CSSStyleSheet を使うと、ページのCSP（style-src）の影響を受けない。使えない環境では <style> にフォールバックする
export function installPanelStyles(): void {
  if (installed) return;
  if ("adoptedStyleSheets" in document && typeof CSSStyleSheet === "function") {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      installed = true;
      return;
    } catch {
      // 失敗した場合は下の <style> を使う
    }
  }
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  installed = true;
}
