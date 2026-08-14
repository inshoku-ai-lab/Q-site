/**
 * Regression test for the nav-link matcher.
 *
 *   node scripts/test-nav-links.mjs
 *
 * The KEEP cases are real sentences taken from the articles. They exist
 * because the matcher deletes article text when it is too eager: prose
 * that merely mentions an earlier or later episode reads a lot like
 * navigation, and every one of these was a near miss at some point.
 */
import { isNavOnlyText, isNavBlock, stripNavBlocks } from "./lib/nav-links.mjs";

const DELETE = [
  "前の記事　｜　次の記事",
  "前の記事102　｜　次の記事104",
  "前の記事",
  "次の記事",
  "次の記事に続く",
  "次の記事はこちらです。",
  "前の記事１０２ | 次の記事１０４",
];

const KEEP = [
  "二人は以前の記事で紹介したホームレスのFさんとCさんだ。",
  "その文化については次の記事で紹介したい。",
  "それではまた次の記事で。",
  "それではまた、次の記事で。",
  "それではまた次の記事で☺️🙏✨",
  "この点については以前の記事で書いたので、ここでは簡潔に述べます。",
  "これは１２月２日の判決が出される前の記事です。",
  "エホバの証人の詳細について興味がなかったら次の記事、社会の厳しさに向き合う小学生時代の話１（放浪記００５）へどうぞ。",
  "以前の記事でゴアに長年住むヒッピーのおじさんCさんの話をしたが、彼の押しの強い個性があちこちで問題を生んでいた。",
  "",
  "　",
  "｜｜｜",
];

let failures = 0;
const check = (label, actual, expected, subject) => {
  if (actual !== expected) {
    failures++;
    console.error(`FAIL [${label}] expected ${expected}, got ${actual}: ${JSON.stringify(subject)}`);
  }
};

for (const s of DELETE) check("nav", isNavOnlyText(s), true, s);
for (const s of KEEP) check("prose", isNavOnlyText(s), false, s);

// Only paragraphs are navigation; a heading that says "次の記事" is content.
check("heading", isNavBlock({ type: "heading_2", html: "前の記事　｜　次の記事" }), false, "heading");
check("paragraph", isNavBlock({ type: "paragraph", html: "前の記事　｜　次の記事" }), true, "paragraph");

// Links arrive as HTML from richToHtml(); the tags must not defeat matching.
check(
  "linkified",
  isNavBlock({ type: "paragraph", html: '<a href="https://x/">前の記事102</a>　｜　<a href="https://y/">次の記事104</a>' }),
  true,
  "linkified",
);

// A bare article URL trailing the nav line goes with it, and nothing else does.
{
  const blocks = [
    { type: "paragraph", html: "本文の最後の段落。" },
    { type: "paragraph", html: "次の記事はこちらです。" },
    { type: "paragraph", html: "https://qryptraveller.com/some-article/" },
  ];
  const removed = stripNavBlocks(blocks);
  check("pair-removed", removed, 2, "nav + trailing url");
  check("pair-kept", blocks.length, 1, "body paragraph survives");
}
{
  const blocks = [
    { type: "paragraph", html: "前の記事　｜　次の記事" },
    { type: "paragraph", html: "https://example.com/unrelated/" },
  ];
  const removed = stripNavBlocks(blocks);
  check("foreign-url-kept", removed, 1, "non-article URL is not navigation");
}

if (failures) {
  console.error(`\n${failures} 件失敗`);
  process.exit(1);
}
console.log(`OK — ${DELETE.length + KEEP.length + 7} 件すべて期待どおり`);
