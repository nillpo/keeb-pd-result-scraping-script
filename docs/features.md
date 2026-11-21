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

### 収集データのクリアタイミング

収集したツイートデータは以下のタイミングで自動的にクリアされます：

**自動クリア**:

1. **検索ページから離脱時**: KEEB_PD検索ページから別のページに移動したとき
2. **投稿ページから離脱時**: 投稿ページから検索ページ以外のページに移動したとき

**クリアされないケース**:

- 検索ページ ↔ 投稿ページ間の移動: ツイートデータは保持される
- 同じ検索ページ内でのスクロール: データは保持され続ける

**手動クリア**:

- フローティングパネルの「クリア」ボタンを2回押す（1回目で確認表示、3秒以内に2回目）

この設計により、異なるラウンドや検索条件のツイートが混在することを防ぎつつ、検索ページと投稿ページ間のワークフロー（リツイートボタンで選択→投稿ページで祝福メッセージをコピー）はスムーズに利用できます。

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

1. フローティングパネルの「ダウンロード」ボタンをクリック
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

**構造**: メタ情報と、Tweet オブジェクトの配列（`tweets`）を持つオブジェクト

```json
{
  "schemaVersion": 1,
  "collectedAt": "2026-02-15T14:30:45.123Z",
  "tweets": [
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
}
```

> このフォーマットの導入前（リリース v0.1.0 まで）は、`tweets` の配列だけをそのまま出力していました。読み込み側は `data.tweets` を参照してください。

### トップレベルのフィールド

| フィールド      | 型      | 説明                                                                       | 例                           |
| --------------- | ------- | -------------------------------------------------------------------------- | ---------------------------- |
| `schemaVersion` | number  | JSON形式のバージョン。構造を変えるときに上げます                           | `1`                          |
| `collectedAt`   | string  | ダウンロードした日時（ISO 8601形式）。ファイル名のタイムスタンプと同じ時刻 | `"2026-02-15T14:30:45.123Z"` |
| `tweets`        | Tweet[] | 収集したツイート                                                           |                              |

### Tweet のフィールド

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
    data = json.load(f)

print(f"収集日時: {data['collectedAt']}")
tweets = data['tweets']

# いいね数トップ10
top_10 = sorted(tweets, key=lambda t: t['fav'], reverse=True)[:10]
for tweet in top_10:
    print(f"{tweet['userName']}: {tweet['fav']} likes")
```

### 技術的な実装

**実装箇所**: `src/scriptbody.ts`（ダウンロードボタンのクリック処理）、`src/tweet-export.ts`（`createTweetExport`: JSONの形式とメタ情報の生成）

**ダウンロードフロー**:

```typescript
1. Array.from(context.collectedTweets.values())  // Map → 配列変換
   ↓
2. createTweetExport(tweets, now)                // メタ情報（schemaVersion / collectedAt）を付与
   ↓
3. JSON.stringify(..., null, 2)                  // インデント付きJSON
   ↓
4. new Blob([json], { type: "application/json" }) // Blob作成
   ↓
5. URL.createObjectURL(blob)                     // 一時URL生成
   ↓
6. <a> 要素で download 属性を使用してダウンロード
   ↓
7. URL.revokeObjectURL(url)                      // 一時URLを解放
```

## フローティングコントロールパネル

### 概要

画面右下に表示される、Mac のすりガラス風のパネルで、収集状況の確認とデータ操作ができます。ライト/ダークは Twitter/X のテーマに自動で追従します。

### パネルの位置

- **位置**: 画面右下（右16px、下16px）
- **幅**: 264px
- **固定**: スクロールしても追従
- **z-index**: 9999（他の要素より前面に表示）

### パネルの構成

```
┌──────────────────────────────┐
│ 🐾 KEEB_PD            12件  ⌄ │  ← ヘッダー（クリックで折りたたみ）
├──────────────────────────────┤
│ ふぁぼ数 Top 5                │
│  1  ユーザーA          ♥ 120  │
│  2  ユーザーB          ♥  98  │
│  ...                          │
│ [ ⬇ ダウンロード ] [ 🗑 クリア ] │
└──────────────────────────────┘
```

（上の図のアイコンは、実際にはすべてSVGです）

#### 1. ヘッダー

**表示内容**: 足跡アイコン、`KEEB_PD`、収集した件数（`{数}件`）、折りたたみの矢印

**動作**: ヘッダー全体がボタンで、クリックすると本体（Top 5 とボタン）を開閉します。開閉の状態は `localStorage`（`keeb-pd-panel-collapsed`）に保存され、次回も維持されます。保存できない環境では、保存しません。

**更新頻度**: 1秒ごとに自動更新（setInterval）

#### 2. Top 5 いいね数ランキング

**表示内容**: 収集したツイートのうち、いいね数上位5件を、順位・表示名・ハートのアイコン付きのいいね数で表示

**インタラクション**:

- **ホバー効果**: マウスオーバーで背景色が変わる
- **クリック動作**: ツイートを新規タブで開く（`window.open(url, "_blank", "noopener")`）
- **URL生成パターン**: `https://x.com${tweet.url}`（`twitter.com` で開いている場合は `https://twitter.com`）

**0件のとき**: 「まだ収集されていません」を表示

**ソート順**: いいね数の降順

**ちらつき防止**: 毎秒の更新時に、上位5件（URLといいね数）が前回と同じなら、DOMを作り直しません。

**実装箇所**: `src/panel.ts`（`createRow`、`update`）、アイコンは `src/icons.ts`

#### 3. ダウンロードボタン

**ラベル**: `ダウンロード`（ダウンロードアイコン付き。強調色の塗りつぶしボタン）

**動作**: クリックでJSONファイルをダウンロード（[JSONダウンロード機能](#jsonダウンロード機能)を参照）

**状態管理**: 0件のときは無効（薄く表示され、クリックできない）

#### 4. クリアボタン

**ラベル**: `クリア`（ゴミ箱アイコン付き）

**動作**: 確認ダイアログの代わりに、**2回押して削除**します。

1. 1回目のクリック → ボタンが赤くなり、`もう一度押して削除` と表示（文言が見切れないよう、ダウンロードボタンは一時的に隠れ、クリアボタンが全幅になる）
2. 3秒以内に2回目のクリック → `collectedTweets.clear()` を実行し、件数が0に戻る
3. 3秒以内に押さなかった場合、元の表示に戻る（削除されない）

**状態管理**: 0件のときは無効

### パネルの構成要素と実装

| ファイル              | 役割                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/panel.ts`        | パネルのDOMを組み立てる（`createPanel`）。`update(tweets)` で表示を更新する                                  |
| `src/panel-styles.ts` | パネルのCSS。ホバーやフォーカスなどの擬似クラスが必要なため、インラインstyleではなくスタイルシートで定義する |
| `src/icons.ts`        | ヘッダー、ボタン、ハートのアイコン（インラインSVG）                                                          |
| `src/scriptbody.ts`   | `setupDownloadButton` でパネルを作成し、1秒ごとに `update` を呼ぶ。ダウンロード処理もここ                    |

### パネルのスタイル

**外観**:

- 背景: 半透明＋背景のぼかし（`backdrop-filter: blur(24px) saturate(180%)`）。非対応のブラウザでは、ほぼ不透明の背景にフォールバック
- 枠: 細い境界線（`0.5px`）、角丸 `14px`、影
- フォント: システムフォント（`-apple-system`、ヒラギノ、`system-ui` など）。`13px`
- 色: パネル要素の `data-theme`（`light` / `dark`）で、CSS変数を切り替える

**テーマの判定**: OSの設定ではなく、ページの `body` の背景色から判定します（Twitter/X のライト、Dim、ライツアウトは、OSの設定とは別のため）。背景色の明るさが半分未満ならダーク、判定できない場合はOSの `prefers-color-scheme` に従います。1秒ごとの更新時に再判定するので、Twitter/X側でテーマを切り替えても追従します。

**スタイルの追加方法**: `CSSStyleSheet` を `document.adoptedStyleSheets` に追加します。ページのCSP（`style-src`）の影響を受けないためです。使えない環境では `<style>` 要素にフォールバックします。

**操作の状態**: ホバー、押下、キーボードフォーカス（`:focus-visible`）、無効時の見た目を用意しています。`prefers-reduced-motion` ではアニメーションを無効にします。

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

1. 投稿ページで送信ボタン（「ポストする」）の近くに足跡アイコンのボタンが表示される
2. 足跡ボタンをクリック
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

**アイコン**: 足跡（SVG。`src/icons.ts` の `paw`）

**画像ソース**:
スクリプトに埋め込んだ SVG（`src/icons.ts`）。外部の画像は読み込みません。色は `currentColor` で、ボタンの色（Twitterのアクセントカラー `rgb(29, 155, 240)`）に従います

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

**コピーボタンの作成**（`src/scriptbody.ts` の `setupComposePage`）:

```typescript
const div = document.createElement("div");
div.addEventListener("click", (target) => {
  const currentTarget = target.currentTarget;
  if (currentTarget instanceof HTMLDivElement) {
    navigator.clipboard.writeText(text).then(() => console.log("Text copied!"))
      .catch((err) => console.error("Clipboard write failed", err));
  }
});

div.style.cssText = `display: flex; align-items: center; justify-content: center;
   height: 1.5em; width: 1.5em;
   padding: 0.15em;
   color: rgb(29, 155, 240);
   cursor: pointer;`;
div.append(createIcon("paw", "1.5em"));
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
   カウンター: "0件"
   ↓
8. ページに既に表示されているツイートを自動収集
   カウンター: "5件"
   ↓
9. ユーザーがスクロール → 新しいツイート表示
   ↓
10. 新しいツイートを自動収集
    カウンター: "15件"
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
10. 足跡アイコンのボタンが表示される
    ↓
11. ユーザーが足跡ボタンをクリック
    ↓
12. 祝福メッセージがクリップボードにコピーされる
    コンソール: "Text copied!"
    ↓
13. ユーザーが投稿ボックスに貼り付け（Ctrl+V）
    ↓
14. 投稿を送信
```

### シナリオ3: 収集データのクリア

#### 手動クリア

```
1. ユーザーがKEEB_PD検索ページでツイート収集中
   カウンター: "50件"
   ↓
2. ユーザーがクリアボタンをクリック（1回目）
   ↓
3. ボタンが赤くなり、確認表示になる
   表示: "もう一度押して削除"（3秒間）
   ↓
4. 3秒以内にもう一度クリック（2回目）
   ↓
5. 収集データがクリアされる
   内部状態: context.collectedTweets.clear()
   ↓
6. カウンターがリセット
   カウンター: "0件"
   ↓
7. ダウンロードボタンとクリアボタンが無効化される
   （2回目を押さずに3秒たつと、元の表示に戻り、削除されない）
```

#### 自動クリア（ページ遷移時）

```
1. ユーザーがKEEB_PD検索ページ（R1）でツイート収集中
   カウンター: "30件"
   ↓
2. ユーザーがホームタイムラインに移動
   ↓
3. PAGE_CHANGED イベント発火
   ↓
4. 検索ページ離脱を検出
   ↓
5. 収集データが自動的にクリアされる
   内部状態: context.collectedTweets.clear()
   ↓
6. ユーザーが別のKEEB_PD検索ページ（R2）に移動
   ↓
7. カウンターは0からスタート
   カウンター: "0件"
   ↓
8. R2のツイートを新規収集開始
```

## まとめ

このスクリプトは、KEEB_PD競技の運営を効率化するために設計されています。自動収集機能により手動作業が不要になり、JSONダウンロード機能により結果の保存・分析が容易になります。リツイートボタン連携により、優勝者への祝福メッセージも簡単に投稿できます。

詳細な技術情報は [docs/architecture.md](architecture.md) を参照してください。
