# Q-site (Qryptraveller's Notes)

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
│   │   ├── category/[name]/[...page].astro  # カテゴリ別 (24件ごとにページ送り)
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

## セキュリティ設計と運用チェックリスト

コード側の防御はリポジトリ内で完結していますが、**コードからは検証できない設定が3つ**あります。
デプロイ環境を触るときは、まずここを確認してください。

### 1. Supabase の RLS (最重要・要手動確認)

ブラウザには anon (publishable) キーが渡ります。したがって
`members` / `contact_messages` / `admin_allowlist` / `member_stats_archive` / `admin_access_log`
の各テーブルで **RLS が有効で、かつ適切なポリシーが設定されていること**が、
会員のメールアドレスが外部から読まれないための最後の砦です。

- `members`: 本人の行のみ `select` 可 (`auth.uid() = auth_user_id`)。`insert` は本人分のみ。
- `contact_messages` / `admin_access_log` / `member_stats_archive` / `admin_allowlist`:
  anon・authenticated からのポリシーを一切与えない (service role 専用)。

サイト側は管理系の読み書きをすべて service role クライアント経由で行うため、
上記を締めてもアプリの機能は落ちません。

### 2. Turnstile

`PUBLIC_TURNSTILE_SITE_KEY` を設定した場合、`TURNSTILE_SECRET_KEY` も**必ず**設定してください。
サイトキーだけが設定されている状態は、サーバー側で検証不能な誤設定として
お問い合わせ送信が拒否されます (`src/pages/api/contact.ts`)。
両方とも未設定の場合のみ、Turnstile 検証をスキップします。

### 3. セキュリティヘッダーの配信経路

Vercel アダプタは `.vercel/output/config.json` を自前で生成するため、
**`vercel.json` の `headers` は無視されます**。そのため以下の二段構えです。

| 対象 | 経路 | 内容 |
|---|---|---|
| 全ページ (静的含む) | `Layout.astro` の `<meta http-equiv>` | CSP |
| SSR (`/admin/*`, `/account`, `/api/*`) | `src/middleware.ts` | CSP + `frame-ancestors` + `X-Frame-Options` ほか |

CSP の定義は `src/lib/csp.ts` に集約されています。`connect-src` は
`PUBLIC_SUPABASE_URL` からビルド時に自動導出するので、Supabase をカスタムドメインに
移しても壊れません。**外部スクリプト・外部フォントを新たに追加する場合は
`src/lib/csp.ts` の更新が必要**です。

### 実装済みの防御 (参考)

- 会員限定本文は静的HTMLに含めず、認証済みリクエストにのみ API から配信
- OAuth コールバックのリダイレクト先は同一サイトの相対パスのみ許可 (`safeRedirectPath`)
- 状態変更API は Origin/Referer 検証 + `Content-Type: application/json` 必須 (CSRF対策)
- クライアントIPは `x-vercel-forwarded-for` / `x-real-ip` から取得 (偽装不可)
- お問い合わせ・バグ報告ともに IP 単位のレート制限あり
- CSV エクスポートは数式インジェクション対策済み
- 移行コンテンツ由来の `javascript:` 等のURLスキームは描画時に無害化

## 既知の運用判断事項

- **`Status = "Review"` の記事も公開されます** (`src/lib/posts.ts` の `getPublishedPosts`)。
  校正中の記事を公開したくない場合は `"Published"` のみに絞ってください。
  該当記事数によっては公開範囲が大きく変わるため、意図的に現状維持としています。

## ライセンス

記事コンテンツ: © Qryptraveller (All rights reserved)
コード: MIT
