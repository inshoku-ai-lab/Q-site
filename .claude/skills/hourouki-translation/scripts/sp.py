"""このセッションの scratchpad を返す。

以前は各スクリプトに前セッションの scratchpad のパスが直書きされており、
セッションが変わるたびに全スクリプトが空のディレクトリを見ていた。
環境変数 HOUROUKI_SP があればそれを、無ければ最も新しい scratchpad を使う。
"""
import glob
import os


def scratchpad():
    sp = os.environ.get("HOUROUKI_SP")
    if sp:
        return sp
    cands = glob.glob("/tmp/claude-0/-home-user-Q-site/*/scratchpad")
    if not cands:
        raise SystemExit("scratchpad が見つからない。HOUROUKI_SP を設定する")
    return max(cands, key=os.path.getmtime)


SP = scratchpad()
