# 開発環境

このドキュメントでは、KEEB_PD Result
Scraperの開発環境セットアップと開発ワークフローについて説明します。

## 目次

- [開発環境オプション](#開発環境オプション)
- [初期セットアップ](#初期セットアップ)
- [ビルドコマンド](#ビルドコマンド)
- [ローカルテスト手順](#ローカルテスト手順)
- [デバッグ方法](#デバッグ方法)

## 開発環境オプション

このプロジェクトは3つの開発環境オプションを提供しています。開発者の好みや環境に応じて選択してください。

### オプション1: ローカルNode.js + pnpm開発（推奨）

最もシンプルで高速な開発環境です。Node.jsとpnpmをインストールするだけで始められます。

#### 前提条件

- **Node.js**: 26.13.1以降（LTS。`builder.ts` をtype strippingで直接実行するため）
- **pnpm**: 12.21.0（`package.json` の `packageManager` に固定。10.16以降で `minimumReleaseAge` が使えます）
- **VS Code**（オプション、推奨）: Oxc拡張機能と組み合わせて使用

#### Node.js / pnpmのインストール

Node.jsは [公式サイト](https://nodejs.org/) のインストーラー、または `nvm` / `fnm` などのバージョンマネージャーで導入します。

**pnpmのインストール**（Node.js 25以降は `corepack` が同梱されないためnpm経由）:

```bash
npm install -g pnpm@12.21.0
```

**インストール確認**:

```bash
node --version   # v26.13.1 以降
pnpm --version   # 12.21.0
```

#### VS Code設定

1. **Oxc拡張機能のインストール**:
   - VS Codeで「拡張機能」を開く（Ctrl+Shift+X / Cmd+Shift+X）
   - "Oxc" で検索し、`oxc.oxc-vscode` をインストール

2. **プロジェクト設定**: このプロジェクトには `.vscode/settings.json`
   が含まれており、以下が自動的に有効になります：
   ```json
   {
     "editor.defaultFormatter": "oxc.oxc-vscode",
     "editor.formatOnSave": true
   }
   ```

3. **機能**:
   - 保存時の自動フォーマット（oxfmt）
   - インラインのリント診断（oxlint）
   - TypeScript IntelliSense（型補完）

#### メリット

- **高速**: ビルド・リント・フォーマットがいずれも高速（Rust製ツールチェーン）
- **標準的**: Node.js + pnpmで、エコシステムの情報が豊富
- **再現性**: `pnpm-lock.yaml` と固定バージョンで同じ環境を再現
- **安全寄り**: 公開7日未満のバージョンを導入しない設定

### オプション2: DevContainer（VS Code）

VS CodeのDev
Containers拡張機能を使用し、Docker内で開発します。環境構築が自動化され、チーム間で一貫性のある環境を共有できます。

#### 前提条件

- **Docker Desktop**: インストール済みで起動している
- **VS Code**: インストール済み
- **Dev Containers拡張機能**: VS Codeにインストール

#### セットアップ手順

1. **リポジトリをクローン**:
   ```bash
   git clone https://github.com/nillpo/keeb-pd-scraper.git
   cd keeb-pd-scraper
   ```

2. **VS Codeで開く**:
   ```bash
   code .
   ```

3. **コンテナで再オープン**:
   - VS Codeの右下に "Reopen in Container" 通知が表示される
   - クリックするか、コマンドパレット（F1）で "Dev Containers: Reopen in
     Container" を実行

4. **自動セットアップ**:
   - Dockerイメージのビルド（初回のみ、数分かかる）
   - Node.js・pnpmのインストール
   - `pnpm install --frozen-lockfile`（post-create）
   - VS Code拡張機能（Oxc）の自動インストール

5. **開発開始**:
   - ターミナルが自動的に開く
   - `pnpm dev` でビルド開始

#### DevContainerの構成

**ベースイメージ**:
`mcr.microsoft.com/devcontainers/base:ubuntu`

**インストールされる機能**:

- Node.js（LTS、`.devcontainer/Dockerfile` の `NODE_VERSION` で固定）
- pnpm（`PNPM_VERSION` で固定）
- GitHub CLI（バージョンは `.devcontainer/devcontainer-lock.json` で固定。Dev Containers CLI が生成するため手で編集しない）
- Claude Code

**永続ボリューム**:

- `~/.claude`: Claude Code設定
- bashコマンド履歴
- GitHub CLI設定
- `node_modules`（`/workspaces/node_modules`。ホストのバインドマウントと分離し、OS差異の回避とI/O高速化を図る。pnpmストアも同じボリューム内にあるためハードリンクが有効）

**ユーザー**: `vscode`（非root）

**ワークスペース**: `/workspaces`

#### メリット

- **環境の一貫性**: 全開発者が同じ環境を使用
- **クリーンな環境**: ホストマシンを汚さない
- **自動セットアップ**: `.devcontainer/devcontainer.json` で自動化
- **VS Code統合**: シームレスな開発体験

### オプション3: Docker Compose

Docker Composeを使用し、独立したコンテナ環境で開発します。Claude
Code機能を使用する場合に便利です。

#### 前提条件

- **Docker Desktop**: インストール済みで起動している
- **Docker Compose**: Docker Desktopに含まれる

#### セットアップ手順

1. **環境変数設定**（オプション、Claude Code使用時）:
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```

   または `.env` ファイルを作成:
   ```bash
   echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
   ```

2. **コンテナ起動**:
   ```bash
   docker-compose up -d
   ```

3. **コンテナに接続**:
   ```bash
   docker-compose exec claude-code /bin/bash
   ```

4. **開発開始**:
   ```bash
   pnpm install --frozen-lockfile && pnpm dev
   ```

5. **コンテナ停止**:
   ```bash
   docker-compose down
   ```

#### Docker Composeの構成

**docker-compose.yml の内容**:

```yaml
services:
  claude-code:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: claude-code-container-keeb-pd-scraper
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - ./:/workspace
      - ~/.claude:/home/vscode/.claude
    working_dir: /workspace
    command: /bin/bash -c "while sleep 1000; do :; done"
    networks:
      - calude-code-mcp-network

networks:
  calude-code-mcp-network:
    driver: bridge
```

**Dockerfile の内容**:

`.devcontainer/Dockerfile` と同様に、Node.js（公式tarball、SHA256検証）とpnpmをインストールします。詳細は `.devcontainer/Dockerfile` を参照してください。

```dockerfile
FROM mcr.microsoft.com/devcontainers/base:ubuntu
ARG NODE_VERSION=26.13.1
ARG PNPM_VERSION=12.21.0

USER vscode
# Node.js と pnpm を ~/.local/node にインストール（詳細は .devcontainer/Dockerfile）
ENV PATH="/home/vscode/.local/node/bin:${PATH}"
WORKDIR /workspace
```

#### コンテナ詳細

- **コンテナ名**: `claude-code-container-keeb-pd-scraper`
- **ネットワーク**: `calude-code-mcp-network`（bridge）
- **ワークスペースマウント**: `./` → `/workspace`
- **Claude設定マウント**: `~/.claude` → `/home/vscode/.claude`

#### メリット

- **完全な隔離**: コンテナ内で完結
- **再現可能**: `docker-compose.yml` で環境を定義
- **Claude Code統合**: ANTHROPIC_API_KEY でClaude機能を使用可能
- **複数プロジェクト**: 他のプロジェクトと独立

## 初期セットアップ

どの開発環境を選択した場合でも、以下の手順が共通です。

### リポジトリのクローン

```bash
git clone https://github.com/nillpo/keeb-pd-scraper.git
cd keeb-pd-scraper
```

### 依存関係のインストール

```bash
pnpm install --frozen-lockfile
```

**開発依存**（`package.json` の `devDependencies`、バージョンは固定）:

- `rolldown`: バンドラー
- `oxlint`: リンター
- `oxfmt`: フォーマッター
- `typescript`: 型チェック（`tsc`）
- `@types/node`: `builder.ts` 用のNode型定義

### pnpm-lock.yaml と公開7日ルール

`pnpm-lock.yaml` は依存関係のバージョンを固定します。チームで同じバージョンを使用するため、このファイルをgit管理しています。

`pnpm-workspace.yaml` の `minimumReleaseAge: 10080`（7日）により、公開から7日未満のバージョンは導入されません（サプライチェーン対策）。依存を追加・更新する場合:

```bash
pnpm add -D --save-exact <package>
```

直近に公開された最新版は自動的に除外され、7日以上経過した版が選択されます。

## ビルドコマンド

### 開発ビルド（ファイル監視）

```bash
pnpm dev
```

**動作**:

- `src/` と `builder.ts` の変更を `node --watch` で監視
- 変更検出時に自動的に再ビルド
- `out/script.js` を更新

**ログ出力**:

```
> node --watch --watch-path=./src --watch-path=./builder.ts builder.ts
Built /workspaces/out/script.js
Completed running 'builder.ts'
```

**停止方法**: Ctrl+C

### 本番ビルド（単発実行）

```bash
pnpm build
```

**動作**:

- 1回だけビルドを実行
- `out/script.js` を生成
- 終了

**使用タイミング**:

- リリース前の最終ビルド
- CI/CDパイプラインでの自動ビルド

### 検証コマンド

```bash
pnpm typecheck   # tsc による型チェック（src: ブラウザ向け / builder.ts: Node向け）
pnpm lint        # oxlint（any禁止などを検査）
pnpm fmt         # oxfmt で整形
pnpm fmt:check   # 整形済みかの確認のみ
```

バンドラーは型チェックを行わないため、コミット前に `pnpm typecheck` を実行してください。

### ビルドプロセス詳細

`builder.ts` が実行する処理（順番に）:

1. **Rolldownでバンドル**:
   - エントリーポイント: `src/scriptbody.ts`
   - `platform: "browser"`、出力形式: ESM（1ファイル）
   - 出力: 一時的なJavaScriptコード（メモリ上）

2. **メタデータヘッダー追加**:
   - `src/metablock.ts` からユーザースクリプトヘッダーを取得
   - バンドル済みコードの先頭に追加

3. **フォーマット**:
   - `oxfmt --stdin-filepath script.js` にstdin経由で渡し、整形結果を受け取る

4. **ファイル書き込み**:
   - `out/` を作り直し、`out/script.js` に最終的なユーザースクリプトを保存

`builder.ts` はNodeのtype strippingで直接実行されます（`node builder.ts`）。Node.js 26以降が必要です。

## ローカルテスト手順

ビルド後、実際のTwitter/Xページでスクリプトをテストします。

### ステップ1: スクリプトマネージャーにインストール

#### Tampermonkeyの場合

1. **ダッシュボードを開く**:
   - ブラウザのツールバーでTampermonkeyアイコンをクリック
   - "ダッシュボード" を選択

2. **新しいスクリプトを作成**:
   - "+" ボタンまたは "新しいスクリプト" タブをクリック

3. **コードを貼り付け**:
   - エディタのデフォルトコードを全削除
   - `out/script.js` の内容をコピー＆ペースト

4. **保存**:
   - Ctrl+S（Windows/Linux）または Cmd+S（Mac）
   - または "ファイル" → "保存"

#### Violentmonkeyの場合

1. **ダッシュボードを開く**:
   - ブラウザのツールバーでViolentmonkeyアイコンをクリック
   - "ダッシュボードを開く" を選択

2. **新しいスクリプト**:
   - "+" ボタンをクリック

3. **コードを貼り付け**:
   - `out/script.js` の内容をコピー＆ペースト

4. **保存して閉じる**:
   - Ctrl+S または "保存して閉じる" ボタン

### ステップ2: Twitter/Xで動作確認

1. **検索ページを開く**:
   ```
   https://twitter.com/search?f=live&q=%23KEEB_PD_R1%20min_faves%3A10
   ```

2. **フローティングパネルを確認**:
   - 画面右下に青いパネルが表示されるか確認
   - カウンターが "0 tweet collected" から増加するか確認

3. **ブラウザコンソールを開く**:
   - F12キーを押す
   - "Console" タブを選択

4. **ログを確認**:
   ```
   Transitioned from INITIAL to OBSERVING_TWITTER_PAGE
   Transitioned from OBSERVING_TWITTER_PAGE to LOADING_SEARCH_PAGE
   Transitioned from LOADING_SEARCH_PAGE to MONITORING_SEARCH_PAGE
   Filtered nodes: [...]
   TWEET PARSE: {"date":"...","fav":42,...}
   Collected: /username/status/123 (Total: 1)
   ```

5. **JSONダウンロードをテスト**:
   - ダウンロードボタンをクリック
   - ダウンロードフォルダにJSONファイルが保存されるか確認

### ステップ3: コード変更時の再テスト

1. **コードを変更**（例：`src/tweet-parser.ts`）
2. **ビルドを待つ**（`pnpm dev` を実行中の場合、自動ビルド）
3. **Tampermonkeyで更新**:
   - ダッシュボードを開く
   - スクリプトを選択
   - 編集画面で新しい `out/script.js` の内容をコピー＆ペースト
   - 保存
4. **Twitter/Xページを再読み込み**（F5）
5. **動作確認**

## デバッグ方法

### Browser DevToolsの使用

ユーザースクリプトはブラウザで実行されるため、Browser DevToolsでデバッグします。

#### DevToolsの開き方

- **Windows/Linux**: F12 または Ctrl+Shift+I
- **Mac**: Cmd+Option+I

#### Consoleタブ

**状態機械のログ**:

状態遷移が成功すると、以下のようなログが出力されます：

```
Transitioned from OBSERVING_TWITTER_PAGE to LOADING_SEARCH_PAGE
Transitioned from LOADING_SEARCH_PAGE to MONITORING_SEARCH_PAGE
```

失敗時:

```
Failed to transition from LOADING_SEARCH_PAGE due to Action for event SEARCH_PAGE_LOADED in state LOADING_SEARCH_PAGE failed
```

**ツイート解析ログ**:

成功時:

```
TWEET PARSE: {"date":"2026-02-15T12:34:56.000Z","fav":42,"retweet":5,"url":"/user/status/123","userName":"ユーザー名","round":"1"}
```

失敗時:

```
TWEET PARSE: like element not found
TWEET PARSE: node is promotion tweet
TWEET PARSE: round information not found
```

**収集ログ**:

```
Collected: /username/status/1234567890 (Total: 5)
Collected: /another/status/9876543210 (Total: 6)
```

#### Elementsタブ

**フローティングパネルの検査**:

1. Elementsタブを開く
2. Ctrl+F（Cmd+F）で検索
3. `keeb-pd-download-panel` で検索
4. パネルのDOM構造とスタイルを確認

**ツイートノードの検査**:

1. 検索: `data-testid="cellInnerDiv"`
2. ツイート要素の構造を確認
3. セレクタが正しいか検証

#### Networkタブ

**外部通信の確認**（セキュリティチェック）:

1. Networkタブを開く
2. スクリプトを実行
3. リクエストリストを確認
4. **期待される動作**: スクリプト関連のネットワークリクエストが0件

### 状態機械デバッグ

**リスナーを追加**（scriptbody.ts:305-313）:

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

**現在の状態を確認**:

ブラウザコンソールで実行:

```javascript
stateMachine.getState();
// 出力例: "MONITORING_SEARCH_PAGE"
```

**遷移可能か確認**:

```javascript
stateMachine.canTransition({ type: "SEARCH_PAGE_LOADED", css_selector: "..." });
// 出力: true または false
```

### パフォーマンスプロファイリング

MutationObserverの処理時間を計測:

```typescript
const searchTimelineObserver = new MutationObserver((mutations, _observer) => {
  const start = performance.now();

  // ... 処理ロジック

  const duration = performance.now() - start;
  console.log(
    `Processed ${validNodes.length} nodes in ${duration.toFixed(2)}ms`,
  );
});
```

**目標パフォーマンス**:

- < 50ms / 変更バッチ
- < 5ms / ツイート解析

### よくあるデバッグシナリオ

#### 問題: フローティングパネルが表示されない

**デバッグ手順**:

1. コンソールで状態確認:
   ```
   Transitioned from LOADING_SEARCH_PAGE to MONITORING_SEARCH_PAGE
   ```
   このログがあるか確認

2. タイムライン要素の確認:
   ```javascript
   document.querySelector('div[aria-label="タイムライン: タイムラインを検索"]');
   // null でない場合は要素が存在
   ```

3. パネル要素の確認:
   ```javascript
   document.getElementById("keeb-pd-download-panel");
   // null の場合はパネルが追加されていない
   ```

#### 問題: ツイートが収集されない

**デバッグ手順**:

1. URLパターン確認:
   ```javascript
   isKEEBPDSearchURL(new URL(document.location.href));
   // true であるべき
   ```

2. フィルタリングログ確認:
   ```
   Filtered nodes: []
   ```
   空配列の場合、ツイートが検出されていない

3. ツイートノード確認:
   ```javascript
   document.querySelectorAll('div[data-testid="cellInnerDiv"]').length;
   // 0より大きい値であるべき
   ```

#### 問題: ビルドエラー

**エラー例**:

```
Error: Cannot find package 'rolldown' imported from /workspaces/builder.ts
```

**解決方法**: 依存関係をインストールします:

```bash
pnpm install --frozen-lockfile
```

**エラー例**:

```
spawn oxfmt ENOENT
```

**解決方法**: `oxfmt` は `node_modules/.bin` にあるため、`node builder.ts` を直接実行せず `pnpm build` 経由で実行してください。

**エラー例**:

```
ERR_PNPM_NO_MATURE_MATCHING_VERSION
```

**原因**: `minimumReleaseAge`（公開から7日）を満たすバージョンが無い。公開から7日経過するまで待つか、古いバージョンを指定してください。`minimumReleaseAgeExclude` による例外指定は原則使用しません。

## まとめ

このプロジェクトは柔軟な開発環境を提供しており、ローカルNode.js + pnpm開発、DevContainer、Docker
Composeのいずれかを選択できます。ビルドコマンドはシンプルで、ローカルテストはブラウザのスクリプトマネージャーで簡単に行えます。デバッグにはBrowser
DevToolsを活用し、状態機械のログやパフォーマンスプロファイリングで問題を迅速に特定できます。

詳細な技術情報は [docs/architecture.md](architecture.md) を参照してください。
