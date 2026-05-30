# Q-site Migration - Phase 1

WordPress (qryptraveller.com) → Notion → Astro 移行プロジェクトの作業フォルダ。

## ディレクトリ構成

```
migration/
├── source/             # WordPress WXRエクスポート (元データ)
├── scripts/            # 移行スクリプト
│   ├── 01_parse_wxr.py        # WXR → MD + CSV変換
│   └── 02_download_images.py  # 画像一括ダウンロード
├── posts/              # 781記事のMarkdown (YAMLフロントマター付き)
├── images/             # ダウンロード済み画像 (※下記参照)
└── reports/            # 集計・棚卸しレポート
    ├── posts.csv              # 全記事一覧
    ├── attachments.json       # WP添付ファイル一覧
    ├── image_urls.txt         # ユニーク画像URL (1959件)
    ├── image_map.csv          # URL → ローカルパス対応表
    └── stats.json             # 統計サマリー
```

## Phase 1 結果サマリー

- **記事数**: 781 (公開 778 / 下書き 3)
- **WP添付**: 1706
- **ユニーク画像URL**: 1959
- **カテゴリ**: 8 (再設計の余地大、後述)
- **タグ**: 512 (大幅整理推奨)
- **年別分布**: 2021:46, 2022:620, 2023:100, 2024:13, 2025:2

### カテゴリ分布
- 放浪記: 523
- デボリューション理論の記事集: 145
- オリジナル記事: 44
- ツイッターファイル全記事: 42
- ティール・スワンの言葉: 10
- DSが潰したい真のビットコインの話: 9
- 日本人が知っておくべき英文記事の翻訳: 6
- ブログ記事: 4

### 品質フラグ
- `no-images`: 628記事 (本文中に画像なし — featured imageは別)
- `short`: 14記事 (200文字未満 — 要確認)
- `status:draft`: 3記事

## ⚠️ 画像ダウンロードについて

このリモート実行環境のネットワークポリシーが `qryptraveller.com` への
アクセスをブロックしている (`x-deny-reason: host_not_allowed`)。

→ **ローカル環境で `02_download_images.py` を実行する必要があります**。

```bash
cd migration
pip install requests
python3 scripts/02_download_images.py
```

ローカル実行なら全1959画像が `migration/images/` 配下にダウンロードされ、
`reports/image_map.csv` に URL → ローカルパス対応表が出力されます。

容量を確認した後、画像ホスティング先を最終決定します
(< 1GB ならリポジトリ同梱、それ以上なら Cloudflare R2 推奨)。

## 次のステップ (Phase 2 - Notion移行)

1. 画像ダウンロード完了 (ローカル作業)
2. 記事の棚卸し: `posts.csv` を見て「公開/アーカイブ/破棄」を仕分け
3. カテゴリ・タグの再設計 (8カテゴリ → 5-7に整理、タグ512 → 30前後)
4. Notionデータベース設計
5. Notion APIで一括投入 (MD → Notion blocks)
