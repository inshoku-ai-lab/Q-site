# 出力仕様

## 1. 作業ファイル（リポジトリ＝翻訳作業の正本）

`migration/posts-en/<NNN>-<slug>.md`

```yaml
---
episode: 103
lang: "en"
series: "The Vagabond Chronicles"
series_ja: "放浪記"
arc: "Finding Goa"
arc_part: 6
title: "The Vagabond Chronicles #103 — Finding Goa, Part 6"
slug: "finding-goa-6-vagabond-chronicles-103"
source_slug: "the-story-of-meeting-gore-6-autobiography-103"
source_notion_id: "3705b569-690c-81f6-98d5-e5cbf6e78013"
date: "2022-03-07 17:39:00"
status: "draft"
tags:
  - "旅行"
excerpt: "A room for a dollar a night, a Wednesday flea market on Anjuna beach, and a rave he and his friend get so far ahead of that they drop the acid before leaving the house — then spend an hour lost, chasing a bassline they cannot tell from their own engine."
member_paywall_after_paragraph: 21
qa:
  blind_review_rounds: 2
  blind_review_p1_remaining: 0
  mechanical_qa: "pass"
---
```

**リポジトリを正本にする理由**：git で差分・履歴・レビューができ、機械QAが効く。
Notion は公開先であり、人間承認後に転記する。

## 2. Notion（公開先）

日本語ページは**一切変更しない**。英語版は常に新規ページ。

| プロパティ | 英語版の値 |
|---|---|
| `Lang`（新設 select: JA/EN） | `EN` |
| `Title` | `The Vagabond Chronicles #103 — Finding Goa, Part 6` |
| `Slug` | `finding-goa-6-vagabond-chronicles-103` |
| `Episode #` | 日本語版と同じ番号（103） |
| `Series` | `放浪記`（話数順の並びを保つため。表示名の英訳はサイト側） |
| `Category` | `放浪記` |
| `Tags` | **既存の日本語タグ値をそのまま流用**。新しい英語選択肢を作らない |
| `Excerpt` | 英語。30〜50語 |
| `Date` | 日本語版と同じ |
| `Status` | 承認まで `Draft`、承認後 `Published` |
| `WP ID` / `WP URL` | 空 |
| `Notes` | QA結果（査読ラウンド数・残P1件数） |

### タグの表示用対応表（サイト側で使う）

DBには日本語タグを入れたまま、表示層で英語に変換する。

| Notion値 | 英語表示 |
|---|---|
| 放浪 | Wandering |
| 旅行 | Travel |
| 自伝 | Memoir |
| ヒッピー | Hippie |
| 日本 | Japan |
| エホバの証人 | Jehovah's Witnesses |
| 幼少期 | Childhood |
| 毒親 | Toxic Parents |
| 貧困 | Poverty |
| 私小説 | Autofiction |
| 地球放浪 | Around the World |
| スピリチュアル | Spirituality |
| 心理学 | Psychology |
| 人間関係 | Relationships |
| トラウマ | Trauma |
| 家族 | Family |
| セクシュアリティ | Sexuality |
| 感情 | Emotions |
| 自己成長 | Personal Growth |
| 価値観 | Values |

新しいタグが必要になったらこの表に追記する。**Notion側に英語選択肢を増やさない。**

## 3. 会員限定マーカー

日本語版：
```
<callout icon="🔒">ここから会員限定</callout>
（以下内容転載禁止、法的対処有。）
```

英語版（**同じ段落位置に置く**）：
```
<callout icon="🔒">Members only from here</callout>
(Reproduction of the content below is prohibited. Legal action will be taken.)
```

- 位置がずれると**有料コンテンツが無料で露出する**。機械QAで必ず検証する。
- フロントマターの `member_paywall_after_paragraph` に、マーカー直前の段落番号を記録する。
  原文の同じ番号と一致していなければQAが落ちる。
- マーカーの無い記事では `member_paywall_after_paragraph: null`。

## 4. タイトルとスラッグ

- **タイトル**：`The Vagabond Chronicles #<Ep> — <アーク英題>, Part <話数>`
  - アーク英題は `arc-map.md` で固定。勝手に変えない。
  - `#` の数字はゼロ埋めしない（`#103`、`#3` ではなく `#003` にしない）。
  - Ep 0 のような単発回は `The Vagabond Chronicles #0 — Twenty Years on the Road`（Part なし）。
- **スラッグ**：`<英語タイトルのkebab>-vagabond-chronicles-<NNN>`（NNNは3桁ゼロ埋め）
  - 日本語版スラッグと**衝突させない**。
  - 英語版サイトが別ルート・別デプロイのどちらになっても安全なようにしておく。

## 5. Excerpt の書き方

**489本は日本語版も空**なので、英語版は新規に書く。

- 30〜50語。
- 固有名詞と具体的な場面を入れる。あらすじ要約ではなく「読みたくなる引き」。
- ネタバレになるオチは書かない。
- 感嘆符を使わない。

```
✓ A room for a dollar a night, a Wednesday flea market on Anjuna beach, and a
  rave he and his friend get so far ahead of that they drop the acid before
  leaving the house.
✗ In this episode, the author describes his experiences in Goa, India, where
  he found cheap accommodation and attended a party.
```

## 6. 本文に入れないもの

- 前後記事へのナビゲーションリンク（サイト側が生成する）
- 訳注ブロック・脚注
- 翻訳者による前書き・後書き
- 原文にない見出しの追加
