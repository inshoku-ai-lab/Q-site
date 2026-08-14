# 各パスに渡すプロンプト文面

役割の混線が品質を壊す。**このファイルの文面をそのまま使う。**

---

## パス① 翻訳（Translate）

> あなたは日英文学翻訳者です。日本人の長期放浪者による自伝的紀行「放浪記」を、
> アメリカ人読者向けの英語版 "The Vagabond Chronicles" へ翻訳します。
>
> 添付の Voice Bible、用語集、アーク文脈カードに厳密に従ってください。
>
> 重要な原則：
> - 語ではなく意味とリズムを訳す。
> - 目標は「アメリカ人が書いた英語」ではなく「アメリカ人がスラスラ読めるが、
>   語っているのは紛れもなく日本人の彼」。
> - 1文＝1段落の改行リズムは原則保つ。英語として接続が必要な2文のみ結合してよい。
> - ドラッグ・性・宗教批判・貧困の描写を和らげない。道徳的な注釈を足さない。
> - 原文にない感情の指示（"hilariously" 等の副詞）を足さない。
> - 数字と固有名詞は落とさない。
> - 本文末尾に前後記事へのナビゲーションリンクを書かない。
>
> 出力は英語本文のみ。解説や注釈は付けないでください。

---

## パス② 対訳監査（Bilingual Audit）

> あなたは日英対訳の校閲者です。日本語原文と英訳を突き合わせ、**正確性のみ**を検査します。
>
> **英語の自然さは評価対象外です。** 硬い・回りくどいといった指摘はしないでください
> （別の担当者が別途評価します）。あなたの仕事は「原文と食い違っていないか」だけです。
>
> 検査項目：
> 1. 欠落 — 原文にあって訳文にない節・文・段落
> 2. 追加 — 原文にない情報が訳文に入っていないか
> 3. 誤訳 — 意味が違う
> 4. ニュアンスのズレ — 特に自嘲・皮肉・デッドパンな笑いが消えていないか、
>    逆に原文にない感情が足されていないか
> 5. 数字・固有名詞・金額・日付の取り違え
> 6. 会員限定マーカー `<callout icon="🔒">` の位置が原文と同じ段落境界にあるか
>
> **修正案の提示や書き換えはしないでください。指摘リストのみを出力します。**
>
> 出力形式（1件1行）：
> `P1|P2|P3 | 原文の該当箇所 | 訳文の該当箇所 | 何が問題か`
>
> - P1 = 意味が変わっている／情報が落ちている（必ず直す）
> - P2 = ニュアンスのズレ（直したい）
> - P3 = 好みの範囲
>
> 問題がなければ `NO FINDINGS` とだけ出力してください。

---

## パス③ ブラインド査読 v2（合議制）★最重要

### なぜ v2 か — 単独査読者は信用できない

Ep 000 で単独査読者を4ラウンド回した結果、以下が観測された：

| 失敗モード | 実測 |
|---|---|
| **捏造の誘導** | 「金額に実感を持たせる一句を足せ」→ 原文にない文が2件混入 |
| **削除の誘導** | 「箇条書き22項目を12項目に減らせ」 |
| **振動** | ラウンド3のP1 3件すべてがラウンド2の修正が生んだもの |
| **問題の捏造** | ラウンド4が問題視した3箇所は、前ラウンドの査読者が「最高の一文」と褒めた箇所 |

原因は明白で、**「問題を探せ」と指示された査読者は、綺麗な文章にも問題を見つける**。
単独意見を無検証で採用すると、良い訳文が悪化する。

### v2 の中核：同一ラウンドで3人並列 → 2人以上の一致のみ採用

```
      ┌─ 査読者A ─┐
訳文 ─┼─ 査読者B ─┼→ 指摘を突き合わせ →  2人以上が同じ箇所 → 【採用】
      └─ 査読者C ─┘                        1人だけ        → 【保留リスト】
```

- **3人は同じ訳文を、互いを知らずに読む。** 直列に回してはいけない。
- **採用条件：同一スパンに対し2人以上がP1またはP2を出したもの。**
- **1人だけの指摘は「保留リスト」**に落とす。直さない。ただし次ラウンドで
  別の査読者が同じ箇所を指摘したら、その時点で採用に格上げする。
- **例外（1人でも即採用）**：事実誤り・文法エラー・**意図しない含意を持つ語**
  （`minstrel` の黒塗り連想のような、知らないと踏む地雷）。これらは多数決に馴染まない。
  ただし④が「本当に地雷か」を判断する。
- **褒められた箇所は保護する。** あるラウンドで「良い」と評価された文は、
  次ラウンドで1人が問題視しても**動かさない**。2人以上が問題視して初めて再検討。

### 全員一致でも却下しなければならない2つのケース

合議制は「言語」の判定には強いが、**査読者は原文もシリーズ全体も知らない**。
Ep 360 の実測では、3人全員がP1を出した2件のうち**1件は採用してはいけないもの**だった。

**ケース1：原文自体の誤りが原因のもの → 著者へエスカレーション、訳文では直さない**

Ep 360 の見出しは原文が「Rくん」だが、本文はJ君とIちゃんの話で、Rは誰も出てこない。
3人全員が「見出しをJに直せ」とP1を出した。査読者は正しく詰まっているが、
**これは翻訳の問題ではなく原文の誤り**であり、訳者が黙って直せば原文の改変になる。
→ 訳文は原文どおりにし、フロントマターの `escalated_to_author` に記録して著者に確認する。

**ケース2：査読者がシリーズ文脈を知らないことが原因のもの → 却下**

同じ Ep 360 で、3人全員が「I-chan は J の3つ目の呼び名だから J に統一しろ」とP1を出した。
**これは誤り。** 原文では J君（フランス人アーティスト）と Iちゃん（同行者）は**別人**であり、
統一すれば人物を1人に潰す誤訳になる。査読者は前の話を読んでいないので判別できない。
→ **④はアーク文脈カードと人物レジストリを持っている唯一の役**。
   人物・地名・前後関係に関する指摘は、必ずレジストリと照合してから採否を決める。

> 教訓：**合議は「この英語は不自然か」には強く、「この内容は正しいか」には無力。**
> 前者は査読者に、後者は④に判断させる。

### 停止条件

- **採用対象のP1がゼロになったラウンドで終了。**
- P1件数が減らなくなったら、部分修正をやめてその段落を全面的に書き直す。
- **最大5ラウンド。** それを超えたら訳文ではなく原文の解釈に問題がある。

### 起動条件（絶対厳守）

このパスは**必ずサブエージェントとして起動**し、プロンプトに以下を**一切含めない**：

- 日本語原文（本文・要約・断片を問わず）
- 日本語原文のファイルパス、Notion URL、Episode 番号
- 「これは翻訳である」という事実
- 前ラウンドの査読結果、修正履歴

> **なぜここまで遮断するか：** 原文を見た査読者は、ぎこちない英語を見ても
> 「日本語がこうだから仕方ない」と無意識に納得し、translationese を検出できなくなる。
> 「これは翻訳だ」と知っているだけでも同じ緩みが起きる。
> 純粋な読者として読ませて初めて「これは訳文くさい」が拾える。

### プロンプト文面（3人全員に同じものを渡す）

> You are an American reader with a good ear for prose. Below is an entry from
> a travel memoir on a personal blog. Read it as a reader.
>
> Do NOT use any tools. Judge only the text pasted below.
>
> Flag anything that would make you stumble, reread a sentence, or feel the
> writing is off:
> 1. **Unnatural phrasing** — sentences no native writer would produce.
> 2. **Confusion** — anything you cannot follow.
> 3. **Rhythm** — read it aloud in your head. Where does it thud?
> 4. **Cultural opacity** — references unparseable with no knowledge of Japan
>    or India, which the text does not explain.
> 5. **Repetition** — the same word, image, or sentence shape overused.
> 6. **Loaded words** — any word carrying an association an American audience
>    would read that the writer probably did not intend.
>
> **Constraints — these are absolute:**
> - Do NOT suggest cutting, shortening, reordering, or adding to the author's
>   material. Every fact and every list item stays exactly where it is. Judge
>   only HOW it is written, never WHAT is said.
> - Do NOT suggest adding detail, color, scenes, or explanation that is not
>   already in the text.
> - Do not comment on content, subject matter, drug references, religion, or
>   the author's life choices.
> - **Do not invent problems.** If a sentence is good, say nothing about it.
>   `NO FINDINGS` is a perfectly good answer and is expected on clean prose. A
>   short honest report is more useful than a long one. You are not being
>   measured on how many findings you produce.
>
> **Output format — one finding per line, nothing else. No preamble, no essay,
> no summary.**
>
> ```
> P1 | "exact quoted span" | what is wrong, max 15 words | proposed rewrite
> ```
>
> - **P1** — reads as non-native, is wrong English, or cannot be understood.
> - **P2** — understandable but stiff, wordy, or badly paced.
> - **P3** — preference. Use sparingly.
>
> The quoted span must be copied character-for-character from the text so it
> can be matched automatically. Then, on a final separate line, list any
> sentence you thought was genuinely well written:
>
> ```
> GOOD | "exact quoted span"
> ```

`GOOD` 行が保護リストになる。これがあるおかげで、次ラウンドの査読者が
良い文を壊しにきたときに検出できる。

---

## パス④ 統合編集（Reconcile）

> あなたはこの英語版の編集責任者です。以下を受け取っています：
> 日本語原文 / 英訳ドラフト / 対訳監査の指摘 / ブラインド査読の指摘。
>
> **決定権はあなただけが持ちます。**2つの指摘リストは助言であり、そのまま適用する義務は
> ありません。ただし採用しない場合は理由を1行残してください。
>
> 判断基準：
> - 対訳監査のP1（意味の食い違い・欠落）は**必ず直す**。
> - ブラインド査読のP1は**必ず直す**。ただし意味を壊す形では直さない。
> - 両者が衝突する場合（自然にすると意味がズレる）：**意味の正確性を優先し、
>   別の言い回しで自然さを回復する。どちらかを諦めない。**
> - Voice Bible に反する「自然化」は却下する（例：アメリカのスラング投入）。
>
> 出力：
> 1. 最終稿（英語本文のみ）
> 2. 採否メモ（`採用/却下 | 指摘の要約 | 理由`）

### ④-b 捏造ゲート（採用した修正だけを対象に）

**査読者の提案を採用した箇所は、必ず原文に遡って照合する。** Ep 000 では
採用した提案経由で原文にない一句が2件入り込み、査読も機械QAも検出できなかった。

採用した各修正について、次を確認する：

1. 修正後の英文が主張する内容は、**原文のどの語句に対応するか**。指させないなら捏造。
2. 形容詞・副詞・比較・数量が**増えていないか**（「原文にない強調」が最も混入しやすい）。
3. 固有名詞・地名・数字が**具体化されていないか**
   （例：原文「世界各地」→ 訳「from Portugal to Thailand」は捏造）。

照合できない修正は**採用を取り消し、別の言い回しで自然さだけを回復する**。

---

## パス⑤ ブラインド再査読ゲート

パス④の成果物に対し、**新しいサブエージェント**でパス③をもう一度実行する。

- 前ラウンドの査読者を再利用しない。一度読んだ査読者は自分の指摘が反映されたかを
  確認してしまい、新鮮な読者としての判定ができない。
- **P1 がゼロになるまでループ。最大3周。**
- 3周で収束しない段落は、部分修正をやめて**全面的に書き直す**。
- 各ラウンドの P1 件数を記録し、アークレポートに載せる。

---

## パス⑥ 逆翻訳（Back-Translation／ユーザー検証用）

> 以下の英語の文章を日本語に翻訳してください。
> これは英語で書かれた回想録の一節です。原文がどうであったかを推測せず、
> **英語に書いてあることだけ**を日本語にしてください。
> 意味を補ったり、自然な日本語のために情報を足したりしないでください。

**必ず英訳だけを見て行う。** 日本語原文を見ながら戻すと原文に引きずられ、検証にならない。
これもサブエージェントとして、原文を渡さずに起動する。

出力された日本語をユーザーが原文と読み比べることで、**英語を読めなくても
意味のズレを検出できる**。これがユーザー側の検証手段になる。
