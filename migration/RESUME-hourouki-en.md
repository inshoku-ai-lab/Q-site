# 放浪記 英訳プロジェクト — 引き継ぎメモ

セッションをまたいで作業するため、**新しいセッションを開いたら最初にこれを読む**。
最終更新: 2026-09-05（著者の指示によりトークン都合で一時停止した時点）

---

## 0. 再開する人へ — 最初の3コマンド

```bash
cd /home/user/Q-site
python3 .claude/skills/hourouki-translation/scripts/build_args.py --status   # 進捗
python3 .claude/skills/hourouki-translation/scripts/qa_check.py \
    --ja-src-dir <scratchpad>/ja-src --source-dir migration/posts migration/posts-en/*.md
```

**手順の本体は `.claude/skills/hourouki-translation/reference/production-runbook.md`。**
バッチサイズ40話、ワークフロー利用は著者から恒久許可済み、途中報告は不要。

⚠️ **原文（`<scratchpad>/ja-src/ep-NNN.md`）はセッション終了で消える。**
リポジトリではなく一時領域にあるため、再開時は取得し直しになる。
`build_args.py` が未取得を検出して Notion ID の表を出すので、それに従って取得する。

---

## 1. 今どこまで進んでいるか

| 項目 | 状態 |
|---|---|
| 翻訳スキル | `.claude/skills/hourouki-translation/` に構築済み |
| ボイスバイブル | **確定版**（アンカー5本すべて通過済み） |
| 用語表・査読プロトコルv2 | 確定 |
| 話数インデックス | `migration/reports/episode-index.json`（全522話・Notion ID入り） |
| 画像の説明文 | `migration/reports/image-alt.json`（ファイル名→英語alt） |
| 訳了 | **Ep 0〜79 の86本**（バッチ3完了時点） |
| 残り | 436本 |

英訳は `migration/posts-en/` に `status: "draft"` で置いてある。
**まだ1本もNotionへ転記していない。** 英語版サイトもまだ無い。

日本語記事は**一切変更しない**。英語は別サイト（英語版）に置く。

### ⚠️ バッチ3（Ep 40〜79）は全滅した — 再開時にまずここを読む

**39話すべてが失敗し、1本も生成されていない。** 約1,200万トークンを消費してゼロ。

原因は翻訳の品質ではなく、**ハーネス側のパーミッション不具合**。ワークフロー内の
エージェントのツール呼び出しが実行前に全て弾かれ、原文ファイルを読めなかった：

```
The permission handler returned updatedInput for <Tool> that failed schema validation:
The parameter `<param>` type is expected as `string` but provided as `unknown`
```

Read / Bash / Glob / Grep の4ツールすべてで再現。結果、
- 23話 … エージェントがエラー報告を返した（**捏造を拒んだ正しい挙動**）
- 16話 … reconcile が区切り記号を返せず、本文が数文字のゴミになった

**エージェントを責めるところは無い。** 原文が読めない状態で記事を書けば全文捏造になる、
と判断して書かなかったのは、この4パス構成が守らせたい一番大事な挙動そのもの。

#### 再開時の手順

1. **まず1話だけで試す。** いきなり40話流さない。
   ```bash
   python3 .claude/skills/hourouki-translation/scripts/build_args.py --eps 40
   ```
   でargsを作り、ワークフローを1話で起動して、本文が実際に生成されるか確認する。
2. 通れば不具合は解消している。通常どおり40話バッチへ戻す。
3. **同じパーミッション不具合が再発する場合**、原文をファイル経由で読ませる設計が
   使えない。その場合の回避策は、原文テキストを args に直接載せる旧方式に戻すこと。
   ただし**手打ち転記は絶対にしない**（Ep 103 のペイウォール脱落の原因）。
   `build_args.py` を拡張して、原文ファイルの中身を読み込んで
   `body` フィールドに機械的に詰める形にする。

> バッチ1（42エージェント）とバッチ2（210エージェント）は同じ設計で完走している。
> 設計の欠陥ではなく、環境側の一過性の不具合である可能性が高い。

### 停止時点で分かっていること

- 機械QAは全本 **ERROR 0**。
- 会員限定マーカーのある話が多数（Ep 39以降で急増、Ep 100〜119はほぼ全話）。
  **位置がずれると有料記事が無料で出る。** QAが割合で照合する。
- 原文側の不具合は `migration/reports/source-issues-ja.md` に集約。著者へ要報告。

---

## 2. 次のセッションで最初にやること

### 2-1. NOTION_TOKEN の疎通確認

```bash
curl -sS -H "Notion-Version: 2022-06-28" \
     -H "Authorization: Bearer $NOTION_TOKEN" \
     https://api.notion.com/v1/users/me
```

- **200 が返る** → 2-2へ進む
- **401 `API token is invalid`** → トークンが失効している。
  ユーザーに再発行を依頼する（権限不足なら404になるので、401は失効/削除を意味する）
- **403 `host_not_allowed`** → 環境のネットワーク許可ドメインに `api.notion.com` が無い

> 2026-09-05 時点の状況: ネットワーク許可は設定済みで疎通OK。
> トークンは `ntn_2451...` が 401 のまま。ユーザーが新トークンを環境変数に設定したが、
> **環境変数は新セッションからしか反映されない**ため未検証。まずここを確認すること。

### 2-2. 日本語記事から前後記事リンクを削除（未実施）

ユーザーが明示的に依頼した作業。「続き、、、」の記事リンクも対象。

```bash
node scripts/strip-nav-links.mjs --survey   # 読み取りのみ。まずこれ
node scripts/strip-nav-links.mjs --apply    # 実行。全ブロックをバックアップしてから消す
```

- バックアップ先: `migration/reports/nav-link-backup.json`
- 判定ロジックは `scripts/lib/nav-links.mjs`。779本の実データで検証済み
  （ナビ335行を検出、本文17行は無傷、誤検出ゼロ）
- 回帰テスト: `node scripts/test-nav-links.mjs`（31アサーション）

**これは翻訳のブロッカーではない。** 翻訳パイプライン側が自前でナビを除去するため、
英語版には最初から入らない。日本語サイト側の掃除が残っているだけ。

---

## 3. 量産の回し方

ワークフロー本体（リポジトリ外・セッション固有）:

```
~/.claude/projects/-home-user-Q-site/<session>/workflows/scripts/
  hourouki-episode-pipeline-*.js
```

新しいセッションではこのパスが変わる。無ければスキルの記述から作り直す。

### 手順

1. **原文をNotionからディスクへ取得**（サブエージェントに任せる）
   保存先 `<scratchpad>/ja-src/ep-NNN.md`。`<content>` タグの中身をそのまま書く。
2. **機械照合する** — 取得したJA文字数を `migration/posts/` のエクスポートと突き合わせる。
   一致しない箇所は必ず目視で原因を特定してから進む。
3. **ワークフロー起動** — `args.episodes[]` は
   `{ep, arcTitleEn, arcPart, arcTotal, sourcePath, contextNote}`。
   **原文テキストはargsに入れない**（理由は§4参照）
4. **結果を `migration/posts-en/` へ書く**
5. **機械QA** — `python3 .claude/skills/hourouki-translation/scripts/qa_check.py`
6. **日本語の検証レポート**を `migration/reports/VERIFICATION-REPORT-ja.md` へ追記

アークは `reference/arc-map.md` を見る。**アークをまたいで話を分断しない。**

---

## 4. 過去に踏んだ地雷（同じ穴に落ちないこと）

1. **原文の手打ち転記は禁止。**
   Ep 103 でペイウォール表示が丸ごと消えた。原因は私が原文をargsに書き写したときの脱落。
   → 現在はエージェントが `sourcePath` のファイルを Read する方式。この工程を復活させない。

2. **`resumeFromRunId` は使わない。**
   argsが文字列化されて渡り、`args.episodes` が undefined になる。新規実行の方が安全。

3. **StructuredOutput schema に本文を入れない。**
   長い記事をJSON文字列フィールドに押し込むと5回リトライしても失敗する。
   → `===BODY===` 等の区切り記号 + プレーンテキストで受ける。

4. **査読者は「英語として不自然か」には強く、「内容が正しいか」には無力。**
   混成パネル3人が2ラウンド連続で全員一致して「JとI-chanは同一人物だから統一しろ」と
   指摘したが、**2回とも誤り**。査読者はシリーズ文脈を持たない。
   人物に関する指摘は必ず `reference/glossary.md` と照合してから採否を決める。

5. **査読者の要求で原文にない文言が入りうる。**
   逆翻訳が「今まで見たこともない大金」という捏造を検出した。原文のどこにも無かった。
   → ④-b 捏造ゲートを必ず通す。

6. **原文側の欠陥は黙って直さない。** 著者にエスカレーションする（Ep 360 の見出しの例）。

7. **画像は黙って消える。** Ep 2・3・6・17 で計6枚が脱落していたのに、
   4本とも機械QAを「合格」で通過していた。QAが画像を見ていなかったため。
   → 現在は `qa_check.py` が枚数・順序・ファイル名を原文と突き合わせる（ERROR）。
   **新しいチェックを足したら、必ず既訳の全ファイルに遡って走らせること。**
   この6枚は、新しいチェックを過去分にかけて初めて見つかった。

8. **翻訳エージェントに画像の説明文を書かせない。** 画像を見ていないので捏造する。
   実際に `Blog7-1` というファイル名の流用が混入した。画像を読む専用パスで後から埋める。

---

## 4-2. 著者が決めた方針（2026-09-05）

| 項目 | 決定 |
|---|---|
| 画像のURL | `/images/wp/...`（リポジトリ内）。`https://qryptraveller.com/...` は使わない |
| 画像の代替テキスト | **英語で必ず付ける。** 実際に画像ファイルを見てから書く |

詳細は `reference/output-spec.md` §7。

---

## 5. 役割分担（ユーザーとの合意）

| 担当 | 内容 |
|---|---|
| Claude | **英語として自然かどうかの判断を全面的に負う。** ユーザーはここを判断できない |
| ユーザー | **日本語の逆翻訳を読んで意味のズレを検証する** |

したがって、ユーザーへの成果報告は**必ず日本語で検証可能な形**にする。
英文を見せて「自然ですか？」と聞いてはいけない。

読者は**世界中の英語話者**。メートル法と帝国単位を併記する（初出のみ、メートル法が先）。
