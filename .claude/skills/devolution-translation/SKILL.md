---
name: devolution-translation
description: >-
  Patel Patriot の「Devolution（デヴォリューション理論）」シリーズ（patelpatriot.substack.com）の
  新規記事を日本語へ翻訳し、Q-site の既存シリーズ体裁に合わせて下書きを作るためのワークフロー。
  「デボリューション Part N を翻訳して」「デヴォリューション理論の続きを翻訳」等のときに使用する。
  原文の verbatim 取得、画像内テキストのOCR和訳、サブパート分割、要点まとめ付きの
  Part 体裁での出力までを規定する。
---

# Devolution 翻訳ワークフロー

Patel Patriot（Jon Herold）の Substack 連載 **Devolution** を日本語訳し、Q-site の
`migration/posts/` にある既存「デボリューション理論」記事と同じ体裁で下書きを作る。

このスキルは Part 14 の翻訳で確立した手順を固定化したもの。**手順を飛ばさないこと**。
特に「原文の取得方法」と「冒頭の要点まとめ」は過去に間違えた箇所なので厳守する。

---

## 0. 前提・環境

- **作業ブランチ**で開発・コミットする（タスク指定のブランチ）。push 不可なら理由を報告し、
  コミットはローカルに積んでおく。
- **egress（重要）**: 画像は `substackcdn.com`（**apex／裸ドメイン**）から配信される。
  環境のネットワーク許可リストに `*.substackcdn.com` だけでなく **`substackcdn.com` 本体**が
  必要。`*.` ワイルドカードは apex を含まないため、apex が無いと画像取得が 403 になる。
  - 確認: `curl -sS "$HTTPS_PROXY/__agentproxy/status"` で `connect_rejected` を見る。
  - 403 が出たらユーザーに「許可リストに `substackcdn.com`（先頭に `*.` を付けない形）を
    追加」を依頼する。S3 実体（`bucketeer-*.s3.amazonaws.com`）は署名必須で直アクセス不可。
- **bs4 が必要**: 無ければ `pip install beautifulsoup4 -q`。

---

## 1. 原文の取得（verbatim）

⚠️ **WebFetch は小型モデルによる要約を返すので原文ソースには使わない。** egress 疎通確認だけなら可。

サーバーレンダリングされた生 HTML を取得し、本文 `div.body markup` を抽出する。

```bash
PART=14   # 対象パート番号
URL="https://patelpatriot.substack.com/p/devolution-part-${PART}"
SC=/tmp/.../scratchpad      # スクラッチパッド
curl -sS -L "$URL" -o "$SC/part${PART}.html"
pip install beautifulsoup4 -q 2>/dev/null
python3 .claude/skills/devolution-translation/scripts/extract_body.py \
    "$SC/part${PART}.html" "migration/source/devolution/part-${PART}.md"
```

- 出力 `migration/source/devolution/part-${PART}.md` に frontmatter（title/author/
  source_url/published）＋本文 Markdown（見出し・段落・引用・画像・リンク保持）が入る。
- スクリプトは語数・画像数・末尾を表示する。**末尾まで取得できているか**（例: "THE BEST
  IS YET TO COME!" 等の結びがあるか）を必ず確認する。
- URL スラッグが既定形（`devolution-part-N`）でない回もある。404 ならアーカイブの
  目次や `devolution.link` からスラッグを確認する。

---

## 2. サブパート分割の設計（承認待ち）

- 1サブパートは**意味が通る単位で平均おおよそ 1,000〜2,000 文字**を目安に区切る。
  記事の長さで分割数は変わる（Part 14 は約6,700語で **4分割**だった）。
- 原文の `##`（H2）/`####`（H3〜）見出し構造を骨格に、意味的なまとまりで割る。
- **分割案（何分割／各サブパートの範囲）をユーザーに提示し、承認を得てから本翻訳に入る。**
- 承認後、まず **1/N の試作1本**を作って品質確認を仰ぐ。OK が出てから残りを進める。

---

## 3. 画像内テキストの和訳（OCR）

既存シリーズは、記事中のスクリーンショット画像に写る英文を**和訳して引用ブロック化**している。
これを踏襲する（＝画像を貼るだけにしない）。

```bash
# 対象サブパートの行範囲の画像をまとめて取得
bash .claude/skills/devolution-translation/scripts/fetch_images.sh \
    migration/source/devolution/part-${PART}.md <開始行> <終了行> "$SC/img"
```

- ダウンロードした各画像を **Read ツールで視覚的に開いて**英文を読み取り、日本語に訳す。
- 訳文は画像 Markdown の**直後に引用ブロック（`>`）**で置く。複数段落は `>` 空行で区切る。
- **人物写真など文字の無い画像**は引用を付けず、必要なら `（写真：…）`の一行説明のみ。
- 図表キャプションも本文同様に訳す（`（写真キャプション）…` 等）。

---

## 4. 出力体裁（Part 物フォーマット）★ 最重要

番号付き Part は、入門編スタイル（`（翻訳ここから）`）ではなく、**要点まとめ＋見出し区切り**の
Part 体裁で書く。テンプレートは `reference/part-template.md` を参照。骨格は：

```
---
（frontmatter: title「パートN　x/y 　デボリューション理論」, categories:「デボリューション理論の記事集」,
  tags, excerpt 2文 など。id/date は公開時採番のため空でよい）
---

## 今回の要点とまとめ

**・要点1**        ← 太字・箇条書き、概ね 4〜7 項目

**・要点2**
…

（2〜3文の短いまとめ段落）

## ここからがオリジナルの記事の翻訳になります

### 小見出し
本文・画像・引用ブロック…
```

- 「今回の要点とまとめ」は**そのサブパートの内容**を要約する（記事全体ではない）。過去に
  ここを欠いて差し戻された。**絶対に入れる。**
- 用語・トーンは `reference/glossary.md` に従う（です・ます調、`デヴォリューション`、
  `政治的支配層`、`権限委譲（デヴォリューション）` など既存訳に統一）。
- 末尾は次サブパートへの短い繋ぎを入れる。

下書き保存先: `migration/source/devolution/part-${PART}-<n>.ja-draft.md`（例 `part-14-1.ja-draft.md`）。
最終的な公開先（`migration/posts/` への配置・id/slug/date 採番）はユーザーと相談して決める。

---

## 5. コミット

- 段階ごとに意味のある単位でコミット（原文取得／散文訳／画像和訳／体裁整形 など）。
- author/committer は `noreply@anthropic.com`。
- push 不可（403）のときは原因（ブランチ書き込み権限・署名）を報告し、ローカルに積む。

---

## 6. Notion への保存（サブパート完成のたびに自動で行う）

翻訳（1サブパート分）が完成するたびに、確認を挟まず Notion にも保存する。

- 保存先データソース: **Blog Articles**（`collection://e4a8e303-8167-4425-82f4-65ea7cae4699`）。
  既存デボリューション記事もすべてここに入っている（`notion-search` で
  `"パートN　x/y　デボリューション理論"` を検索すれば実例を確認できる）。
- `notion-create-pages` の `parent` は `{"type": "data_source_id", "data_source_id": "e4a8e303-8167-4425-82f4-65ea7cae4699"}`。
- プロパティ（既存 Part と同じ形式に揃える）:
  - `title`: `"パートN　x/y 　デボリューション理論"`（全角数字、既存表記に合わせる）
  - `Series`: `"デボリューション理論"` ／ `Category`: `"思想・理論"`
  - `Episode #`: N（数値） ／ `Sub Episode`: `"x/y"`（半角）
  - `Slug`: 見込みスラッグ（例 `devolution-part-14-3-4`）
  - `Excerpt`: 「今回の要点とまとめ」末尾の2〜3文まとめ段落を `<br><br>` でつないだもの
  - `Tags`: 既存の select 選択肢からのみ選ぶ（スキーマ外の値は使えない）。
    基本セット `["クーデター","トランプ","不正選挙","情報戦争","戦争"]` に
    内容に応じて `"ディープステート"` 等を追加する程度でよい。
  - `Status`: WordPress 未公開の間は `"Draft"`。公開後にユーザー側で `"Published"` に更新する。
  - `Featured`: `"__NO__"`
  - `Char Count` ／ `Image Count` ／ `Reading Time`: 本文から概算（画像・リンクURLを除いた
    プレーンテキスト文字数 ÷ 500 が Reading Time の目安）。
  - `Notes`: 原文URLと `migration/source/devolution/` 側のファイルパスを一言メモ。
- 本文（content）は Notion-flavored Markdown で渡す。**通常の Markdown と異なる点に注意**:
  - 複数段落にまたがる引用は、`>` を段落ごとに繰り返さず、**1つの `>` 行の中で
    `<br><br>` を使って段落をつなぐ**（`notion://docs/enhanced-markdown-spec` 参照。
    `ReadMcpResourceTool` で読める）。空行だけの `>` を挟む書き方は空の引用ブロックに
    なるので使わない。
  - 引用内の箇条書き（所属リストやメンバー一覧など）も、`- item` ではなく
    `・item<br>・item…` のように `<br>` でつないで同じ引用ブロック内に収める。
  - 画像は `![](画像URL)` のままでよい。
  - 見出し `##`／`###`／`####`、太字 `**`、リンク `[text](url)` は通常どおり。
- frontmatter やコメント行（`id/date/status/# 制作メモ` など）は Notion の properties 側に
  吸収されるので、content には含めない（タイトルも properties の `title` のみでよく、
  本文冒頭に重ねて書かない）。
- 保存が終わったら、返ってきたページ URL をユーザーに一言報告する。承認待ちのために
  止まる必要はない（ユーザーが「保存するたびに自動で」と明示している場合）。

---

## チェックリスト（提出前）

- [ ] 原文を verbatim 取得し末尾まで揃っている（WebFetch 要約を使っていない）
- [ ] 分割案をユーザー承認済み／1本目は試作で確認
- [ ] サブパート冒頭に「今回の要点とまとめ」がある
- [ ] 「ここからがオリジナルの記事の翻訳になります」見出しがある
- [ ] 画像内英文をすべて和訳引用化（写真は説明のみ）
- [ ] 用語・トーンが glossary 準拠
- [ ] frontmatter が既存 Part 形式
