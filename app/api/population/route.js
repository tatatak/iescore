import { NextResponse } from 'next/server';

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;

// 国勢調査（5年毎）の統計表ID: 男女別人口及び世帯数－市区町村
const CENSUS = [
  { year: 2010, statsDataId: '0003009216' },
  { year: 2015, statsDataId: '0003412313' },
  { year: 2020, statsDataId: '0003445083' },
];

async function getMuniCode(lng, lat) {
  const res = await fetch(
    `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToStathArea?lon=${lng}&lat=${lat}`
  );
  const data = await res.json();
  return {
    code: data?.results?.muniCd,
    name: data?.results?.lv01Nm,
  };
}

async function fetchPopulation(statsDataId, areaCode) {
  const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getSimpleStatsData?appId=${ESTAT_APP_ID}&statsDataId=${statsDataId}&cdArea=${areaCode}&limit=10`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  const json = await res.json();

  const status = json?.GET_SIMPLE_STATS_DATA?.RESULT?.STATUS;
  if (status !== 0) return null;

  const dataObj = json?.GET_SIMPLE_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.DATA_OBJ;
  if (!dataObj) return null;

  const items = Array.isArray(dataObj) ? dataObj : [dataObj];
  const values = items
    .map(obj => parseInt(obj?.VALUE?.$ ?? '0', 10))
    .filter(v => Number.isFinite(v) && v > 0);

  // 最大値 = 総人口（男+女+世帯数の中で最大）
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
