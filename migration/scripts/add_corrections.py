"""
バッチ補正ファイル(JSON配列)を corrections.jsonl に追記する。
重複(file+old が同一)はスキップ。

使い方:
  python3 migration/scripts/add_corrections.py <batch.json>
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
CORR = ROOT / "migration" / "proofread" / "corrections.jsonl"


def main():
    batch_path = Path(sys.argv[1])
    new_items = json.loads(batch_path.read_text(encoding="utf-8"))

    existing = set()
    lines = []
    if CORR.exists():
        for line in CORR.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            lines.append(line)
            try:
                o = json.loads(line)
                existing.add((o["file"], o["old"]))
            except json.JSONDecodeError:
                pass

    added = 0
    for item in new_items:
        key = (item["file"], item["old"])
        if key in existing:
            print(f"  skip(dup): {item['file']} {item['old'][:20]}")
            continue
        lines.append(json.dumps(item, ensure_ascii=False))
        existing.add(key)
        added += 1

    CORR.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"追記: {added} 件 / 合計 {len(lines)} 件")


if __name__ == "__main__":
    main()
