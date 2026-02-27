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

### オプション1: ローカルDeno開発（推奨）

最もシンプルで高速な開発環境です。Denoをインストールするだけで始められます。

#### 前提条件

- **Deno**: 最新版（1.40以降を推奨）
- **VS Code**（オプション、推奨）: Deno拡張機能と組み合わせて使用

#### Denoのインストール

**macOS / Linux**:

```bash
curl -fsSL https://deno.land/install.sh | sh
```

**Windows (PowerShell)**:

```powershell
irm https://deno.land/install.ps1 | iex
```

**Homebrew (macOS)**:

```bash
brew install deno
```

**インストール確認**:

```bash
deno --version
# 出力例: deno 1.40.0 (release, x86_64-apple-darwin)
```

#### VS Code設定

1. **Deno拡張機能のインストール**:
   - VS Codeで「拡張機能」を開く（Ctrl+Shift+X / Cmd+Shift+X）
   - "Deno" で検索
   - "Deno" (by denoland) をインストール

2. **プロジェクト設定**: このプロジェクトには `.vscode/settings.json`
   が含まれており、以下が自動的に有効になります：
   ```json
   {
     "deno.enable": true,
     "deno.lint": true,
     "deno.unstable": false
   }
   ```

3. **機能**:
   - TypeScript IntelliSense（型補完）
   - JSRとnpmパッケージのインポート解決
   - インライン型チェック
   - デバッグサポート

#### メリット

- **高速**: ビルドが非常に速い（esbuildベース）
- **軽量**: `node_modules` がないため、ディスク使用量が少ない
- **標準ツール内蔵**: フォーマッター、リンターが標準搭載
- **セキュア**: 権限ベースのセキュリティモデル

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
   - Denoのインストール
   - VS Code拡張機能の自動インストール

5. **開発開始**:
   - ターミナルが自動的に開く
   - `deno task dev` でビルド開始

#### DevContainerの構成

**ベースイメージ**:
`mcr.microsoft.com/devcontainers/javascript-node:1-20-bullseye`

**インストールされる機能**:

- Deno（最新版）
- GitHub CLI
- Git

**永続ボリューム**:

- `~/.claude`: Claude Code設定（ホストと共有）
- bashコマンド履歴

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
   deno task dev
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

```dockerfile
FROM mcr.microsoft.com/devcontainers/javascript-node:1-20-bullseye

# Install Deno
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt update \
    && apt install gh -y

USER vscode
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

### 依存関係の確認

このプロジェクトはDeno URLベースのインポートを使用しているため、`npm install`
は不要です。

**依存関係リスト**（`deno.jsonc` の `imports` フィールド）:

```jsonc
{
  "imports": {
    "@deno/esbuild-plugin": "jsr:@deno/esbuild-plugin@^1.2.1",
    "esbuild": "npm:esbuild@^0.27.3"
  }
}
```

**キャッシュ更新**（必要に応じて）:

```bash
deno cache --reload builder.ts
```

### deno.lock の確認

`deno.lock`
ファイルは依存関係のバージョンを固定します。チームで同じバージョンを使用するため、このファイルをgit管理しています。

**ロックファイル更新**（依存関係を変更した場合）:

```bash
deno cache --reload --lock=deno.lock --lock-write builder.ts
```

## ビルドコマンド

### 開発ビルド（ファイル監視）

```bash
deno task dev
```

**動作**:

- `src/` ディレクトリのファイル変更を監視
- 変更検出時に自動的に再ビルド
- `out/script.js` を更新

**ログ出力**:

```
Task dev deno run --allow-read --allow-write --allow-env --allow-net --allow-run --watch builder.ts
Watcher Process started.
Built script.js successfully
```

**停止方法**: Ctrl+C

### 本番ビルド（単発実行）

```bash
deno task build
```

**動作**:

- 1回だけビルドを実行
- `out/script.js` を生成
- 終了

**使用タイミング**:

- リリース前の最終ビルド
- CI/CDパイプラインでの自動ビルド

### ビルドプロセス詳細

`builder.ts` が実行する処理（順番に）:

1. **esbuildでバンドル**:
   - エントリーポイント: `src/scriptbody.ts`
   - プラグイン: `denoPlugin` でDeno importsを解決
   - 出力: 一時的なJavaScriptコード

2. **メタデータヘッダー追加**:
   - `src/metablock.ts` からユーザースクリプトヘッダーを取得
   - バンドル済みコードの先頭に追加

3. **フォーマット**:
   - `deno fmt` を実行し、コードを整形

4. **ファイル書き込み**:
   - `out/script.js` に最終的なユーザースクリプトを保存

**builder.ts の主要コード**:

```typescript
import * as esbuild from "esbuild";
import { denoPlugin } from "@deno/esbuild-plugin";
import { metablock } from "./src/metablock.ts";

const result = await esbuild.build({
  plugins: [denoPlugin()],
  entryPoints: ["./src/scriptbody.ts"],
  bundle: true,
  format: "iife",
  write: false,
});

const code = new TextDecoder().decode(result.outputFiles[0].contents);
const script = metablock + "\n" + code;

await Deno.writeTextFile("./out/script.js", script);

// deno fmt で整形
const fmt = new Deno.Command("deno", {
  args: ["fmt", "./out/script.js"],
});
await fmt.output();
```

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
2. **ビルドを待つ**（`deno task dev` を実行中の場合、自動ビルド）
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
error: Module not found "jsr:@deno/esbuild-plugin@^1.2.1"
```

**解決方法**:

```bash
deno cache --reload builder.ts
```

**エラー例**:

```
error: Uncaught (in promise) PermissionDenied: Requires write access to "./out/script.js"
```

**解決方法**: `deno.jsonc` のタスク定義に `--allow-write` があるか確認:

```jsonc
{
  "tasks": {
    "build": "deno run --allow-read --allow-write --allow-env --allow-net --allow-run builder.ts"
  }
}
```

## まとめ

このプロジェクトは柔軟な開発環境を提供しており、ローカルDeno開発、DevContainer、Docker
Composeのいずれかを選択できます。ビルドコマンドはシンプルで、ローカルテストはブラウザのスクリプトマネージャーで簡単に行えます。デバッグにはBrowser
DevToolsを活用し、状態機械のログやパフォーマンスプロファイリングで問題を迅速に特定できます。

詳細な技術情報は [docs/architecture.md](architecture.md) を参照してください。
