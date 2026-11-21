# KEEB_PD Result Scraper

Twitter/X上でKEEB_PD競技のツイートを自動的に収集・解析し、結果をJSON形式でダウンロードできるユーザースクリプトです。

## 開発

Node.js 26以降とpnpmが必要です。

```bash
pnpm install --frozen-lockfile
pnpm build   # out/script.js を生成
pnpm dev     # ファイル監視ビルド
```

`out/script.js` をTampermonkey等のスクリプトマネージャーに貼り付けて使用します。詳細は [docs/development.md](docs/development.md) を参照してください。

> 依存パッケージは公開から7日未満のバージョンを導入しない設定（`pnpm-workspace.yaml`の`minimumReleaseAge`）にしています。
