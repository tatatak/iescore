# イエスコア（iescore.com）開発記録

> 「その価格、適正ですか？」
> マイホーム購入検討者向けの、公的データだけを使った中立なエリア診断サービス。

---

## 作業ログ

### 2026-04-30（初日）

#### 完成した機能

| 機能 | 使ったサービス |
|------|-------------|
| 地図表示・住所検索 | Mapbox GL JS |
| ハザードマップ（洪水・土砂） | 国土地理院タイル |
| エリアスコアパネル | 静的データ（API待ち） |
| 購入チェックリスト（15項目） | 独自実装 |
| 徒歩圏表示（5・10・15分） | Mapbox Isochrone API |
| 周辺施設表示（駅・スーパー・医療・学校・バス停） | OpenStreetMap（Overpass API） |
| 物件保存・比較機能（最大3件） | LocalStorage |
| アクセス解析 | Google Analytics 4 |
| 独自ドメイン公開 | Vercel + ConoHa WING DNS |

---

## 使っているサービスと設定メモ

### Mapbox
- **用途**: 地図表示 / 住所・駅名検索 / 徒歩圏（Isochrone API）
- **トークン**: `.env.local` の `NEXT_PUBLIC_MAPBOX_TOKEN`
- **無料枠**: 月50,000リクエストまで無料
- **注意**: トークンはコードに直書き禁止。必ず環境変数経由で使う
- **管理画面**: account.mapbox.com

### Vercel
- **用途**: Next.jsアプリのホスティング・デプロイ
- **プラン**: Hobby（無料）
- **デプロイ方法**: GitHubのmainブランチにpushすると自動デプロイ
- **環境変数の追加場所**: Vercel → プロジェクト → Settings → Environment Variables
  - 環境変数を追加・変更したら **Redeploy** が必要
- **Framework Preset**: Settings → Build and Deployment → **Next.js** を選択すること（Otherのままだと404になる）
- **ドメイン設定**: Settings → Domains

### ConoHa WING（DNSのみ使用）
- **用途**: iescore.com ドメインのDNS管理のみ（ホスティングはVercelが担当）
- **設定したDNSレコード**:
  ```
  Aレコード    @    216.198.79.1          （iescore.com → Vercel）
  CNAMEレコード www  184bde7ffb0a5ada.vercel-dns-017.com.  （www.iescore.com → Vercel）
  ```
- **注意**: サーバー管理への追加は不要。DNSだけ設定すればOK

### Google Analytics 4（GA4）
- **測定ID**: `G-7G48FS7Y5E`
- **環境変数**: `NEXT_PUBLIC_GA_ID`
- **実装場所**: `app/layout.js`（`@next/third-parties/google` パッケージ使用）
- **管理画面**: analytics.google.com

### 国土地理院タイル
- **用途**: ハザードマップ（洪水浸水・土砂災害）
- **APIキー**: 不要・無料・無制限
- **タイルURL**:
  ```
  洪水浸水:   https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png
  土砂（土石流): https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png
  土砂（地すべり): https://disaportaldata.gsi.go.jp/raster/05_jisuberikeikaikuiki/{z}/{x}/{y}.png
  土砂（急傾斜): https://disaportaldata.gsi.go.jp/raster/05_kyukeishakeikaikuiki/{z}/{x}/{y}.png
  ```

### Mapbox Isochrone API
- **用途**: 徒歩5・10・15分圏の表示
- **APIキー**: Mapboxトークンを流用（追加費用なし）
- **エンドポイント**:
  ```
  https://api.mapbox.com/isochrone/v1/mapbox/walking/{lng},{lat}?contours_minutes=5,10,15&polygons=true&access_token={token}
  ```
- **返り値**: 実際の道路ネットワークに沿ったGeoJSONポリゴン（直線の円ではない）

### OpenStreetMap / Overpass API
- **用途**: 周辺施設（駅・スーパー・医療機関・学校・バス停）の取得
- **APIキー**: 不要・無料
- **エンドポイント**: `https://overpass-api.de/api/interpreter`
- **注意**: 混雑時にXMLエラーを返すことがある。`res.text()`で受け取り`{`で始まるかチェックしてからJSONパース
- **検索半径**: バス停600m、駅2000m、その他1500m
- **OSMタグ一覧**:
  ```
  駅:       railway=station
  バス停:   highway=bus_stop
  スーパー: shop=supermarket
  医療機関: amenity=hospital / amenity=clinic / amenity=doctors
  学校:     amenity=school / amenity=kindergarten
  ```

### LocalStorage（物件保存・比較）
- **用途**: 検索した物件のチェックリスト状態を保存
- **キー**: `iescore_saved`
- **制限**: ブラウザごとに独立。別端末では見えない。「閲覧データを削除」すると消える
- **データ構造**:
  ```json
  {
    "id": "prop_1234567890",
    "name": "亀有2丁目（任意の名前）",
    "lat": 35.xxx,
    "lng": 139.xxx,
    "checkedItems": { "quake": true, "loan": false },
    "activeLayers": { "flood": true },
    "checked": 8,
    "stars": 3,
    "savedAt": "2026-04-30T..."
  }
  ```

---

## 環境変数一覧

| 変数名 | 用途 | 設定場所 |
|--------|------|---------|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox地図・検索・Isochrone | `.env.local` + Vercel |
| `NEXT_PUBLIC_GA_ID` | Google Analytics 4 | `.env.local` + Vercel |
| `ESTAT_APP_ID` | e-Stat API（人口データ） | `.env.local` + Vercel |
| `REINFOLIB_API_KEY` | 国交省 成約価格・地価公示 | `.env.local` + Vercel（未取得） |

---

## ファイル構成

```
app/
├── layout.js          GA4・メタデータ・フォント設定
├── page.js            メインページ・状態管理（flyTo, activeLayers）
├── globals.css        グローバルCSS（POIマーカーのpulseアニメーション）
└── components/
    ├── Map.js         地図・ハザードレイヤー・Isochrone・POIマーカー
    ├── SearchBar.js   住所・駅名検索（Mapbox Geocoding v6）
    └── ScorePanel.js  スコア・チェックリスト・物件保存・比較
```

### 状態管理の構造

```
page.js
├── flyTo        検索した場所（lat/lng/name） → Map・ScorePanelに渡す
└── activeLayers レイヤー表示状態（flood/landslide/isochrone/supermarket...）
                 → Map・ScorePanelの両方から読み書き（onToggleLayer経由）
```

---

## ローカル開発

```bash
cd /Users/takuyakishimoto/Documents/iescore-Project
npm run dev
# → http://localhost:3000
```

## デプロイ

```bash
git add .
git commit -m "変更内容"
git push origin main
# → Vercelが自動デプロイ（1〜2分）
```

---

## 未実装・今後の予定

| 機能 | 必要なもの | 状態 |
|------|-----------|------|
| 成約価格の実データ表示 | 国交省APIキー | 申請済み・審査中（5営業日） |
| 地価公示・上昇率 | 国交省APIキー | 同上 |
| 買う vs 借りる比較 | 国交省APIキー（賃貸データも含む） | APIキー待ち |
| 人口推移グラフ | e-Stat API | 実装待ち |
| 駅別乗降客数 | 国土数値情報GeoJSON | 実装待ち |
| アフィリエイト | A8.net等への登録 | 未着手 |
| スマホ対応 | レイアウト調整 | 未着手 |
