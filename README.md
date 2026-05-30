# Q-site (Cryptraveler's Notes)

地球放浪20年以上の旅人クリプトラベラーによるブログサイト。
旧 WordPress (qryptraveller.com) から Notion + Astro へ移行したもの。

## 構成

```
Notion (Blog Articles DB)   ← 編集はここで行う
        ↓ npm run sync
src/data/posts.json         ← ビルド時のキャッシュ (Git管理外)
        ↓ npm run build
dist/                       ← 静的サイト (Cloudflare Pages へデプロイ)
```

## 技術スタック

- **Astro 5.x** — 静的サイトジェネレータ
- **Tailwind CSS 3.x** — ユーティリティCSS
- **Notion API** (`@notionhq/client`) — コンテンツソース
- **Cloudflare Pages** — ホスティング (予定)

## ローカル開発

### 初回セットアップ

```bash
npm install
```

### コンテンツの取得 (2通り)

#### A. Notion から同期 (本番運用)

```bash
export NOTION_TOKEN='secret_xxx...'
npm run sync
```
→ `src/data/posts.json` が生成される。

#### B. ローカルMarkdownから生成 (開発・オフライン)

```bash
npm run build:from-md
```
→ `migration/posts/*.md` + `migration/reports/enriched_posts.csv` から
   `src/data/posts.json` を生成 (Notion不要)。

### 開発サーバー

```bash
npm run dev
```
→ http://localhost:4321

### 本番ビルド

```bash
npm run build
```
→ `dist/` に静的ファイルが出力される。`_redirects` も自動生成される。

### プレビュー

```bash
npm run preview
```

## ディレクトリ構成

```
.
├── astro.config.mjs       # Astro 設定
├── tailwind.config.mjs    # Tailwind 設定 (カスタム配色)
├── src/
│   ├── layouts/Layout.astro    # ベースレイアウト
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── ArticleCard.astro   # 3バリアント (default/compact/wide)
│   │   ├── SeriesCard.astro
│   │   ├── ArticleBody.astro   # Notionブロック→HTMLレンダラ
│   │   ├── SeriesNav.astro     # 前話/次話
│   │   └── CategoryBadge.astro
│   ├── pages/
│   │   ├── index.astro          # トップ (Hero / Featured / Series / Latest)
│   │   ├── about.astro
│   │   ├── 404.astro
│   │   ├── archive.astro        # 年別アーカイブ
│   │   ├── rss.xml.ts           # RSS フィード
│   │   ├── posts/[slug].astro   # 記事ページ (動的)
│   │   ├── series/index.astro
│   │   ├── series/[name].astro  # シリーズ目次
│   │   ├── category/index.astro
│   │   ├── category/[name].astro
│   │   ├── tag/index.astro
│   │   └── tag/[name].astro
│   ├── lib/posts.ts             # データクエリヘルパー
│   ├── styles/global.css        # Tailwind + プロースタイル
│   └── data/posts.json          # コンテンツキャッシュ (gitignore)
├── public/
│   └── images/wp/wp-content/    # 画像 (画像ZIPを展開して配置)
├── scripts/
│   ├── sync-notion.mjs          # Notion → posts.json
│   ├── build-from-md.mjs        # MD → posts.json (オフライン用)
│   └── generate-redirects.mjs   # 旧WP URL → 新URL リダイレクト
├── migration/                   # 元データ・移行作業の記録
│   ├── posts/                   # WP記事の Markdown 版 (781本)
│   ├── images/                  # ダウンロード済み画像 (.gitignore)
│   ├── reports/
│   │   ├── enriched_posts.csv   # 全記事メタデータ
│   │   └── stats.json
│   └── scripts/                 # 移行スクリプト
└── dist/                        # ビルド出力 (.gitignore)
```

## デザイン

### カラーパレット

| 用途 | 色 | コード |
|---|---|---|
| 背景 | 和紙オフホワイト | `#F5F1E8` |
| 本文 | 墨色 | `#1F1B16` |
| 見出し | 森の影 (深緑) | `#2C3A2E` |
| リンク | 苔緑 | `#5B7553` |
| アクセント | 土・木 | `#8B5E3C` |
| 放浪記 | 暖かい褐色 | `#A6845F` |
| 思想・理論 | 冷たい青灰 | `#4A5E66` |
| 時事・情報戦 | 錆色 | `#9C5642` |
| エッセイ | 暖灰 | `#7A7060` |

### タイポグラフィ

- **見出し**: Noto Serif JP (明朝)
- **本文**: Noto Sans JP (17px, 行間1.9)
- **欧文**: Inter / Newsreader

## 画像の配置

WordPress 時代の画像は `public/images/wp/wp-content/...` に配置する必要があります。
ローカルでダウンロード済みの 347MB / 1959 枚を:

```bash
mkdir -p public/images/wp
cp -r ~/Desktop/qryp-images/images/wp/* public/images/wp/
```

→ ビルド時に `public/` 以下はそのまま `dist/` にコピーされる。

## デプロイ (Cloudflare Pages)

1. https://dash.cloudflare.com → Workers & Pages → 新規プロジェクト
2. Git リポジトリを接続
3. **ビルド設定**:
   - Framework preset: `Astro`
   - Build command: `npm run build`
   - Build output: `dist`
   - Node.js version: `22` (環境変数 `NODE_VERSION=22`)
   - 環境変数: `NOTION_TOKEN` を設定 (Notion同期用)
4. デプロイ → カスタムドメインで qryptraveller.com を接続

## コンテンツ更新フロー

1. Notion で記事を編集 / 追加 / Status変更
2. ローカルで `npm run sync` (または GitHub Actions で自動)
3. `git commit` & `git push`
4. Cloudflare Pages が自動ビルド & デプロイ

## ライセンス

記事コンテンツ: © Cryptraveler (All rights reserved)
コード: MIT
