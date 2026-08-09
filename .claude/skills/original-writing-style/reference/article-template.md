# Notionページ作成時のプロパティ雛形

本番コンテンツはNotion「Blog Articles」DB（`collection://e4a8e303-8167-4425-82f4-65ea7cae4699`）が正。
`mcp__Notion__notion-create-pages` で直接ページを作る。ローカルにmdファイルを作る必要はない
（`migration/posts/` はWP移行時の過去アーカイブであり、今後の新規記事の置き場所ではない）。

## プロパティ

```
Title: "<記事タイトル>"                # 唯一のtitleプロパティ
Category: "資産防衛"                   # 銀・資産防衛シリーズは固定。他ジャンルなら適宜変更
Series: "没収の歴史"                    # シリーズに属す場合のみ。属さない単発記事は省略可
"Episode #": <数値>                    # シリーズに属す場合のみ、通し番号
Status: "Draft"                        # 新規記事は必ずDraft。GS承認後にGS自身がPublishedへ
Slug: "<英語slug>"                     # 例: executive-order-6102-gold-confiscation-1933
Excerpt: "<150〜220字>"                 # 記事の要約。フックになる問い・具体的な数字を入れる
"SEO Description": "<任意>"            # 空でもよい
"Date": <公開予定日>                    # 未定なら空でもよい、後でGSが設定
Tags: [...]                            # reference/tag-rules.md を参照
Featured: __NO__                       # 特に指定なければNO
```

## Excerptの書き方（既存記事から）

既存記事のexcerptは「フックになる事実 + 問いかけ」の2文構成が多い：

> １９３４年８月、米国では市民の所有する全ての銀が没収された。<br><br>
> 過去に実際に起こり、未来にも起こりうる危機への完璧な対応策とは？

`<br><br>` で改行を挟む記法もこのサイトの既存記事に合わせたもの。踏襲してよい。

## 本文（content）

Notion Markdown。既存記事の実例から使ってよい記法：

- `## 見出し` — 章立て（`###`はさらに細かい小見出し、対策方法などで使用）
- `[blogcard url="https://..."]` — 外部リンクのカード表示
- `> 引用文` — 政府文書・Wikipedia等の引用
- `![](画像パス)` — 画像。サイト内の既存画像を使う場合は `/images/wp/wp-content/uploads/...` 形式
  （`public/images/wp/` 配下に実ファイルがあるか事前に確認する）
- 太字は `**text**`

## 執筆後のチェック

1. `reference/style-guide.md` の「10. やってはいけないこと」に抵触していないか読み返す
2. 段落が1〜2文単位に分かれているか（3文以上の段落があれば分割を検討）
3. Statusが `Draft` になっているか
4. 資産防衛カテゴリの記事なら、法的な断定表現がないか（MLAT・没収リスクの記述）
