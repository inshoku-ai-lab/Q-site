# Voice Bible — The Vagabond Chronicles

英語版の「声」の定義。**Phase 0（アンカー5本：Ep 000, 003, 017, 103, 450）完了により確定版。**
全アンカーは4パス＋混成3人ブラインド査読を通過済み。以降の量産はこの版に従う。
新たな訳語判断・査読指摘は §5 に追記し続けること（このファイルは常に成長する）。

---

## 1. 目標地点

> **アメリカ人がスラスラ読めるが、語っているのは紛れもなく日本人の彼。**

参照すべき到達点は村上春樹作品の英訳（Jay Rubin, Philip Gabriel, Alfred Birnbaum）。
英語として完全に自然でありながら、語り手が日本人であることが消えていない。

**2つの失敗が同じ重さで存在する：**

| 失敗 | 症状 |
|---|---|
| 訳しすぎない（under） | 訳文くさい。主語過多、"It was that..."、直訳された慣用句 |
| 訳しすぎる（over） | アメリカ人が書いたように読める。スラングの過剰投入、日本的な文脈の消去 |

判断に迷ったら：**語順と発想は英語に寄せる。素材と視点は日本語に残す。**

---

## 2. 原文の声（日本語側の特徴）

実物を読んで抽出した特徴。これを英語で再現する。

- **一人称は「僕」** — 私でも俺でもない。少年っぽさと素直さが残る一人称。
- **1文＝1段落**の改行リズム。畳みかけるテンポを生んでいる。
- **現在形と過去形の混在** — 場面が盛り上がると現在形に切り替わり、臨場感が出る。
- **デッドパンな笑い** — オチを淡々と、文の最後に置く。
  > このバーはうちの家から歩いて5分ほどのところにあり、バイクで1時間もかけていくような
  > 場所ではなかったというのは後に気づいた事だ。
- **自嘲** — 「五度目の正直がすでにぐらついている。」
- **具体的な数字**が多い（1日150円、50ルピー、1時間）。抽象化してはいけない。
- **道徳的な注釈がない** — ドラッグも貧困も、良い悪いを言わずに事実として書く。

---

## 3. 英語側のルール

### 3-1. 人称と主語

日本語は主語を省く。直訳すると英語に "I" が氾濫して幼稚に読める。

- 段落内で主語が同じなら、2文目以降は分詞構文・等位接続・目的語始まりで逃がす。
- **1段落に "I" が4回以上出たら書き直しのサイン。**

```
✗ I woke up. I ate breakfast. I packed my bag. I went out to find the bus.
✓ I woke up, ate breakfast, packed my bag, and went out to find the bus.
```

### 3-2. 段落のリズム

- **1文＝1段落は原則そのまま保つ。** 著者の文体であり、ブログ／回想録として英語でも機能する。
- ただし、英語として接続語なしでは繋がらない2文は結合してよい。
  判断基準：**声に出して読んで、ぶつ切りに感じるかどうか。**
- 3文以上を1段落にまとめるのは、原文が明確に1つの流れを書いているときだけ。

### 3-3. 時制

日本語は自由に現在形へ切り替わるが、英語で同じことをすると「書き慣れていない」と読まれる。

- **既定は過去形。**
- 現在形は**場面ひとまとまり単位**でのみ使う（アクションの山場など）。
  使うと決めたらその場面の最後まで貫き、段落の途中で戻らない。
- 場面の切れ目（改行・話題転換）でのみ時制を切り替える。

### 3-4. 笑いの作り方 ★最重要

日本語は動詞が最後に来るので、オチが自然に文末に落ちる。**英語は意識的に作らないと落ちない。**

```
原文：このバーはうちの家から歩いて5分ほどのところにあり、バイクで1時間もかけていくような
      場所ではなかったというのは後に気づいた事だ。

✗ I later realized that the bar was only a five-minute walk from our house and
  not a place worth spending an hour on a motorcycle to reach.
  （オチが文の真ん中に埋まり、笑えない）

✓ The bar, I found out later, was a five-minute walk from our house.
  （短く切り、事実だけを最後に置く。説明を足さないから可笑しい）
```

**原則：オチは文末。説明を足さない。感嘆符を使わない。**
原文が淡々としているなら訳も淡々と。"hilariously" のような副詞で笑いを指示しない。

### 3-5. 数字・単位・通貨

- **数字はそのまま。** 「1日150円」を "cheap" に丸めない。具体性がこの文章の力。
- **円は初出でドル概算を添える。** アメリカ人に円の額はまったく伝わらない。
  換算は**その時代のレート**を使う（`glossary.md` の年代別レート表）。
  ```
  「1日150円の激安の部屋」→ "a room for 150 yen a night — about a dollar twenty"
  ```
- 原文がすでに二重表記（「５０ルピー（１５０円）」）の場合は、**円を経由せず直接ドルへ**。
  ```
  ✓ "fifty rupees, about a dollar"
  ✗ "fifty rupees (150 yen)"   ← 米国読者には二重に無意味
  ```
- **単位は必ず両方併記する。メートル法を先、ヤード・ポンド法を括弧内に。**

  読者はアメリカ人だけではない。**イギリス人・ドイツ人・インド人・オーストラリア人など、
  世界中の英語話者が読む**（ユーザー方針）。どちらか一方だけでは必ず誰かが読めない。

  ```
  ✓ a fired clay tube about fifteen centimeters (six inches) long
  ✓ seven hundred meters (2,300 feet) of elevation
  ✓ nearly sixty kilos (130 pounds)
  ✗ about six inches long          ← 世界の大半が読めない
  ✗ about fifteen centimeters long ← 米国読者が絵を描けない（査読者3人が一致して指摘）
  ```

  - **順序はメートル法が先。** 原文が日本語＝メートル法であり、英語圏でも人口の大半が
    メートル法圏。括弧内の換算は**概数で丸める**（`2,300 feet` であって `2,296.6 feet` ではない）。
  - **同じ数値の2回目以降は併記しない。** くどくなる。初出のみ。
  - **通貨は米ドル換算のままでよい。** 国際的な参照通貨として最も広く通じる。

### 3-6. 日本文化・現地文化の説明（軽い織り込み）

**初出のみ、地の文に自然に溶かす。脚注は使わない。** 読書のリズムを止めないため。

```
✓ 西成    → "Nishinari, Osaka's skid row"
✓ チロム  → "a chillum, the straight clay pipe you smoke hash out of"
✓ ツタヤ  → "Tsutaya, the video rental chain"
✓ ドヤ街  → "a doya district — block after block of flophouses for day laborers"
✗ 脚注や訳注ブロック
✗ 2回目以降にも毎回説明を付ける（くどい）
```

**説明は最短で。** 1語〜1句が理想、長くても短い同格句まで。1文まるごと解説に使わない。

### 3-7. 絶対にやらないこと

- ドラッグ・性・宗教批判・貧困の描写を和らげる、ぼかす、注意書きを足す
- 原文にない道徳的評価・反省・教訓を足す
- 感嘆符を増やす（原文が淡々としているのに英語で盛る）
- 「日本人らしさ」を演出するために不自然な英語にする（片言に訳すのは論外）
- アメリカのスラングやミーム表現を持ち込む（"lowkey", "hits different" 等）
- 前後記事のナビゲーションリンクを本文に書く

---

## 4. 実例（アンカー5本より確定）

### 4-0. アンカー5本の役割分担

| Ep | 文体 | 検証したこと |
|---|---|---|
| 000 | です・ます調（読者への自己紹介） | 声の基調そのものを確立 |
| 003 | だ・である調・独白 | 宗教教義の引用的パロディ、体罰描写の非婉曲化 |
| 017 | だ・である調・内省 | 短文の連打（フラグメント）の英訳、家族との緊張関係 |
| 103 | だ・である調・疾走感 | ドラッグ描写、会員限定マーカーの位置精度 |
| 450 | だ・である調・淡々とした観察 | 人物紹介、山小屋という特殊環境の説明 |

### 4-1. 語り口の基調

Ep 000 は読者への自己紹介なので**です・ます調**。Ep 103 以降の本編は**だ・である調**の
語りに変わる。英語では両方とも一人称の口語だが、**Ep 000 系は読者に語りかける温度**、
**本編は独白の温度**で書き分ける。

| # | 日本語原文 | 英訳 | なぜこう訳したか |
|---|---|---|---|
| 1 | そんじょそこらの映画には負けないと自負しています。 | I'd stack it up against most movies. | 「自負しています」を "I am confident that" と訳すと硬い。英語の慣用句1つで自信と軽さを同時に出す |
| 2 | 全てがぶっつけ本番で、のたうちまわって苦労したけど | I made all of it up as I went, and I floundered, and it hurt. | and を3回重ねる（polysyndeton）。畳みかけが原文のリズムに一致し、査読3名全員が「ここは良い」と評価 |
| 3 | ……自由への強烈な渇望**だけ**でした。 | ...and a raw thirst for freedom. **That was the whole inventory.** | 「だけ」を副詞で訳さず、**短い一文を足して**限定を作る。英語は only を置くより効く |
| 4 | こんな人間がいてもいいんだって知ってほしい | I want you to know that a person like me is allowed to exist. | 直訳に近いが、査読2名が「この文章で唯一心が動いた」と評価。**素直な直訳が最良のこともある** |
| 5 | 世間一般の常識では〜と思うのが普通ですよね。 | That's the usual guess, isn't it? | 「世間一般の常識では」を丸ごと "isn't it?" の一語に畳む。日本語の前置きは英語では削れる |

### 4-2. 逆に「直訳してはいけない」実例

| # | 日本語原文 | ✗ 直訳 | ✓ 採用訳 |
|---|---|---|---|
| 6 | 吟遊詩人 | minstrel | **troubadour**（minstrelは黒塗り芸を連想させる） |
| 7 | スナフキンを心の師として | my teacher in spirit is Snufkin | The closest thing I have to a teacher is Snufkin |
| 8 | 自分自身を世界に共有しています | I share myself with the world | I'm putting my own life in front of the world |
| 9 | 遊んで暮らす | living and playing | living for the fun of it（"playing"は「演奏」と誤読される） |
| 10 | 爆発しそうな好奇心と…麻痺した恐怖心 | curiosity about to blow, a sense of danger it had numbed out | curiosity about to boil over, **no sense of danger left at all**<br>— curiosity had burned it clean out of me —<br>（「持っていたもの」の列挙に「無いもの」を混ぜると英語は壊れる） |

### 4-3. 説明を織り込んだ箇所（軽いグロス）

| 原文 | 英訳 | 判断 |
|---|---|---|
| スナフキン | Snufkin — the wanderer from the Moomin books, who travels light and leaves town every autumn without telling anyone | 米国でムーミンの認知度は低い。無説明では「心の師」の意味が消える |
| 住民票 | the resident registry — the official register of residents every Japanese adult is supposed to be on | 米国に対応制度が無い。無説明では「無い」ことの異常さが伝わらない |
| インドのゴア | Goa on India's west coast | Goa 単独では米国読者に位置が伝わらない |
| ２００万円 | two million yen in bank debt — about eighteen thousand dollars | 当時のレート（¥110–120/$）で概算 |

### 4-4. Ep 003/017/103/450 からの追加実例

**教義の引用的パロディ（Ep 003）** — 原文は「エホバの証人の教義」を、著者自身の言葉ではなく、
**教団側の説教口調をそのまま模倣した文体**で書いている（皮肉のための擬態）。

```
原文：だから、この腐った世界で唯一、欲望に惑わされず聖書を正しく解釈しているエホバの証人の
      教義を信じなさい。

✓ So believe the teachings of Jehovah's Witnesses — the only ones in this rotten world
  who interpret the Bible correctly, not misled by desire.
```

命令形 "believe" をそのまま残し、著者の一人称が消える段落だと分かるようにする。
直後で "My mother believed..." と一人称の語りに戻ることで、**教義の声と著者の声の切り替え**が
英語でも明確に伝わる。

**体罰描写は婉曲化しない（Ep 003）**

```
原文：それは手でお尻ペンペンされるような生易しいものではなくて、車のエンジンに使われる
      ゴムのベルトに、持ち手を付けて叩きやすくした手作りの鞭でミミズ腫れが出来るまで
      叩かれていた。

✓ It wasn't anything as gentle as a hand swat on the bottom — it was a homemade rod,
  a rubber belt of the kind used in car engines with a handle attached to make it
  easier to swing, and you'd be hit with it until you had welts.
```

"welts"（ミミズ腫れ）を弱い語に置き換えない。原文の具体性をそのまま持ち込む。

**フラグメント（体言止め・単語だけの段落）はフラグメントのまま訳す（Ep 017）**

```
原文：フワフワとした、虚ろな気分。
✓ A floaty, hollow feeling.

原文：当たり前すぎる心の声。
✓ A too-obvious voice inside me.
```

主語・動詞を補って完全文にしない。原文が体言止めで作る「思考の断片」感を、
英語でも名詞句だけの独立行として再現する。

**「〜ことができた」の連続は変化をつける（Ep 000/003 共通の癖）**

```
✗ was able to survive without her sense of self falling apart
✓ survived without her sense of self falling apart
```

`was able to` は「能力があったから出来た」の含みが強すぎる場面がある。
文脈が単なる結果を述べているなら、素の過去形の方が原文の淡々とした調子に合う。

**「〜ようだ」の伝聞推量は "seem/apparently" で吸収し、"it was that" 構文を避ける（Ep 450）**

```
原文：個性の強い人が集まってくると言うこともあるが、どちらかと言うと個性の強い人が
      山での暮らしと言う特殊な環境になじみやすく、何年も働き続けることになっている
      ようだ。

✗ Part of it was that such people tended to gather here, but... they seemed to
  adapt easily... and so ended up working there year after year.
  （"it was that" は のだ の直訳。"ended up" も てしまう の直訳で余分な含みを足す）

✓ Maybe strong personalities are simply drawn here, but more likely, they adapt
  easily to the unusual environment of mountain life, which is why so many of
  them keep working here year after year.
```

---

## 5. ユーザー指摘の蓄積

ユーザーまたはブラインド査読から繰り返し出た指摘を、ここに Before/After で追記する。
**その記事だけ直して終わりにしない。** ここに書いて初めて次の話に効く。

| 日付 | 指摘 | 直し方 |
|---|---|---|
| | | |
