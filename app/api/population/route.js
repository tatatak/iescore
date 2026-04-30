import { NextResponse } from 'next/server';

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;

// 国勢調査 市区町村別人口（各年の確認済みstatsDataId）
const CENSUS = [
  { year: 2010, statsDataId: '0003038587' },
  { year: 2015, statsDataId: '0003149040' },
  { year: 2020, statsDataId: '0003445083' },
];

// Overpass APIで市区町村コードを取得（国土地理院GSIの代替）
async function getMuniCode(lng, lat) {
  const query = `[out:json][timeout:10];is_in(${lat},${lng})->.a;rel(pivot.a)[admin_level~"^(6|7|8)$"]["ref"];out tags;`;

  const res = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
  );
  const text = await res.text();
  if (!text.startsWith('{')) return { code: null, name: null };

  const data = JSON.parse(text);
  const rels = data.elements || [];

  // admin_level 高い（細かい）ものを優先: 8 > 7 > 6
  const target =
    rels.find(r => r.tags?.admin_level === '8') ||
    rels.find(r => r.tags?.admin_level === '7') ||
    rels.find(r => r.tags?.admin_level === '6');

  if (!target?.tags?.ref) return { code: null, name: null };

  const ref = String(target.tags.ref);
  // OSM の ref は 6桁（検査数字付き）の場合があるため e-Stat 用に5桁に切り詰める
  const code = ref.length >= 5 ? ref.slice(0, 5) : null;
  const name = target.tags['name:ja'] || target.tags.name || null;

  return { code, name };
}

// e-Stat国勢調査APIから市区町村の総人口を取得
// 各年のデータセットは複数カテゴリを含むが「総数」が最大値になるので Math.max で取得
async function fetchPopulation(statsDataId, areaCode) {
  const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${ESTAT_APP_ID}&statsDataId=${statsDataId}&cdArea=${areaCode}&limit=10`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  const json = await res.json();

  const status = json?.GET_STATS_DATA?.RESULT?.STATUS;
  if (status !== 0) return null;

  const dataVal = json?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;
  if (!dataVal) return null;

  const items = Array.isArray(dataVal) ? dataVal : [dataVal];
  const values = items
    .map(obj => parseInt(obj?.$ ?? '0', 10))
    .filter(v => Number.isFinite(v) && v > 0);

  return values.length ? Math.max(...values) : null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lng = searchParams.get('lng');
  const lat = searchParams.get('lat');

  if (!lng || !lat) {
    return NextResponse.json({ error: 'lng and lat required' }, { status: 400 });
  }

  try {
    const { code: muniCode, name: muniName } = await getMuniCode(lng, lat);
    if (!muniCode) {
      return NextResponse.json({ error: 'area not found' }, { status: 404 });
    }

    const results = await Promise.allSettled(
      CENSUS.map(async ({ year, statsDataId }) => {
        const population = await fetchPopulation(statsDataId, muniCode);
        return { year, population };
      })
    );

    const data = results
      .filter(r => r.status === 'fulfilled' && r.value.population !== null)
      .map(r => r.value)
      .sort((a, b) => a.year - b.year);

    return NextResponse.json({ muniCode, muniName, data });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
