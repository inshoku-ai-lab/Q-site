# 起床後の最初の30分のためのガイド 🌅

Astro サイトのスケルトンが完成しました。ローカルでプレビューしてみましょう。

## 1. このリポジトリを取得 (まだなら)

GitHub のプッシュ権限がない場合、私が作業したファイルを取得する方法:

### オプション A: GitHub の権限を直したあと clone
権限解決後、ローカルマシンで:
```bash
git clone https://github.com/inshoku-ai-lab/Q-site.git
cd Q-site
git checkout claude/dazzling-planck-Zvs6U
```

### オプション B: 私がZIPで送ったものを使う
(別途送ります。`Q-site.zip` を展開して使ってください。)

## 2. 依存パッケージのインストール

```bash
cd Q-site                    # リポジトリのルート
npm install                  # ← 約30秒〜1分
```

## 3. コンテンツデータの準備

2つの方法があります。**まずは A (オフライン) から始めるのが簡単です**。

### A. ローカルMDから生成 (Notion不要)
```bash
npm run build:from-md
```
→ `src/data/posts.json` が作られます (777記事)。

### B. Notionから同期 (本番更新時)
```bash
export NOTION_TOKEN='secret_xxx...'  # 移行で使ったトークン
npm run sync
```
→ Notionの最新内容で `posts.json` が更新されます。

## 4. 画像を配置

ダウンロード済みの画像 (347MB) を `public/images/wp/` に配置:

```bash
# qryp-images/images/wp/ の中身をコピー
mkdir -p public/images/wp
cp -r ~/Desktop/qryp-images/images/wp/* public/images/wp/
```

(画像なしでもサイトは動きますが、記事内画像が表示されません)

## 5. ローカルでプレビュー 🚀

```bash
npm run dev
```

→ ターミナルに表示される `http://localhost:4321/` をブラウザで開く

## 6. 確認するページ

| URL | 中身 |
|---|---|
| `/` | トップページ (Hero + 特集 + シリーズ + 最新) |
| `/about/` | 自己紹介 |
| `/series/` | シリーズ一覧 |
| `/series/放浪記/` | 放浪記の全目次 (連載番号順) |
| `/category/放浪記/` | カテゴリ別 |
| `/tag/トランプ/` | タグ別 |
| `/archive/` | 年別アーカイブ |
| `/posts/a-story-of-more-than-20-years-of-wandering-around-the-world/` | 放浪記0話 |

## 7. 何を確認すべきか

✓ 全体の雰囲気・配色 (和紙オフホワイト + 苔緑 + 土色)
✓ タイポグラフィ (見出しが明朝、本文がゴシック)
✓ 記事ページの読みやすさ
✓ シリーズの目次表示
✓ 前話/次話のナビゲーション

## 8. 気に入らない部分の伝え方

私に以下のように伝えてもらえれば修正できます:

- 「ヒーローのコピーをこう変えて」
- 「色をもう少し○○に」
- 「フォントを変更したい」
- 「このページのレイアウトを△△に」
- 「画像が大きすぎる/小さすぎる」

---

## ✨ 完成しているもの

| 項目 | 状況 |
|---|---|
| Astro プロジェクト初期化 | ✅ |
| Tailwind + カスタム配色 (自然色) | ✅ |
| Noto Serif JP + Noto Sans JP | ✅ |
| ベースレイアウト (Header/Footer) | ✅ |
| トップページ (Hero + Featured + Series + Latest) | ✅ |
| 記事ページ (Markdown→HTML レンダリング) | ✅ |
| シリーズ目次 (連載番号順) | ✅ |
| カテゴリ別ページ | ✅ |
| タグページ | ✅ |
| 年別アーカイブ | ✅ |
| About ページ (自動生成) | ✅ |
| 404 ページ | ✅ |
| RSS フィード | ✅ |
| サイトマップ (sitemap-index.xml) | ✅ |
| 旧WordPress URL リダイレクト (自動生成) | ✅ |
| Notion同期スクリプト | ✅ |
| オフラインMD→JSON ビルドスクリプト | ✅ |
| 813 ページのビルドが成功 | ✅ |

## 📌 未着手 (次のステップ)

- [ ] あなたが画像を `public/images/wp/` に配置
- [ ] あなたがローカルでプレビュー
- [ ] フィードバック → 私が微調整
- [ ] Cloudflare Pages にデプロイ (GitHub接続後)
- [ ] カスタムドメイン (qryptraveller.com) を接続
- [ ] 旧サイト停止 (任意のタイミングで)

## 🎯 デザインの設計判断 (覚えておくと修正が楽)

- **配色**: `tailwind.config.mjs` の `colors` セクション
- **本文タイポグラフィ**: `src/styles/global.css` の `.prose-article` クラス
- **見出しタイポグラフィ**: 同 `h1, h2, h3` 定義
- **ヒーローの文言**: `src/pages/index.astro` の最上部 `<h1>`
- **自己紹介**: `src/pages/about.astro`

## 📋 Notion DB のステータスについて

現在、Notionで`Status` が:
- `Published` → サイトに表示される
- `Review` → サイトに表示される (要確認だがとりあえず公開)
- `Draft` → サイトには出ない (隠し)
- `Discard` → サイトには出ない

なので、Notion で気軽に Status を変えると、次の `npm run sync` で反映されます。

---

それでは、起きたらまずローカルで `npm run dev` してみてください。
わからない箇所があれば、いつでも聞いてください ☕️
