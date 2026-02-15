# 機能詳細

このドキュメントでは、KEEB_PD Result Scraperの各機能について詳しく説明します。

## 目次

- [ツイート自動収集機能](#ツイート自動収集機能)
- [JSONダウンロード機能](#jsonダウンロード機能)
- [フローティングコントロールパネル](#フローティングコントロールパネル)
- [リツイートボタン連携](#リツイートボタン連携)
- [対応URL形式](#対応url形式)
- [動作フロー](#動作フロー)

## ツイート自動収集機能

### 概要

KEEB_PD検索ページを閲覧するだけで、条件に合致するツイートを自動的に収集します。ユーザーは何もする必要がありません。

### 収集対象

**必須条件**:

- ハッシュタグ `#KEEB_PD_R\d+`
  を含むツイート（例：`#KEEB_PD_R1`、`#KEEB_PD_R25`）
- 検索URLに `min_faves:\d+` パラメータが含まれる（最低いいね数フィルタ）

**自動除外対象**:

- **プロモーションツイート**: 広告として表示されるツイート
- **引用リツイート**: 他のツイートを引用したツイート

### 重複排除の仕組み

**Map構造を使用**:

```typescript
collectedTweets: Map<string, Tweet>;
```

**キー**: ツイートのURLパス（例：`"/username/status/1234567890"`） **値**:
Tweetオブジェクト

**動作**:

- 同じURLのツイートが複数回検出されても、Mapのキーが同じため1回だけ保存されます
- スクロールして上に戻り、同じツイートを再度表示しても重複カウントされません

### 収集タイミング

1. **ページ読み込み時**: 既に表示されているツイートを一括収集
2. **スクロール時**: 新しく表示されたツイートをリアルタイム収集
3. **自動読み込み時**: Twitter/Xが自動的に追加のツイートを読み込んだ際に収集

### 技術的な実装

**実装箇所**: scriptbody.ts:235-288

**収集フロー**:

```
1. searchTimelineObserver が mutation を検出
   ↓
2. addedNodes から data-testid="cellInnerDiv" を抽出
   ↓
3. isPromotionTweet() / isQuoteRetweet() でフィルタリング
   ↓
4. parseEntryTweet() でメタデータ抽出
   ↓
5. 解析成功 → COLLECT_TWEET イベント発火
   ↓
6. context.collectedTweets.set(tweet.url, tweet)
```

**ログ出力**:

```
Filtered nodes: [Element, Element, ...]
TWEET PARSE: {"date":"...","fav":42,"retweet":5,...}
Collected: /username/status/123 (Total: 5)
```

## JSONダウンロード機能

### 概要

収集したツイートデータをJSON形式でローカルにダウンロードできます。データ分析やアーカイブに便利です。

### ダウンロード手順

1. フローティングパネルの「⬇ Download JSON」ボタンをクリック
2. ブラウザのダウンロードフォルダに自動保存される
3. ファイル名にはタイムスタンプが含まれる

### ファイル名形式

```
keeb-pd-tweets-YYYY-MM-DDTHH-MM-SS.json
```

**例**:

- `keeb-pd-tweets-2026-02-15T14-30-45.json`
- `keeb-pd-tweets-2026-02-20T09-15-22.json`

**タイムスタンプ**:

- `YYYY-MM-DD`: 年月日
- `THH-MM-SS`: 時分秒（`:` と `.` は `-` に置換）

### JSONフォーマット

**構造**: Tweet オブジェクトの配列

```json
[
  {
    "date": "2026-02-15T12:34:56.000Z",
    "fav": 42,
    "retweet": 5,
    "url": "/username/status/1234567890",
    "userName": "ユーザー名",
    "round": "1"
  },
  {
    "date": "2026-02-15T13:20:10.000Z",
    "fav": 38,
    "retweet": 3,
    "url": "/another/status/9876543210",
    "userName": "別のユーザー🎹",
    "round": "1"
  }
]
```

### フィールド詳細

| フィールド | 型     | 説明                             | 例                              |
| ---------- | ------ | -------------------------------- | ------------------------------- |
| `date`     | string | ツイート投稿日時（ISO 8601形式） | `"2026-02-15T12:34:56.000Z"`    |
| `fav`      | number | いいね数                         | `42`                            |
| `retweet`  | number | リツイート数                     | `5`                             |
| `url`      | string | ツイートのURLパス                | `"/username/status/1234567890"` |
| `userName` | string | 投稿者の表示名（絵文字含む）     | `"ユーザー名🎹"`                |
| `round`    | string | KEEB_PDのラウンド番号            | `"1"`                           |

### データの使用例

**Excel/Googleスプレッドシートでの分析**:

1. JSONファイルをCSV変換ツールで変換
2. スプレッドシートにインポート
3. いいね数でソート、グラフ作成等

**Python/JavaScriptでの処理**:

```python
import json

with open('keeb-pd-tweets-2026-02-15T14-30-45.json', 'r', encoding='utf-8') as f:
    tweets = json.load(f)

# いいね数トップ10
top_10 = sorted(tweets, key=lambda t: t['fav'], reverse=True)[:10]
for tweet in top_10:
    print(f"{tweet['userName']}: {tweet['fav']} likes")
```

### 技術的な実装

**実装箇所**: scriptbody.ts:158-174

**ダウンロードフロー**:

```typescript
1. Array.from(context.collectedTweets.values())  // Map → 配列変換
   ↓
2. JSON.stringify(tweets, null, 2)               // インデント付きJSON
   ↓
3. new Blob([json], { type: "application/json" }) // Blob作成
   ↓
4. URL.createObjectURL(blob)                     // 一時URL生成
   ↓
5. <a> 要素で download 属性を使用してダウンロード
   ↓
6. URL.revokeObjectURL(url)                      // 一時URLを解放
```

## フローティングコントロールパネル

### 概要

画面右下に常時表示される半透明のパネルで、収集状況の確認とデータ操作ができます。

### パネルの位置

- **位置**: 画面右下
- **固定**: スクロールしても追従
- **z-index**: 9999（他の要素より前面に表示）

### パネルの構成

#### 1. カウンターバッジ

**表示内容**: `{数} tweet{s} collected`

**例**:

- `0 tweet collected`
- `1 tweet collected`
- `5 tweets collected`

**更新頻度**: 1秒ごとに自動更新（setInterval）

**技術的な実装**:

```typescript
const updateCounter = () => {
  const count = context.collectedTweets.size;
  counterBadge.textContent = `${count} tweet${
    count !== 1 ? "s" : ""
  } collected`;
  // ...
};
setInterval(updateCounter, 1000);
```

#### 2. ダウンロードボタン

**ラベル**: `⬇ Download JSON`

**動作**:

- クリック → JSONファイルをダウンロード

**状態管理**:

- **有効**: 1件以上のツイートが収集されている
- **無効**: 0件の場合（`opacity: 0.5`、`cursor: not-allowed`）

**ビジュアル**:

- 有効時: 白背景、青文字、ポインターカーソル
- 無効時: 半透明、クリック不可カーソル

#### 3. クリアボタン

**ラベル**: `🗑 Clear All`

**動作**:

1. クリック → 確認ダイアログ表示
2. ユーザーが「OK」 → `collectedTweets.clear()` 実行
3. カウンターが0にリセット

**確認ダイアログのメッセージ**:

```
Clear {数} collected tweets?
```

**技術的な実装**:

```typescript
clearButton.addEventListener("click", () => {
  if (confirm(`Clear ${context.collectedTweets.size} collected tweets?`)) {
    context.collectedTweets.clear();
    updateCounter();
    console.log("Cleared all collected tweets");
  }
});
```

### パネルのスタイル

**外観**:

- 背景: 半透明の青（`rgba(29, 155, 240, 0.9)`）
- パディング: 12px
- ボーダー半径: 16px（丸角）
- ボックスシャドウ: `0 4px 12px rgba(0, 0, 0, 0.3)`

**レイアウト**:

- `display: flex`
- `flex-direction: column`（縦並び）
- `gap: 8px`（要素間のスペース）

### パネルの表示タイミング

**表示**:

- 検索ページ（KEEB_PD URL）のDOM読み込み完了時
- `SEARCH_PAGE_LOADED` イベント → `setupDownloadButton` 実行

**非表示**:

- 検索ページから離脱時（別のページに移動）
- `PAGE_CHANGED` イベント → `disconnectSearchTimeline` でDOMから削除

## リツイートボタン連携

### 概要

検索ページでリツイートボタンをクリックすると、そのツイート情報を記憶します。その後、投稿ページに移動すると、優勝者への祝福メッセージをクリップボードにコピーできるボタンが表示されます。

### 使用手順

#### ステップ1: リツイートボタンをクリック

1. KEEB_PD検索ページで優勝者のツイートを探す
2. そのツイートのリツイートボタン（🔄）をクリック
3. スクリプトが内部的にツイート情報を保存（`UPDATE_TWEET_CONTEXT` イベント）

**注意**:
実際にリツイートする必要はありません。ボタンをクリックするだけで情報が保存されます。

#### ステップ2: 投稿ページに移動

1. Twitter/Xの投稿ボタンをクリック
2. または、直接 `/compose/post` URLに移動

#### ステップ3: コピーボタンをクリック

1. 投稿ページで送信ボタン（「ポストする」）の近くに犬の絵文字（🐶）ボタンが表示される
2. 🐶ボタンをクリック
3. 祝福メッセージがクリップボードにコピーされる
4. 投稿ボックスに貼り付け（Ctrl+V / Cmd+V）

### コピーされるメッセージ

**フォーマット**:

```
#KEEB_PD_R{ラウンド} で一番ふぁぼ(❤{いいね数})が多かったのは {ユーザー名} さんでした🎉🎉🎉🎉
おめでとうございます!! 🎉🎉🎉🎉🎉🎉🎉
#KEEB_PD_R{ラウンド} #KEEB_PD
```

**例**:

```
#KEEB_PD_R1 で一番ふぁぼ(❤42)が多かったのは ユーザー名 さんでした🎉🎉🎉🎉
おめでとうございます!! 🎉🎉🎉🎉🎉🎉🎉
#KEEB_PD_R1 #KEEB_PD
```

### コピーボタンのデザイン

**アイコン**: 犬の絵文字（🐶）

**画像ソース**:
Twitter公式の絵文字画像（`https://abs-0.twimg.com/emoji/v2/svg/1f436.svg`）

**サイズ**: 1.5em × 1.5em

**位置**: 送信ボタン（`button[data-testid="unsentButton"]`）の親要素内に追加

### 技術的な実装

**リツイートボタンのリスナー追加**（scriptbody.ts:279-286）:

```typescript
if (retweetButton && tweetData.isEntryTweet) {
  retweetButton.addEventListener("click", () => {
    stateMachine.dispatch({
      type: "UPDATE_TWEET_CONTEXT",
      tweet: { ...tweetData.tweet },
    });
  });
}
```

**コピーボタンの作成**（scriptbody.ts:68-91）:

```typescript
const div = document.createElement("div");
div.addEventListener("click", (target) => {
  const currentTarget = target.currentTarget;
  if (currentTarget instanceof HTMLDivElement) {
    navigator.clipboard.writeText(text).then(() => console.log("Text copied!"))
      .catch((err) => console.error("Clipboard write failed", err));
  }
});

div.style.cssText = `height: 1.5em; width: 1.5em;
   background-image: url("https://abs-0.twimg.com/emoji/v2/svg/1f436.svg");
   background-size: 1.5em 1.5em;
   padding: 0.15em;
   background-position: center center;
   background-repeat: no-repeat;
   -webkit-text-fill-color: transparent;`;
unsetButton.append(div);
```

## 対応URL形式

### 検索ページ（自動収集の対象）

**パス**: `/search`

**必須パラメータ**:

- `f=live`: 最新順でのツイート表示
- `q={検索クエリ}`: 検索キーワード

**検索クエリの必須条件**:

- `#KEEB_PD_R\d+` を含む（例：`#KEEB_PD_R1`）
- `min_faves:\d+` を含む（例：`min_faves:10`）

**URL例**:

```
https://twitter.com/search?f=live&q=%23KEEB_PD_R1%20min_faves%3A10
https://x.com/search?f=live&q=%23KEEB_PD_R25%20min_faves%3A50
```

**URLデコード後**:

```
/search?f=live&q=#KEEB_PD_R1 min_faves:10
/search?f=live&q=#KEEB_PD_R25 min_faves:50
```

### 投稿ページ（コピーボタンの対象）

**パス**: `/compose/post`

**URL例**:

```
https://twitter.com/compose/post
https://x.com/compose/post
```

### URL検証の実装

**検索URLの検証**（scriptbody.ts:21-32）:

```typescript
const isKEEBPDSearchURL = (url: URL) => {
  const query = url.searchParams.get("q");
  if (
    url.pathname === "/search" &&
    url.searchParams.get("f") === "live" &&
    query &&
    query.match(/#KEEB_PD_R\d+/g)
  ) {
    return true;
  }
  return false;
};
```

**注意**: `min_faves` の検証は現在の実装では省略されています（将来的に追加可能）

## 動作フロー

### シナリオ1: ツイート収集からダウンロードまで

```
1. ユーザーがTwitter/Xを開く
   ↓
2. スクリプトが自動的に起動（BEGIN_OBSERVING）
   ↓
3. ユーザーがKEEB_PD検索URLに移動
   例: /search?f=live&q=%23KEEB_PD_R1%20min_faves%3A10
   ↓
4. スクリプトがURL検出（DETECT_SEARCH_URL）
   ↓
5. タイムライン読み込み待機（LOADING_SEARCH_PAGE）
   ↓
6. タイムライン検出（SEARCH_PAGE_LOADED）
   ↓
7. フローティングパネル表示
   カウンター: "0 tweet collected"
   ↓
8. ページに既に表示されているツイートを自動収集
   カウンター: "5 tweets collected"
   ↓
9. ユーザーがスクロール → 新しいツイート表示
   ↓
10. 新しいツイートを自動収集
    カウンター: "15 tweets collected"
    ↓
11. ユーザーがダウンロードボタンをクリック
    ↓
12. JSONファイルがダウンロードされる
    ファイル名: keeb-pd-tweets-2026-02-15T14-30-45.json
```

### シナリオ2: リツイートボタン連携で祝福メッセージをコピー

```
1. ユーザーがKEEB_PD検索ページを閲覧中
   ↓
2. 優勝者のツイートを見つける
   ↓
3. そのツイートのリツイートボタン（🔄）をクリック
   ↓
4. スクリプトがツイート情報を保存（UPDATE_TWEET_CONTEXT）
   内部状態: context.tweet = { userName: "...", fav: 42, ... }
   ↓
5. ユーザーが投稿ボタンをクリック
   ↓
6. 投稿ページ（/compose/post）に移動
   ↓
7. スクリプトが投稿ページ検出（DETECT_COMPOSE_URL）
   ↓
8. 送信ボタン待機（LOADING_COMPOSE_PAGE）
   ↓
9. 送信ボタン検出（COMPOSE_PAGE_LOADED）
   ↓
10. 犬の絵文字（🐶）ボタンが表示される
    ↓
11. ユーザーが🐶ボタンをクリック
    ↓
12. 祝福メッセージがクリップボードにコピーされる
    コンソール: "Text copied!"
    ↓
13. ユーザーが投稿ボックスに貼り付け（Ctrl+V）
    ↓
14. 投稿を送信
```

### シナリオ3: 収集データのクリア

```
1. ユーザーがKEEB_PD検索ページでツイート収集中
   カウンター: "50 tweets collected"
   ↓
2. ユーザーがクリアボタン（🗑 Clear All）をクリック
   ↓
3. 確認ダイアログ表示
   メッセージ: "Clear 50 collected tweets?"
   ↓
4. ユーザーが「OK」をクリック
   ↓
5. 収集データがクリアされる
   内部状態: context.collectedTweets.clear()
   ↓
6. カウンターがリセット
   カウンター: "0 tweet collected"
   ↓
7. ダウンロードボタンが無効化される
   ボタン: opacity 0.5, cursor not-allowed
```

## まとめ

このスクリプトは、KEEB_PD競技の運営を効率化するために設計されています。自動収集機能により手動作業が不要になり、JSONダウンロード機能により結果の保存・分析が容易になります。リツイートボタン連携により、優勝者への祝福メッセージも簡単に投稿できます。

詳細な技術情報は [docs/architecture.md](architecture.md) を参照してください。
