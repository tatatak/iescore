#!/bin/bash
# iescore Note記事ドラフト自動生成スクリプト
# LaunchAgent から月・水・金 8:17 に起動される

NOTES_DIR="/Users/takuyakishimoto/Documents/iescore-Project/note-articles"
LOG_FILE="/Users/takuyakishimoto/Documents/iescore-Project/scripts/generate-note.log"
CLAUDE_BIN="/opt/homebrew/bin/claude"

echo "$(date '+%Y-%m-%d %H:%M:%S') generate-note.sh 起動" >> "$LOG_FILE"

# 次の未執筆テーマを特定（番号順）
NEXT_NUM=0
for i in 2 3 4 5 6 7 8 9 10; do
  PAD=$(printf "%02d" "$i")
  if ! ls "$NOTES_DIR/${PAD}_"*.md 2>/dev/null | grep -q .; then
    NEXT_NUM=$i
    break
  fi
done

if [ "$NEXT_NUM" -eq 0 ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') 全テーマ執筆済み。スキップ。" >> "$LOG_FILE"
  osascript -e 'display notification "全テーマ執筆済みです" with title "iescore Note生成"' 2>/dev/null || true
  exit 0
fi

# テーマ情報を case で解決
case "$NEXT_NUM" in
  2) SLUG="variable-rate"; THEME="変動金利の5年ルール・125%ルールの怖さ（金利上昇リスク）" ;;
  3) SLUG="jiban"; THEME="地盤が弱いエリアを買ってはいけない理由（液状化・震災との関係）" ;;
  4) SLUG="repair-fund"; THEME="マンション修繕積立金が少ないと何が起きるか" ;;
  5) SLUG="asset-value"; THEME="戸建ての10年後資産価値はこうして計算する" ;;
  6) SLUG="land-shape"; THEME="旗竿地・角地・傾斜地で価格はどう変わるか" ;;
  7) SLUG="loan-affordability"; THEME="住宅ローン審査に通っても「返せる額」は別の話" ;;
  8) SLUG="earthquake-standard"; THEME="新耐震基準・2000年基準とは何か（築年数の正しい読み方）" ;;
  9) SLUG="convenience"; THEME="スーパーや病院が近いと資産価値はどう変わるか" ;;
  10) SLUG="checklist"; THEME="マイホーム購入前に必ず確認すべき5つのこと" ;;
esac

NUM_PAD=$(printf "%02d" "$NEXT_NUM")
OUT_FILE="$NOTES_DIR/${NUM_PAD}_${SLUG}.md"
TODAY=$(date '+%Y-%m-%d')

echo "$(date '+%Y-%m-%d %H:%M:%S') 執筆開始: $THEME → $OUT_FILE" >> "$LOG_FILE"

PROMPT="イエスコア（iescore.com）のNote記事ドラフトを執筆してください。

テーマ: ${THEME}
今日の日付: ${TODAY}
保存先: ${OUT_FILE}

## 執筆手順

### Step 1: WebSearchで調査
テーマ「${THEME}」について以下を調べる（2025〜2026年の情報を優先）:
- 最新の統計・事例・法改正
- マイホーム購入者が後悔しているポイント
- 検索されやすいキーワード・よくある質問

### Step 2: 記事執筆（1500〜2500字）

ガイドライン:
- サービス概要: イエスコアは住所・駅名を入力するだけで不動産成約価格・地盤・ハザードリスク・利便性を10点満点でスコア表示。完全無料・登録不要。URL: https://www.iescore.com
- 対象読者: マイホーム（マンション・戸建て）購入を検討している一般消費者
- 文体: ですます調・見出し多め・スマホで読みやすい段落分け
- 冒頭: 読者の「あるある」失敗談・不安から入る
- 本文: 問題提起 → 知識・解説 → 具体的な確認方法 → イエスコアで簡単に調べられる流れ
- 「知らなかった」「気づかなかった」という発見を必ず1つ入れる
- データや数字を使って具体的に書く
- 売り込み感を出さず、読者の不安解消を最優先に
- 締めに「イエスコア（iescore.com）で調べてみましょう」と自然に誘導（1文だけ）
- Note.comはmarkdownテーブルが崩れるため、表は絵文字リスト形式にする（例: 🟡 **値** 説明）

### Step 3: ファイルに保存

以下のフォーマットで ${OUT_FILE} に書き込む（Writeツールを使用）:

# [タイトル]

投稿日: ${TODAY}
タグ: #マイホーム #不動産購入 #住宅購入 #[タグ1] #[タグ2]

---

[本文]

---
🏠 **イエスコアで無料エリア診断**
住所や駅名を入力するだけで、地盤・ハザード・成約価格・利便性をまとめてスコア表示します。
👉 https://www.iescore.com

#マイホーム #不動産購入 #住宅購入 #[タグ1] #[タグ2]"

# claude CLIで記事生成
"$CLAUDE_BIN" --dangerously-skip-permissions -p "$PROMPT" >> "$LOG_FILE" 2>&1
STATUS=$?

if [ $STATUS -eq 0 ] && [ -f "$OUT_FILE" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') 執筆完了: $OUT_FILE" >> "$LOG_FILE"
  osascript -e "display notification \"ドラフト保存: ${NUM_PAD}_${SLUG}.md\" with title \"iescore Note生成完了\"" 2>/dev/null || true
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') エラー: claude終了コード=$STATUS ファイル存在=$([ -f "$OUT_FILE" ] && echo yes || echo no)" >> "$LOG_FILE"
  osascript -e "display notification \"生成エラー: ログを確認してください\" with title \"iescore Note生成\"" 2>/dev/null || true
fi
