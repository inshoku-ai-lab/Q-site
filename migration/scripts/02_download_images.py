"""
Phase 1 - Step 2: Download all image URLs found in WXR
- Parallel downloads with progress
- Saves to migration/images/ preserving original WP path structure
- Outputs mapping CSV: original_url -> local_path, status, size_bytes
- Skips already-downloaded files (resumable)
"""
import csv
import hashlib
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlparse, unquote

import requests

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "images"
REPORTS_DIR = ROOT / "reports"
IMG_DIR.mkdir(exist_ok=True)

URL_FILE = REPORTS_DIR / "image_urls.txt"
MAP_FILE = REPORTS_DIR / "image_map.csv"

SITE_HOSTS = {"qryptraveller.com", "www.qryptraveller.com"}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Migration Bot; contact: artistofbeing@gmail.com)",
    "Accept": "image/*,*/*",
}

MAX_WORKERS = 12
TIMEOUT = 30


def url_to_local_path(url: str) -> Path:
    p = urlparse(url)
    path = unquote(p.path).lstrip("/")
    if not path:
        # fallback: hash
        path = hashlib.md5(url.encode()).hexdigest()
    # Bucket by host so external imgs don't collide
    host = p.netloc or "unknown"
    if host in SITE_HOSTS:
        sub = Path("wp") / path
    else:
        # sanitize host
        safe_host = re.sub(r"[^a-zA-Z0-9._-]", "_", host)
        sub = Path("external") / safe_host / path
    return IMG_DIR / sub


def download_one(url: str):
    try:
        local = url_to_local_path(url)
        if local.exists() and local.stat().st_size > 0:
            return (url, str(local.relative_to(IMG_DIR)), "cached", local.stat().st_size, "")
        local.parent.mkdir(parents=True, exist_ok=True)
        with requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True, allow_redirects=True) as r:
            if r.status_code != 200:
                return (url, "", "http_" + str(r.status_code), 0, "")
            ct = r.headers.get("Content-Type", "")
            tmp = local.with_suffix(local.suffix + ".part")
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(64 * 1024):
                    if chunk:
                        f.write(chunk)
            size = tmp.stat().st_size
            tmp.replace(local)
            return (url, str(local.relative_to(IMG_DIR)), "ok", size, ct)
    except Exception as e:
        return (url, "", "error", 0, str(e)[:200])


def main():
    urls = [u.strip() for u in URL_FILE.read_text(encoding="utf-8").splitlines() if u.strip()]
    print(f"Downloading {len(urls)} images with {MAX_WORKERS} workers ...")

    results = []
    done = 0
    start = time.time()
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futs = {ex.submit(download_one, u): u for u in urls}
        for fut in as_completed(futs):
            res = fut.result()
            results.append(res)
            done += 1
            if done % 50 == 0 or done == len(urls):
                elapsed = time.time() - start
                rate = done / elapsed if elapsed else 0
                print(f"  [{done}/{len(urls)}] {rate:.1f}/s")

    # Write map
    with MAP_FILE.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["url", "local_path", "status", "size_bytes", "info"])
        for r in results:
            w.writerow(r)

    # Summary
    from collections import Counter
    statuses = Counter(r[2] for r in results)
    total_bytes = sum(r[3] for r in results)
    print("\nDONE")
    print("Status breakdown:", dict(statuses))
    print(f"Total downloaded size: {total_bytes/1024/1024:.1f} MB")
    print(f"Map written to {MAP_FILE}")


if __name__ == "__main__":
    main()
