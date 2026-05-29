"""
画像ダウンロードスクリプト (スタンドアロン版)

使い方:
  1. このファイルと image_urls.txt を同じフォルダに置く
  2. ターミナル(またはコマンドプロンプト)でそのフォルダに移動
  3. 以下を実行:
       pip install requests
       python3 download_images.py
  4. images/ フォルダに画像がダウンロードされる
  5. 終了後、download_log.csv で結果を確認できる

- 中断しても、再実行すれば続きから再開します (resumable)
- 並列ダウンロードで高速 (約30分目安、1959枚)
"""
import csv
import hashlib
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlparse, unquote

import requests

HERE = Path(__file__).resolve().parent
URL_FILE = HERE / "image_urls.txt"
IMG_DIR = HERE / "images"
LOG_FILE = HERE / "download_log.csv"

IMG_DIR.mkdir(exist_ok=True)

SITE_HOSTS = {"qryptraveller.com", "www.qryptraveller.com"}
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "image/*,*/*;q=0.8",
}
MAX_WORKERS = 8
TIMEOUT = 30


def url_to_local_path(url: str) -> Path:
    p = urlparse(url)
    path = unquote(p.path).lstrip("/") or hashlib.md5(url.encode()).hexdigest()
    host = p.netloc or "unknown"
    if host in SITE_HOSTS:
        return IMG_DIR / "wp" / path
    safe_host = re.sub(r"[^a-zA-Z0-9._-]", "_", host)
    return IMG_DIR / "external" / safe_host / path


def download_one(url: str):
    try:
        local = url_to_local_path(url)
        if local.exists() and local.stat().st_size > 0:
            return (url, str(local.relative_to(IMG_DIR)), "cached", local.stat().st_size, "")
        local.parent.mkdir(parents=True, exist_ok=True)
        with requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True, allow_redirects=True) as r:
            if r.status_code != 200:
                return (url, "", f"http_{r.status_code}", 0, "")
            tmp = local.with_suffix(local.suffix + ".part")
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(64 * 1024):
                    if chunk:
                        f.write(chunk)
            size = tmp.stat().st_size
            tmp.replace(local)
            return (url, str(local.relative_to(IMG_DIR)), "ok", size, r.headers.get("Content-Type", ""))
    except Exception as e:
        return (url, "", "error", 0, str(e)[:200])


def main():
    if not URL_FILE.exists():
        print(f"ERROR: {URL_FILE} が見つかりません。")
        print("image_urls.txt をこのスクリプトと同じフォルダに置いてください。")
        return

    urls = [u.strip() for u in URL_FILE.read_text(encoding="utf-8").splitlines() if u.strip()]
    print(f"対象: {len(urls)} 枚")
    print(f"保存先: {IMG_DIR}")
    print(f"並列数: {MAX_WORKERS}")
    print("ダウンロード開始...\n")

    results = []
    start = time.time()
    done = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futs = {ex.submit(download_one, u): u for u in urls}
        for fut in as_completed(futs):
            results.append(fut.result())
            done += 1
            if done % 25 == 0 or done == len(urls):
                elapsed = time.time() - start
                rate = done / elapsed if elapsed else 0
                eta = (len(urls) - done) / rate if rate else 0
                print(f"  [{done}/{len(urls)}]  {rate:.1f}枚/秒  残り約{eta:.0f}秒")

    with LOG_FILE.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["url", "local_path", "status", "size_bytes", "info"])
        for r in results:
            w.writerow(r)

    from collections import Counter
    statuses = Counter(r[2] for r in results)
    total_bytes = sum(r[3] for r in results)
    ok = statuses.get("ok", 0) + statuses.get("cached", 0)

    print("\n=== 完了 ===")
    print(f"成功: {ok} / {len(urls)}")
    print(f"内訳: {dict(statuses)}")
    print(f"合計サイズ: {total_bytes/1024/1024:.1f} MB")
    print(f"ログ: {LOG_FILE}")


if __name__ == "__main__":
    main()
