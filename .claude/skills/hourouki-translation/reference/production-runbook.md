# 量産ランブック — 1バッチの回し方

**著者の指示（2026-09-05）: バッチサイズは6話で固定。上げない。**
著者が並行して別作業をしており、大きなバッチはそれとぶつかる。

**途中報告はしない。** 全話が終わるまで黙って回し続ける。セッションが尽きたら、
次のセッションがこのランブックを読んで同じ手順を継続する。

進捗確認:

```bash
python3 .claude/skills/hourouki-translation/scripts/build_args.py --status
```

---

## 1サイクル（6話）の手順

### ① 次の6話の args を作る

```bash
python3 .claude/skills/hourouki-translation/scripts/build_args.py --next 6
```

原文が未取得なら、取得すべき Notion ID の表が出る。その場合は②へ。
args の JSON が出たら③へ。

### ② 原文を Notion から取得（未取得のときだけ）

サブエージェントに投げる。**自分の文脈に原文を入れない**（手打ち転記を復活させない）。

保存先は `<scratchpad>/ja-src/ep-<NNN>.md`。`<content>` タグの中身を**逐語で**書く。
見出し・画像行・`つづく。。。`・末尾のナビ行を含め、**何も削らない**。

取得後、機械照合する:

```bash
# 日本語文字数を migration/posts/ のエクスポートと突き合わせる
# 一致しない箇所は必ず原因を特定してから先に進む（画像のaltや誤字の差は既知）
```

そのうえで①をやり直す。

### ③ Workflow を起動

`scriptPath` は `~/.claude/projects/-home-user-Q-site/<session>/workflows/scripts/hourouki-episode-pipeline-*.js`。
セッションが変わるとパスも変わる。無ければスキルの記述から作り直す。

args は①の出力をそのまま貼る。1バッチ42エージェント、所要およそ40分。

### ④ 英語ファイルを書き出す

```bash
python3 .claude/skills/hourouki-translation/scripts/write_en.py /tmp/.../<task-id>.output
```

**「要確認」が出たら必ず読む。** 画像の脱落と段落数の不一致をここで報告する。

### ⑤ 画像の代替テキスト

```bash
python3 .claude/skills/hourouki-translation/scripts/alt_text.py --missing
```

未登録があれば、**画像ファイルを実際に Read するサブエージェント**に
`migration/reports/image-alt.json` へ追記させる。ファイル名から推測させない。
そのうえで:

```bash
python3 .claude/skills/hourouki-translation/scripts/alt_text.py --apply
```

### ⑥ 機械QA

```bash
python3 .claude/skills/hourouki-translation/scripts/qa_check.py \
    --source-dir migration/posts migration/posts-en/*.md
```

**ERROR はゼロにしてからでないと先に進まない。**
WARN は1件ずつ原文と照合して採否を決める。既知の誤検知:

- 数字が「英単語で綴られている」だけ（`three thousand grams` など）→ 問題なし
- `somehow` が **なんとか** の訳のとき → 正しい（**なんとなく** の直訳のときだけ直す）

### ⑦ 逆翻訳を検証レポートに追記

`migration/reports/VERIFICATION-REPORT-ja.md` に、そのバッチの逆翻訳を追記する。
著者はここだけを読んで意味のズレを確認する。**英語の自然さは著者に判断させない。**

### ⑧ コミットして push

```bash
git add -A && git commit && git push -u origin claude/hourouki-translation-skill-8zl5sx
```

`mechanical_qa` を `"pending"` から `"pass"` に変えてからコミットする。

### ⑨ ①に戻る

---

## 絶対に守ること

1. **原文を手で打ち直さない。** ファイルパスで渡す。Ep 103 のペイウォール脱落の原因。
2. **新しいチェックを足したら、既訳の全ファイルに遡って走らせる。**
   画像チェックを遡って走らせて初めて、Ep 2・3・6・17 の計7枚の脱落が見つかった。
   前に「合格」と報告した記事にも欠陥は残っている前提で扱う。
3. **査読者の指摘を無条件に採用しない。** 英語の自然さには強いが、内容の正しさには無力。
   人物に関する指摘は `reference/glossary.md` と必ず照合する。
4. **原文側の欠陥は黙って直さない。** 著者にエスカレーションする。
5. **`resumeFromRunId` を使わない。** args が文字列化されて壊れる。新規実行する。
