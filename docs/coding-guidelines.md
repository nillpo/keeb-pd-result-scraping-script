# コーディング規約

このドキュメントでは、KEEB_PD Result
Scraperプロジェクトのコーディング規約とベストプラクティスについて説明します。

## 目次

- [TypeScriptスタイルガイド](#typescriptスタイルガイド)
- [DOM操作パターン](#dom操作パターン)
- [状態機械設計パターン](#状態機械設計パターン)
- [Node.js / pnpm規約](#nodejs--pnpm規約)
- [パフォーマンス最適化](#パフォーマンス最適化)
- [ブラウザ互換性](#ブラウザ互換性)

## TypeScriptスタイルガイド

### strict typing使用

全てのコードで厳密な型付けを使用します。型推論に頼らず、明示的に型を指定します。

**良い例**:

```typescript
const parseTweetUrl = (node: Element): string | null => {
  const anchor = node.querySelector('a[role="link"]');
  if (!anchor) return null;
  return anchor.getAttribute("href");
};
```

**悪い例**:

```typescript
const parseTweetUrl = (node) => { // 型なし
  const anchor = node.querySelector('a[role="link"]');
  return anchor?.getAttribute("href"); // 暗黙的な型推論
};
```

### `any`禁止

`any`型は使用せず、型が不明な場合は`unknown`を使用します。

**良い例**:

```typescript
const parseJsonSafely = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// 使用時に型ガードで絞り込む
const data = parseJsonSafely(jsonString);
if (typeof data === "object" && data !== null && "tweet" in data) {
  const tweet = data as { tweet: Tweet };
  // ...
}
```

**悪い例**:

```typescript
const parseJsonSafely = (text: string): any => { // any禁止
  return JSON.parse(text);
};
```

### `type`優先、`interface`は最小限

データ構造には`type`を使用し、`interface`は拡張可能性が必要な場合のみ使用します。

**良い例**:

```typescript
type Tweet = {
  date: string;
  fav: number;
  retweet: number;
  url: string;
  userName: string;
  round: string;
};

type StateContext = {
  searchTimelineObserver: MutationObserver;
  twitterPageObserver: MutationObserver;
  listeners: number[];
  tweet: Tweet;
  collectedTweets: Map<string, Tweet>;
};
```

**`interface`を使用する場合**（拡張が必要な時のみ）:

```typescript
export interface ExecuteHandler<T> {
  (event: StateEvents, context: T): void;
}
```

### Discriminated unionsの使用

状態機械の結果型など、複数の可能性がある型にはDiscriminated unionsを使用します。

**良い例**:

```typescript
type EntryTweetResult = {
  isEntryTweet: true;
  tweet: Tweet;
} | {
  isEntryTweet: false;
  reason: string;
};

// 使用時
const result = parseEntryTweet(node);
if (result.isEntryTweet) {
  console.log(result.tweet); // tweet プロパティにアクセス可能
} else {
  console.log(result.reason); // reason プロパティにアクセス可能
}
```

**悪い例**:

```typescript
type EntryTweetResult = {
  isEntryTweet: boolean;
  tweet?: Tweet; // オプショナルは避ける
  reason?: string; // オプショナルは避ける
};
```

### 関数の型定義

関数の引数と戻り値は必ず型を明示します。

**良い例**:

```typescript
export function getTweetText(tweet: Tweet): string {
  return `#KEEB_PD_R${tweet.round} で一番ふぁぼ${
    tweet.fav ? `(❤${tweet.fav})` : ""
  }が多かったのは ${tweet.userName} さんでした🎉🎉🎉🎉
おめでとうございます!! 🎉🎉🎉🎉🎉🎉🎉
#KEEB_PD_R${tweet.round} #KEEB_PD`;
}
```

**悪い例**:

```typescript
export function getTweetText(tweet) { // 引数の型なし
  // ...
}
```

### 型アサーション（as）の慎重な使用

型アサーションは最小限に抑え、可能な限り型ガードを使用します。

**良い例**:

```typescript
const button = document.querySelector('button[data-testid="like"]');
if (button instanceof HTMLButtonElement) {
  button.click(); // 型ガードで安全
}
```

**許容される例**（DOMイベント等）:

```typescript
div.addEventListener("click", (target) => {
  const currentTarget = target.currentTarget;
  if (currentTarget instanceof HTMLDivElement) {
    // 処理
  }
});
```

**悪い例**:

```typescript
const button = document.querySelector(
  'button[data-testid="like"]',
) as HTMLButtonElement;
button.click(); // buttonがnullの可能性を無視
```

## DOM操作パターン

### 要素存在チェックの徹底

DOM要素にアクセスする前に、必ず存在を確認します。

**良い例**:

```typescript
const timeline = document.querySelector(
  'div[aria-label="タイムライン: タイムラインを検索"]',
);
if (!timeline) {
  return { isEntryTweet: false, reason: "timeline element not found" };
}
// timelineを使用
```

**悪い例**:

```typescript
const timeline = document.querySelector(
  'div[aria-label="タイムライン: タイムラインを検索"]',
);
timeline.appendChild(element); // timelineがnullの可能性
```

### `data-testid`セレクタ優先

CSSクラスセレクタよりも`data-testid`属性を優先して使用します。Twitter/Xは頻繁にCSSクラス名を変更しますが、`data-testid`は比較的安定しています。

**優先順位**:

1. `data-testid` 属性
2. `aria-label` 属性
3. `role` 属性
4. CSSクラス（最後の手段）

**良い例**:

```typescript
const tweetContainer = node.querySelector('div[data-testid="cellInnerDiv"]');
const likeButton = node.querySelector('button[data-testid="like"]');
const retweetButton = node.querySelector('button[data-testid="retweet"]');
```

**悪い例**:

```typescript
const tweetContainer = node.querySelector("div.css-1dbjc4n.r-18u37iz"); // CSSクラスは変更されやすい
```

### `querySelector` vs `querySelectorAll`

単一要素を取得する場合は`querySelector`、複数要素を取得する場合は`querySelectorAll`を使用します。

**良い例**:

```typescript
// 単一要素
const timeline = document.querySelector(
  'div[aria-label="タイムライン: タイムラインを検索"]',
);

// 複数要素
const tweets = document.querySelectorAll('div[data-testid="cellInnerDiv"]');
tweets.forEach((tweet) => {
  // 処理
});
```

### 早期フィルタリング

無関係な要素は処理前に早期に除外します。パフォーマンス向上とコードの可読性向上につながります。

**良い例** (scriptbody.ts:239-254):

```typescript
const validNodes = mutations
  .reduce((accumulatedNodes, mutation) => {
    const { addedNodes } = mutation;
    const filteredNodes = Array.from(addedNodes).filter((node) => {
      if (isPromotionTweet(node) || isQuoteRetweet(node)) {
        return false; // 早期除外
      }
      if (!(node instanceof Element)) return false;
      if (node.getAttribute("data-testid") !== "cellInnerDiv") return false;
      return true;
    }).reduce((elements, node) => {
      if (node instanceof Element) {
        return [...elements, node];
      }
      return elements;
    }, [] as Element[]);

    return [...accumulatedNodes, ...filteredNodes];
  }, [] as Element[]);
```

### DOMの安全な変更

要素の追加・削除時は、既存の要素との競合を避けます。

**良い例** (`src/scriptbody.ts` の `setupDownloadButton`):

```typescript
// 既存のパネルを削除してから新しいパネルを追加
document.getElementById(PANEL_ID)?.remove();

const panel = createPanel({ onDownload, onClear }); // src/panel.ts（idは PANEL_ID）
// ...
document.body.appendChild(panel.element);
```

## 状態機械設計パターン

### Conditionは純粋関数

状態遷移の条件は純粋関数として実装します。副作用を持たず、同じ入力に対して常に同じ出力を返します。

**良い例** (scriptbody.ts:325-328):

```typescript
{
  from: "OBSERVING_TWITTER_PAGE",
  event: "DETECT_SEARCH_URL",
  to: "LOADING_SEARCH_PAGE",
  condition: (event) => {
    if (event.type !== "DETECT_SEARCH_URL") return false;
    return isKEEBPDSearchURL(new URL(event.url));  // 純粋関数
  },
}
```

**悪い例**:

```typescript
condition: ((event) => {
  if (event.type !== "DETECT_SEARCH_URL") return false;
  context.lastUrl = event.url; // 副作用あり（状態変更）
  return isKEEBPDSearchURL(new URL(event.url));
});
```

### Execute handlerは同期処理

状態遷移時の処理は同期的に実行します。非同期処理は禁止です。

**良い例** (scriptbody.ts:34-39):

```typescript
const observeTwitterPage: ExecuteHandler<StateContext> = (_event, context) => {
  context.twitterPageObserver.observe(document, {
    subtree: true,
    childList: true,
  });
};
```

**悪い例**:

```typescript
const fetchData: ExecuteHandler<StateContext> = async (_event, context) => {
  const data = await fetch("/api/tweets"); // 非同期処理は禁止
  context.tweets = await data.json();
};
```

### `tryDispatch` vs `dispatch`

遷移の性質に応じて使い分けます。

**`tryDispatch`**: オプショナルな遷移（失敗しても問題ない）

```typescript
// ページ全体を監視し、条件に合う場合のみ遷移
stateMachine.tryDispatch({
  type: "DETECT_SEARCH_URL",
  url: document.location.href,
});
```

**`dispatch`**: 期待される遷移（失敗はログ出力すべき）

```typescript
// 明示的にツイートを収集する場合
stateMachine.dispatch({
  type: "COLLECT_TWEET",
  tweet: { ...tweetData.tweet },
});
```

### 状態遷移のログ

遷移の成功・失敗をログに出力し、デバッグを容易にします。

**実装例** (scriptbody.ts:305-313):

```typescript
stateMachine.addListener((result) => {
  if (result.success) {
    console.log(`Transitioned from ${result.from} to ${result.to}`);
  } else {
    console.log(
      `Failed to transition from ${result.from} due to ${result.reason}`,
    );
  }
});
```

## Node.js / pnpm規約

### 依存関係の管理

全ての依存パッケージは`package.json`の`devDependencies`に記載し、`pnpm add -D --save-exact <pkg>`でバージョンを固定します。

**良い例**:

```typescript
import { rolldown } from "rolldown";
import { spawn } from "node:child_process";
```

### node:プレフィックス

Node.js組み込みモジュールは`node:`プレフィックス付きでインポートします（ビルドスクリプト`builder.ts`のみで使用可。`src/`では使用禁止）。

### pnpm-lock.yaml使用

再現可能ビルドのため`pnpm-lock.yaml`をコミットし、CI・devcontainerでは`pnpm install --frozen-lockfile`を使います。

### 公開直後のバージョンを入れない

サプライチェーン攻撃対策として、`pnpm-workspace.yaml`で公開から7日未満のバージョンを解決対象から除外します。

```yaml
minimumReleaseAge: 10080 # 分（7日）
minimumReleaseAgeStrict: true
```

- `minimumReleaseAgeExclude`による例外指定は原則使用しない
- 依存パッケージのビルドスクリプトは`allowBuilds`で明示的に許可したものだけ実行する（`strictDepBuilds: true`）

### スクリプト定義

`package.json`の`scripts`で頻繁に使用するコマンドを定義します。

```jsonc
{
  "scripts": {
    "build": "node builder.ts",
    "dev": "node --watch --watch-path=./src --watch-path=./builder.ts builder.ts",
    "typecheck": "tsc -p tsconfig.app.json && tsc -p tsconfig.node.json",
    "lint": "oxlint",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check"
  }
}
```

`builder.ts`はNodeのtype stripping（Node 26）で直接実行するため、トランスパイラは不要です。

### 型チェック・リント・フォーマット

- **型チェック**: `tsc`（`src/`はブラウザ向け`tsconfig.app.json`、`builder.ts`はNode向け`tsconfig.node.json`。ルートの`tsconfig.json`は両者を束ねるproject referencesで、エディタが各ファイルに正しい設定を適用するために使います）。バンドラーは型チェックを行わないため、必ず`pnpm typecheck`を実行します
- **リント**: `oxlint`（設定は`.oxlintrc.json`）。`typescript/no-explicit-any`をerrorとして`any`を禁止します
- **フォーマット**: `oxfmt`（`pnpm fmt`。設定は`.oxfmtrc.json`で、プロジェクト全体が対象。`out/`と`pnpm-lock.yaml`は除外し、Markdown内のコードブロックは整形しません）

## パフォーマンス最適化

### 早期フィルタリング

プロモーションツイートや引用リツイートは解析前に除外します。

**実装箇所**: scriptbody.ts:240-242

```typescript
const filteredNodes = Array.from(addedNodes).filter((node) => {
  if (isPromotionTweet(node) || isQuoteRetweet(node)) {
    return false; // 解析前に除外
  }
  // ...
});
```

### 選択的observation

検索ページにいる時のみ、タイムラインを監視します。

**実装例**:

- `MONITORING_SEARCH_PAGE`状態の時のみ`searchTimelineObserver`が動作
- ページ離脱時は`disconnect()`でObserverを停止

### アイドル時disconnect

使用していないObserverは切断し、リソースを節約します。

**実装箇所**: scriptbody.ts:51-66

```typescript
const disconnectSearchTimeline: ExecuteHandler<StateContext> = (
  _event,
  context,
) => {
  context.searchTimelineObserver.disconnect();

  // Remove download panel from DOM
  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.remove();

  // Clear counter update intervals
  context.listeners.forEach((id) => clearInterval(id));
  context.listeners = [];

  console.info("disconnect!");
};
```

### 効率的セレクタ

`data-testid`属性は属性セレクタで直接指定し、CSSクラスセレクタよりも高速です。

**良い例**:

```typescript
const cell = node.querySelector('div[data-testid="cellInnerDiv"]');
const like = node.querySelector('button[data-testid="like"]');
```

**悪い例**:

```typescript
const cell = node.querySelector("div.css-1dbjc4n.r-18u37iz.r-1wbh5a2"); // 複数クラスは遅い
```

### 単一パース処理

ツイートのDOM解析は1回のトラバーサルで全データを取得します。

**良い例** (tweet-parser.ts:49-136):

`parseEntryTweet`関数は1回の呼び出しで以下を全て取得:

- いいね数
- リツイート数
- ユーザー名
- 日付とURL
- ラウンド番号

**悪い例**:

```typescript
// 複数回のDOM解析（非効率）
const fav = parseF fav(node);
const retweet = parseRetweet(node);
const userName = parseUserName(node);
// ...
```

### パフォーマンス計測

処理時間を計測し、ボトルネックを特定します。

**実装例**:

```typescript
const searchTimelineObserver = new MutationObserver((mutations) => {
  const start = performance.now();

  // 処理ロジック

  const duration = performance.now() - start;
  console.log(`Processed in ${duration.toFixed(2)}ms`);
});
```

**目標パフォーマンス**:

- < 50ms / 変更バッチ
- < 5ms / ツイート解析

## ブラウザ互換性

### ブラウザAPIのみ使用

ユーザースクリプトはブラウザコンテキストで実行されるため、ブラウザAPIのみ使用できます。

**使用可能なAPI**:

- `MutationObserver`
- `document`、`window`
- `navigator.clipboard`
- `Element`、`HTMLElement`、`Node`
- `performance`
- `console`
- `Map`、`Set`、`Array`

**使用禁止なAPI**:

- Node.js API（ポリフィルなし）: `node:fs`、`node:path`、`process`等（`src/`では使用禁止）

### DOM APIの安全な使用

**`textContent`優先**（XSS対策）:

```typescript
const userName = element.textContent; // 安全
```

**`innerHTML`禁止**:

```typescript
element.innerHTML = userInput; // XSS脆弱性の可能性
```

### クリップボードAPI

クリップボード書き込みはユーザーアクション時のみ実行します。

**良い例** (scriptbody.ts:74-80):

```typescript
div.addEventListener("click", (target) => {
  const currentTarget = target.currentTarget;
  if (currentTarget instanceof HTMLDivElement) {
    navigator.clipboard.writeText(text).then(() => console.log("Text copied!"))
      .catch((err) => console.error("Clipboard write failed", err));
  }
});
```

### モダンJavaScript機能の使用

ターゲットブラウザは最新のChrome、Firefox、Edgeのため、ES2020以降の機能を使用できます。

**使用可能**:

- Optional chaining: `element?.textContent`
- Nullish coalescing: `value ?? defaultValue`
- `Map`、`Set`
- `Array.from`、`Array.prototype.reduce`

## まとめ

このプロジェクトのコーディング規約は、型安全性、パフォーマンス、保守性を重視しています。TypeScriptのstrict
typing、DOM操作の安全性確認、状態機械の純粋関数原則、Node.js / pnpm規約の遵守、パフォーマンス最適化を徹底することで、高品質なコードベースを維持します。

詳細な技術情報は [docs/architecture.md](architecture.md) を、開発環境は
[docs/development.md](development.md) を参照してください。
