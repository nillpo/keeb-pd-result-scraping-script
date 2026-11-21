# KEEB_PD Result Scraper

## プロジェクト概要

Twitter/X上でKEEB_PD競技のツイートを監視・収集し、JSON形式でダウンロードできるTypeScriptベースのユーザースクリプトです。状態機械パターンを使用してページ遷移を追跡し、ツイートデータを自動的に処理します。

**目的**:
KEEB_PDラウンドのツイートをスクレイピング、メタデータ（いいね、リツイート、ユーザー情報）を抽出し、自動収集とJSONダウンロード機能を提供

**対象プラットフォーム**: Twitter/X（twitter.com および x.com）

## 技術スタック

- **ランタイム**: Node.js 26以降（LTS）
- **パッケージマネージャー**: pnpm（`packageManager`で固定）
- **言語**: TypeScript（strict typing、`any`禁止）
- **バンドラー**: Rolldown
- **リンター / フォーマッター**: oxlint / oxfmt（型チェックは `tsc`）
- **出力**:
  Tampermonkey/Violentmonkey/Greasemonkey互換のユーザースクリプト（.js）

## プロジェクト構造

```
/workspaces/
├── src/
│   ├── scriptbody.ts       # メインアプリケーションロジック、MutationObserver設定
│   ├── state-machine.ts    # 汎用状態機械実装（6状態、8イベントタイプ）
│   ├── tweet-parser.ts     # ツイートDOM解析とフィルタリングユーティリティ
│   └── metablock.ts        # ユーザースクリプトメタデータヘッダー
├── builder.ts              # Rolldown設定とビルドスクリプト
├── package.json            # 依存関係とscripts
├── pnpm-lock.yaml          # 依存関係ロックファイル
├── pnpm-workspace.yaml     # pnpm設定（minimumReleaseAge等）
├── tsconfig.json           # src/（ブラウザ向け）の型チェック設定
├── tsconfig.node.json      # builder.ts（Node向け）の型チェック設定
├── .oxlintrc.json          # oxlint設定
└── out/                    # ビルド出力ディレクトリ（.gitignore）
    └── script.js           # 最終バンドル済みユーザースクリプト
```

## コアコンポーネント

### 状態機械（state-machine.ts）

型安全な有限状態機械の実装。アプリケーション状態と遷移を管理します。

**6つの状態**:

- `INITIAL` → `OBSERVING_TWITTER_PAGE` → ページ変更を監視
- `LOADING_SEARCH_PAGE` → `MONITORING_SEARCH_PAGE` → 検索タイムラインを監視
- `LOADING_COMPOSE_PAGE` → `MONITORING_COMPOSE_PAGE` → コピーボタンを追加

**8つのイベントタイプ**:

- `BEGIN_OBSERVING`: ページ監視開始
- `DETECT_SEARCH_URL`: 現在のURLがKEEB_PD検索パターンか確認
- `SEARCH_PAGE_LOADED`: 検索タイムラインのレンダリング確認
- `DETECT_COMPOSE_URL`: 投稿ページ検出
- `COMPOSE_PAGE_LOADED`: 投稿ページ準備完了確認
- `PAGE_CHANGED`: 監視ページからの離脱処理
- `UPDATE_TWEET_CONTEXT`: 選択されたツイートデータを保存
- `COLLECT_TWEET`: ツイートを自動収集（Map構造に追加）

### ツイート解析（tweet-parser.ts）

ツイートDOM要素を解析し、構造化データを抽出するユーティリティ。

**主要関数**:

- `parseEntryTweet(node)`:
  ツイートメタデータ抽出（日付、いいね、リツイート、ユーザー名、ラウンド、URL）
- `isPromotionTweet(node)`: プロモーションツイートをフィルタリング
- `isQuoteRetweet(node)`: 引用リツイートをフィルタリング
- `getTweetText(tweet)`: 祝福メッセージのフォーマット生成

**Tweetデータ型**:

```typescript
type Tweet = {
  date: string; // ISO datetime
  fav: number; // いいね数
  retweet: number; // リツイート数
  url: string; // ツイートURLパス
  userName: string; // 表示名（絵文字対応）
  round: string; // KEEB_PDラウンド番号
};
```

### メインスクリプト（scriptbody.ts）

MutationObserverの設定と遷移ハンドラーの定義。

**2つのObserver**:

1. `twitterPageObserver`: ページ全体を監視（ナビゲーションと要素読み込み検出）
2. `searchTimelineObserver`:
   検索結果を監視（ツイート自動収集、リツイートボタンリスナー追加）

**対象URLパターン**: `/search?f=live&q=...` で以下を含む:

- ハッシュタグ `#KEEB_PD_R\d+`
- 最低いいね数フィルタ `min_faves:\d+`

**主要機能（最新）**:

- **ツイート自動収集**: `collectedTweets: Map<string, Tweet>()`
  で重複排除し、自動収集
- **フローティングパネル**:
  - カウンター表示
  - **Top 5いいね数ランキング**:
    収集ツイート上位5件を表示（クリックで新規タブで開く）
  - JSONダウンロードボタン
  - クリアボタン

  画面右下に表示
- **JSONダウンロード**:
  タイムスタンプ付きファイル名（例：`keeb-pd-tweets-2026-02-15T14-30-45.json`）

## 重要な制約

### ブラウザAPI制限

ユーザースクリプトはブラウザコンテキストで実行されるため、`src/`では**Node.js
APIは使用不可**です。

**使用可能**: `MutationObserver`、`document`、`window`、`navigator.clipboard`
等のブラウザAPI **使用禁止**: `node:fs` 等のNode.js
API（ポリフィルなし）。Node.js APIは`builder.ts`でのみ使用できます

### ロケール依存

スクリプトは**日本語ロケール**のaria-labelに依存しています。

**重要なセレクタ**:

- タイムライン: `div[aria-label="タイムライン: タイムラインを検索"]`
  (scriptbody.ts:322)
- プロモーションテキスト: `"プロモーション"` (tweet-parser.ts:30)

### Twitter DOM依存

Twitter/XはDOM構造を頻繁に変更します。セレクタが動作しなくなった場合:

1. DevToolsで現在のDOM構造を確認
2. `data-testid` または `aria-label` の更新を確認
3. `scriptbody.ts` または `tweet-parser.ts` のセレクタを更新

**よく使われるセレクタ**:

- ツイートコンテナ: `div[data-testid="cellInnerDiv"]`
- いいねボタン: `button[data-testid="like"]`
- リツイートボタン: `button[data-testid="retweet"]` /
  `button[data-testid="unretweet"]`

## コーディング規約（厳守事項）

### TypeScript

- **strict typing**: 全てのコードで厳密な型付けを使用
- **`any`禁止**: `unknown`を使用（型が不明な場合）
- **`type`優先**: データ構造には`type`を使用、`interface`は最小限
- **Discriminated unions**: 状態機械の結果型に使用（例：`EntryTweetResult`）

### DOM操作

- **要素存在チェック必須**: DOM要素アクセス前に必ず存在確認
- **`data-testid`優先**: CSSクラスセレクタより安定
- **早期フィルタリング**: 無関係な要素を処理前に除外（プロモーション、引用RT）

### 状態機械パターン

- **Conditionは純粋関数**: 副作用なし、状態を変更しない
- **Execute handlerは同期**: 非同期処理は禁止
- **`tryDispatch` vs `dispatch`**:
  - `tryDispatch`: オプショナル遷移（失敗時は何もしない）
  - `dispatch`: 期待される遷移（失敗時はログ出力）

### Node.js / pnpm規約

- **依存の固定**: `pnpm add -D --save-exact <pkg>`で追加し、`package.json`にバージョンを固定
- **pnpm-lock.yaml使用**: 再現可能ビルドのためコミットし、`pnpm install --frozen-lockfile`で導入
- **公開7日ルール**: `pnpm-workspace.yaml`の`minimumReleaseAge: 10080`（7日）を維持し、公開から7日未満のバージョンを導入しない。`minimumReleaseAgeExclude`での例外指定は原則禁止
- **ビルドスクリプト許可制**: 依存のビルドスクリプトは`allowBuilds`で明示的に許可したものだけ実行
- **node:プレフィックス**: Node.js組み込みモジュールは`node:`付きでインポート（`builder.ts`のみ）
- **型チェック必須**: バンドラーは型チェックしないため、`pnpm typecheck`を実行する
- **ツールチェーン**: リント`pnpm lint`（oxlint）、整形`pnpm fmt`（oxfmt）

## ビルドとデバッグ

### ビルドコマンド

```bash
# 依存関係のインストール
pnpm install --frozen-lockfile

# 開発ビルド（ファイル監視）
pnpm dev

# 本番ビルド（単発実行）
pnpm build

# 検証
pnpm typecheck   # tsc
pnpm lint        # oxlint
pnpm fmt:check   # oxfmt（整形は pnpm fmt）
```

**ビルドプロセス**:

1. `src/scriptbody.ts` をRolldownでバンドル
2. `src/metablock.ts` のメタデータを先頭に追加
3. `oxfmt`（stdin経由）でフォーマット
4. `out/script.js` に出力

### デバッグ方法

ユーザースクリプトはブラウザで実行されるため、Browser DevToolsでデバッグします。

**状態機械ログ確認**:

- `Transitioned from X to Y`: 遷移成功
- `Failed to transition from X due to Y`: 遷移失敗（条件チェック）
- `TWEET PARSE`: ツイート解析結果または失敗理由
- `Filtered nodes:`: 有効なツイートノード数

**ローカルテスト手順**:

1. `pnpm dev` でビルド監視開始
2. コード変更後、`out/script.js` をコピー
3. Tampermonkeyダッシュボードでスクリプトを編集・貼り付け
4. Twitter/Xページを再読み込み

## 詳細ドキュメント

より詳細な情報は以下を参照してください：

- **[docs/architecture.md](docs/architecture.md)**:
  アーキテクチャ詳細、設計決定の理由、データフロー
- **[docs/development.md](docs/development.md)**:
  開発環境セットアップ（ローカルNode.js + pnpm、DevContainer、Docker Compose）
- **[docs/coding-guidelines.md](docs/coding-guidelines.md)**:
  コーディング規約、DOM操作パターン、パフォーマンス最適化
- **[docs/features.md](docs/features.md)**: 機能詳細と使用方法

## よくある問題

### ツイートが検出されない

1. URLパターン確認（`isKEEBPDSearchURL` の条件、scriptbody.ts:21）
2. タイムラインセレクタ確認（scriptbody.ts:322）
3. DevToolsでツイートDOM構造を確認し、`tweet-parser.ts` のセレクタを更新

### ビルドエラー

- `pnpm install --frozen-lockfile` で依存関係を再インストール
- `pnpm build` 経由で実行する（`oxfmt` が `node_modules/.bin` にあるため）
- `ERR_PNPM_NO_MATURE_MATCHING_VERSION` は公開7日未満のバージョンしか無い場合に出る。7日待つか古い版を指定する
- 循環インポートや型エラーを確認

### パフォーマンス低下

MutationObserverが原因の場合:

```typescript
const start = performance.now();
// ... 処理ロジック
console.log(`Processed in ${performance.now() - start}ms`);
```

目標: < 50ms / バッチ処理
