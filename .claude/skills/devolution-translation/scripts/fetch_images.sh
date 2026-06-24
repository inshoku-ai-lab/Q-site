#!/usr/bin/env bash
# Download all substackcdn images referenced in a line range of a source markdown.
#
# Usage: fetch_images.sh <source.md> <start_line> <end_line> <out_dir>
#
# Files are saved as iNN with the correct extension (.png/.jpg) inferred from the
# Content-Type. After running, open each with the Read tool to OCR/translate the
# embedded English text into Japanese blockquotes.
#
# NOTE: requires `substackcdn.com` (the apex, not just *.substackcdn.com) in the
# environment egress allowlist, or every fetch returns HTTP 403.
set -euo pipefail

SRC="${1:?source.md}"; START="${2:?start_line}"; END="${3:?end_line}"; OUT="${4:?out_dir}"
mkdir -p "$OUT"
sed -n "${START},${END}p" "$SRC" | grep -oE 'https://substackcdn[^)]*' > "$OUT/urls.txt" || true
n=$(wc -l < "$OUT/urls.txt" | tr -d ' ')
echo "found $n image url(s) in lines ${START}-${END}"
i=1
while IFS= read -r u; do
  base=$(printf "%s/i%02d" "$OUT" "$i")
  read -r code ct < <(curl -sS -o "$base" -w "%{http_code} %{content_type}" "$u"; echo)
  case "$ct" in
    image/png)  mv "$base" "$base.png"; f="$base.png" ;;
    image/jpeg) mv "$base" "$base.jpg"; f="$base.jpg" ;;
    *)          f="$base" ;;
  esac
  echo "i$i: HTTP $code  -> $(basename "$f")"
  [ "$code" = "403" ] && echo "  !! 403 — add 'substackcdn.com' (apex) to egress allowlist" >&2
  i=$((i + 1))
done < "$OUT/urls.txt"
