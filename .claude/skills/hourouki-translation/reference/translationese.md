# 訳文くささ（translationese）のパターン集

日本語話者が英訳するときに必ず出る癖。**機械QAの検出語リストの根拠**でもある
（`scripts/qa_check.py` の `TRANSLATIONESE` を参照）。

ここに挙がった表現は「常に禁止」ではなく、**出たら必ず疑う**という位置づけ。
本当にその語が最適なこともある。ただし1記事に何度も出るなら、ほぼ確実に直訳の癖。

---

## 1. 直訳されやすい定型表現

| 日本語 | ありがちな直訳 ✗ | 自然な英語 ✓ |
|---|---|---|
| 〜と思う | I thought that ... | （多くは断定でよい）"It was going to be a long night." |
| 〜のだ / 〜んだ | It was that ... | （訳出しない。強調なら語順や短文で出す） |
| なんとなく | somehow | for some reason／（訳さない） |
| やっぱり | as expected | sure enough／of course／（訳さない） |
| 結局 | after all | in the end／eventually |
| とりあえず | for the time being | for now／anyway／first |
| ちなみに | by the way | （多くは削る。英語では話が逸れて聞こえる） |
| 〜ことができる | was able to | could／（動詞だけで足りる） |
| 〜てしまう | ended up ~ing | （多くは単なる過去形で足りる） |
| 〜ような気がする | I felt like that ... | It felt like ...／I had a feeling |
| 〜に関して | regarding／as for | about／on／（前置詞で足りる） |
| という | called／that is | （ほぼ削れる。最頻出の直訳癖） |
| 実は | actually | （多くは削る） |
| そして／それから | And then, ... And then, ... | 接続を変える／文を繋ぐ／削る |
| 非常に／とても | very very | 強い形容詞1語に置き換える |
| 〜的には | ~ically speaking | （削る） |
| 〜させていただく | let me have you ... | （英語に敬語階層はない。普通に書く） |

## 2. 構造レベルの癖

### 2-1. 主語の氾濫
日本語は主語を省く。逐語訳すると "I" が刺さるほど並ぶ。
**1段落に "I" が4回以上出たら書き直し。**

### 2-2. 説明過多
日本語は文脈で通じることを、英語で全部言語化してしまう。

```
✗ Because it was India, and because in India things like this happen often,
  I was not particularly surprised by it.
✓ It was India. I wasn't surprised.
```

### 2-3. 受動態への逃避
```
✗ The party was being held at a bar near the flea market.
✓ The party was at a bar near the flea market.
```

### 2-4. 名詞化（nominalization）
日本語の漢語表現を名詞のまま英訳すると硬くなる。
```
✗ My decision was the continuation of the journey.
✓ I decided to keep going.
```

### 2-5. 副詞で感情を指示する
原文が淡々としているのに、英語で "amazingly", "hilariously", "shockingly" を足す。
**原文にない感情の指示は追加禁止**（`voice-bible.md` §3-4）。

### 2-6. 慣用句の直訳
```
✗ five times honest        （五度目の正直）
✓ fifth time lucky         （"third time lucky" の型を数字だけ変える）
```
慣用句は**意味ではなく機能**を訳す。笑いのための言い回しなら、英語で笑える言い回しにする。

---

## 2-7. 「持っていたもの」の列挙に「持っていなかったもの」を混ぜる

日本語は自然にできるが、**英語では論理が壊れる**。Ep 000 の実例：

```
原文：僕にあったのは、少しの貯金と小さなバックパック、爆発しそうな好奇心と
      それによって完全に麻痺した恐怖心、そして自由への強烈な渇望だけでした。

✗ What I had was ... curiosity ready to burst, a sense of danger that the curiosity
  had burned away to nothing, and a raw thirst for freedom.
  → 「持っていたもの」のリストの中に「もう無いもの」が入る。英語読者は3回読み返す。
     ブラインド査読2名が独立に「この箇所で詰まる」と指摘した。

✓ What I had was ... curiosity ready to burst, no sense of danger left at all
  — the curiosity had burned it away to nothing — and a raw thirst for freedom.
  → 「無い」ことを明示し、理由を挿入句に逃がす。
```

**列挙の途中で肯定→否定が反転していないかを必ず確認する。**

---

## 2-8. 英国英語の混入

日本語話者の英作文は**英国寄りの語彙・綴りに流れやすい**。アメリカ人読者には
「どこか外国で編集された文章」に読める。Ep 000 で実際に出たもの：

| 出たもの | 米国英語 |
|---|---|
| qualifications（資格） | credentials |
| doing circus（サーカスをする） | performing circus shows |
| covid | Covid / COVID |
| a twenty-six-**strong** caravan | a twenty-six-**person** caravan |
| fit to burst | ready to burst |
| has got you assuming | has you thinking |

---

## 3. この作品で特に注意する語

| 原文 | 誤りやすい訳 | 正しい扱い |
|---|---|---|
| 僕 | I（連発） | §2-1 参照。主語を減らす工夫が要る |
| 吟遊詩人 | ~~minstrel~~ | **troubadour**。minstrel は黒塗り芸を連想させる語（`glossary.md` 参照） |
| 心の師 | teacher in spirit | the closest thing I have to a teacher |
| 居場所がなかった | had never held a place in the world | had never belonged anywhere |
| 爆発しそうな好奇心 | curiosity about to blow | curiosity ready to burst（blow は補語が要る） |
| 自分自身を世界に共有する | share myself with the world | put my own life out into the world<br>（"share myself" は米国英語で性的／自己啓発的な含みを持つ） |
| 遊んで暮らす | living and **playing** | 「音楽を演奏する」と誤読される。本作は路上音楽家の話なので特に危険。<br>living for the fun of it / roaming and having fun |
| この旅（20年の放浪） | this **trip** | trip は米国英語で「2週間の旅行」。this / this life on the road |
| 世界中（何度も出る） | around the world ×6 | 日本語は「世界中」を繰り返せるが英語は繰り返せない。<br>2回までに抑え、残りは具体地名や別表現に散らす |
| Ｍさん、Ｃさん | Mr. M, Mr. C | **"M", "C"**。イニシャル匿名なので敬称は付けない |
| 〜おじさん | uncle | **血縁ではない**。"the old guy"／"the older guy" |
| ぶっ飛ぶ | fly away | **be high／be wrecked**（薬物の文脈） |
| 盛り上がる | swell up | 文脈次第：the party picked up／I was hyped |
| 半端ない | not half | insane／unreal（ただし多用しない） |
| 自分探し | searching for myself | （そのままだと陳腐。文脈で具体化する） |

---

## 4. 検出の運用

- 機械QA（`qa_check.py`）が上記の語を検出して**警告**を出す。エラーではない。
- 警告が出たら、その箇所が本当にその語でなければならないかを1件ずつ判断する。
- **ブラインド査読で新しい癖が見つかったら、必ずこのファイルと `qa_check.py` に追記する。**
  これをやらないと522話ずっと同じ癖が出続ける。
