"""
校正コレクションを ローカル MD ファイルへ適用する。

入力:
  migration/proofread/corrections.jsonl
    1行 = 1修正。形式:
    {"file": "<basename>.md", "id": <wp_id>, "old": "<原文>", "new": "<修正後>",
     "reason": "<理由>", "type": "typo|mechanical|..."}

挙動 (安全第一):
  - old が本文に「ちょうど1回」出現 → 置換して適用
  - old が無く new が既に存在 → 適用済みとみなしスキップ
  - old が複数回出現 → 曖昧なのでスキップして警告 (context を増やすこと)
  - old も new も無い → 不一致として警告

状態:
  migration/proofread/applied_md.json に適用済みキー (file::old) を記録。
  何度実行しても二重適用しない (冪等)。

使い方:
  python3 migration/scripts/08_apply_md.py            # 適用
  python3 migration/scripts/08_apply_md.py --dry-run  # 確認のみ
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
POSTS_DIR = ROOT / "migration" / "posts"
CORR_PATH = ROOT / "migration" / "proofread" / "corrections.jsonl"
STATE_PATH = ROOT / "migration" / "proofread" / "applied_md.json"


def key_of(c):
    h = hashlib.sha1((c["file"] + "::" + c["old"]).encode("utf-8")).hexdigest()[:12]
    return h


def load_corrections():
    if not CORR_PATH.exists():
        print(f"corrections.jsonl がありません: {CORR_PATH}")
        return []
    out = []
    for ln, line in enumerate(CORR_PATH.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("//"):
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError as e:
            print(f"  ! {ln}行目のJSONが不正: {e}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    corrections = load_corrections()
    print(f"コレクション件数: {len(corrections)}" + (" [DRY-RUN]" if args.dry_run else ""))

    state = {}
    if STATE_PATH.exists():
        state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    applied = set(state.get("applied", []))

    n_applied = n_skip_done = n_already = n_ambig = n_missing = 0

    for c in corrections:
        k = key_of(c)
        f = POSTS_DIR / c["file"]
        if k in applied:
            n_skip_done += 1
            continue
        if not f.exists():
            print(f"  ! ファイルなし: {c['file']}")
            n_missing += 1
            continue
        text = f.read_text(encoding="utf-8")
        cnt = text.count(c["old"])
        allow_all = c.get("all", False)
        if cnt >= 1 and (cnt == 1 or allow_all):
            new_text = text.replace(c["old"], c["new"])
            if not args.dry_run:
                f.write_text(new_text, encoding="utf-8")
                applied.add(k)
            n_applied += 1
            tag = f" ×{cnt}" if cnt > 1 else ""
            print(f"  ✓ {c['file']}{tag}")
            print(f"      - {c['old']}")
            print(f"      + {c['new']}   ({c.get('reason','')})")
        elif cnt == 0:
            if c["new"] and text.count(c["new"]) >= 1:
                n_already += 1
                applied.add(k)  # already applied previously
            else:
                print(f"  ? 不一致(old見つからず): {c['file']}  old='{c['old'][:30]}'")
                n_missing += 1
        else:
            print(f"  ? 曖昧({cnt}回出現): {c['file']}  old='{c['old'][:30]}' → contextを増やしてください")
            n_ambig += 1

    if not args.dry_run:
        state["applied"] = sorted(applied)
        STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")

    print("\n=== 結果 ===")
    print(f"  新規適用 : {n_applied}")
    print(f"  適用済み : {n_skip_done + n_already}")
    if n_ambig:
        print(f"  曖昧スキップ: {n_ambig}")
    if n_missing:
        print(f"  不一致   : {n_missing}")
    if args.dry_run:
        print("\n※ DRY-RUN: ファイルは変更していません。")


if __name__ == "__main__":
    main()
