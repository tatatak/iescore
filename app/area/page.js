import { areas as featuredAreas } from './data';
import AreaExploreMapLoader from './AreaExploreMapLoader';
import futurePopData from './futurePopData.json';

export const revalidate = 86400;

const REINFOLIB_KEY = process.env.REINFOLIB_API_KEY;

export const metadata = {
  title: '広域マップ｜公示地価・地価トレンドをひと目で | イエスコア',
  description: '東京・大阪など主要エリアの公示地価と地価トレンドをマップで一覧表示。「どの辺りが買いやすいか」をひと目で把握できます。完全無料・登録不要。',
  alternates: { canonical: 'https://www.iescore.com/area' },
};

// 66エリア詳細ページへの slug ルックアップ
const SLUG_MAP = Object.fromEntries(featuredAreas.map(a => [a.muniCode, a.slug]));

const PREF_CODES = [
  '01','02','03','04','05','06','07','08','09','10',
  '11','12','13','14','15','16','17','18','19','20',
  '21','22','23','24','25','26','27','28','29','30',
  '31','32','33','34','35','36','37','38','39','40',
  '41','42','43','44','45','46','47',
];

// XIT002: 都道府県内の市区町村コード→名称マップを返す
async function fetchMuniNames(prefCode) {
  const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/XIT002?area=${prefCode}&language=ja`;
  try {
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': REINFOLIB_KEY },
      next: { revalidate: 86400 * 30 }, // 市区町村名は月次キャッシュで十分
    });
    if (!res.ok) return {};
    const raw = await res.json();
    const list = Array.isArray(raw) ? raw : (raw.data ?? []);
    return Object.fromEntries(list.map(m => [String(m.id), String(m.name)]));
  } catch {
    return {};
  }
}

// XCT001: 都道府県全体の公示地価データを取得
async function fetchPrefYear(prefCode, year) {
  const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/XCT001?year=${year}&area=${prefCode}&division=00&Language=ja`;
  try {
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': REINFOLIB_KEY },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.status === 'OK' && Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

// レスポンスを市区町村単位で集計（住宅地のみ・座標付き）
function aggregateByMuni(data) {
  const muniMap = {};
  for (const d of data) {
    if (d['標準地番号 用途区分'] !== '住宅地') continue;
    const price = parseInt(d['1㎡当たりの価格']);
    if (!price) continue;
    const lat = parseFloat(d['位置座標 緯度']);
    const lng = parseFloat(d['位置座標 経度']);
    if (!lat || !lng) continue;
    const pref = String(d['標準地番号 市区町村コード 県コード']).padStart(2, '0');
    const muni = String(d['標準地番号 市区町村コード 市区町村コード']).padStart(3, '0');
    const fullCode = pref + muni;
    if (!muniMap[fullCode]) muniMap[fullCode] = { prices: [], lats: [], lngs: [] };
    muniMap[fullCode].prices.push(price);
    muniMap[fullCode].lats.push(lat);
    muniMap[fullCode].lngs.push(lng);
  }
  return muniMap;
}

async function fetchPrefData(prefCode) {
  const latestYear = new Date().getFullYear() - 1;
  const oldYear = latestYear - 3; // REINFOLIBは2022年以前のデータなし

  const [muniNames, latestData, oldData] = await Promise.all([
    fetchMuniNames(prefCode),
    fetchPrefYear(prefCode, latestYear),
    fetchPrefYear(prefCode, oldYear),
  ]);

  const latestMap = aggregateByMuni(latestData);
  const oldMap = aggregateByMuni(oldData);

  const results = {};
  for (const [fullCode, d] of Object.entries(latestMap)) {
    if (d.prices.length < 3) continue; // 3件未満は除外（小規模町村）
    const lat = d.lats.reduce((a, b) => a + b, 0) / d.lats.length;
    const lng = d.lngs.reduce((a, b) => a + b, 0) / d.lngs.length;
    const latestPrice = Math.round(d.prices.reduce((a, b) => a + b, 0) / d.prices.length);
    const old = oldMap[fullCode];
    const oldPrice = old && old.prices.length >= 3
      ? Math.round(old.prices.reduce((a, b) => a + b, 0) / old.prices.length)
      : null;
    const trend = oldPrice
      ? parseFloat(((latestPrice - oldPrice) / oldPrice * 100).toFixed(1))
      : null;

    results[fullCode] = {
      muniCode: fullCode,
      name: muniNames[fullCode] ?? null,
      slug: SLUG_MAP[fullCode] ?? null,
      lat,
      lng,
      latestPrice,
      trend,
    };
  }
  return results;
}

export default async function AreaMapPage() {
  const BATCH = 8; // 8都道府県 × 3 API = 24並列
  const allAreas = {};

  for (let i = 0; i < PREF_CODES.length; i += BATCH) {
    const batch = PREF_CODES.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(p => fetchPrefData(p)));
    for (const r of results) {
      if (r.status === 'fulfilled') {
        Object.assign(allAreas, r.value);
      }
    }
  }

  const areas = Object.values(allAreas);
  return <AreaExploreMapLoader areas={areas} futurePopData={futurePopData} />;
}
