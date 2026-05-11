# エリアページ実装メモ

## muniCode（市区町村コード）について

JIS X 0402 の5桁コード。REINFOLIB の成約価格取得に使用する。

### 政令指定都市の注意
区単位でコードが存在する（横浜市全体ではなく横浜市西区=14104 のように区コードを使う）。

### 大阪市の特殊な番号体系
大阪市北区 = **27127**、中央区 = **27128** と番号が飛んでいる。  
理由：1989年の区再編で「旧・北区＋大淀区→北区」「旧・東区＋南区→中央区」と合併した際に新番号が振られたため。旧コード（27105=旧東区など）は欠番になっている。

### muniCode が間違っていたときの挙動
成約価格だけ表示されない（`condoP50 == null`）。地盤・ハザードスコアは lat/lng で取得するため影響なし。ページ自体は表示される。

---

## Next.js 15 の params は await が必要

```js
// NG（Next.js 15以前の書き方）
export default async function Page({ params }) {
  const area = getAreaBySlug(params.slug); // undefined になる

// OK
export default async function Page({ params }) {
  const { slug } = await params;
  const area = getAreaBySlug(slug);
```

`generateMetadata` も同様に `await params` が必要。これを忘れると `notFound()` が呼ばれて404になる。実際に今回一度やらかした。

---

## ISR の動作（revalidate = 86400）

- ビルド時（`vercel --prod`）に `generateStaticParams` の全スラッグ分のHTMLを事前生成
- 24時間後、次のアクセスがあったタイミングでバックグラウンドで再生成（ユーザーには古いページが返る）
- API（地盤・ハザード・成約価格）の値は毎日自動更新される

---

## エリアを追加するときの手順

1. `app/area/data.js` の `areas` 配列にエントリを追加
2. `vercel --prod` でデプロイ（sitemap.js は `areas` を import しているので自動で更新される）

---

## getNearbyAreas の距離計算

ユークリッド距離（度数法の直交近似）で計算しているため、北海道など高緯度では実距離と若干ズレる。  
現在のカバー範囲（本州以南）では実用上問題ない。

---

## 既知の誤記・修正履歴

| 日付 | ファイル | 内容 |
|------|---------|------|
| 2026-05-08 | data.js 広島市南区 | lng 134.4616 → 132.4616 に修正（岡山の経度になっていた） |
