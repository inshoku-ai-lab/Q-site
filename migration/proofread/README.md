# 校正作業システム（全781記事の誤字脱字チェック）

## タスク
qryptraveller.com 移行記事（`migration/posts/*.md`）全781本を1本ずつ精読し、
誤字脱字・誤変換・明らかにおかしな日本語を修正する。

## 進め方（ユーザー合意済みルール）
1. **明確な誤字・誤変換・脱字・衍字** → 即修正（`corrections.jsonl`へ記録して適用）
2. **直し方が一意でない／判断に迷うもの** → `uncertain.md` に**推奨付きで記録して先へ進む**（都度質問しない）
3. **全体方針が要る表記ゆれ** → `global_usage.md` に推奨付きで記録
4. **意図的表現は保持**: `。。`/`、、`（余韻）、`ﾀﾋ亡`/`枠`（SNS伏字）、`！！！`、ら抜き・さ入れ言葉、`有る/出来る/漢`、`天ぷらさん`（人物の隠語）等
5. 全自走作業が終わったら**1本の報告書**にまとめてユーザーに提示。ユーザーが一括指示。

## 再開方法
`progress.json` の `next_index` 行目から `file_order.txt` の順に再開。

## ファイル
- `file_order.txt` … 精読順（日付＋名前順）。781行。
- `progress.json` … `next_index`（再開位置）, `auto_fixed_total`（修正数）。
- `corrections.jsonl` … 適用した全修正の正本（1行1修正、`{file,old,new,reason,type,all?}`）。
- `applied_md.json` … 適用済みキー（冪等管理）。
- `uncertain.md` … 要判断項目（U-番号、推奨付き）。
- `global_usage.md` … 全体方針が要る表記ゆれ（G-番号、推奨付き）。
- `technical_notes.md` … 校正外の構造問題（会員ショートコード193記事、blogcard 231記事 等）。

## スクリプト
- `scripts/dump_bodies.py <start> <count>` … 本文だけ抽出表示（精読用）。
- `scripts/add_corrections.py <batch.json>` … バッチ(JSON配列)を corrections.jsonl に追記。
- `scripts/08_apply_md.py [--dry-run]` … corrections.jsonl をMDへ適用（冪等）。`"all":true`で複数箇所一括。

## 反映先について
修正は `migration/posts/*.md`（build:from-md の元）に適用。
Notion CMS へは別途 corrections.jsonl を元に反映スクリプトを用意予定（durable化）。
