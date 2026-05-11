import { NextResponse } from 'next/server';

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;

async function fetchEstatBatch(statsDataId, muniCodes) {
  const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${ESTAT_APP_ID}&statsDataId=${statsDataId}&cdArea=${muniCodes.join(',')}&limit=5000`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 * 30 } });
    if (!res.ok) return {};
    const json = await res.json();
    const items = json?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;
    if (!Array.isArray(items)) return {};
    const map = {};
    for (const item of items) {
      const code = String(item['@area'] ?? '').slice(0, 5);
      const val = parseInt(item.$ ?? '0');
      if (code.length === 5 && val > 0) {
        map[code] = Math.max(map[code] ?? 0, val);
      }
    }
    return map;
  } catch { return {}; }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const codes = (searchParams.get('codes') ?? '')
    .split(',')
    .map(c => c.trim())
    .filter(c => /^\d{5}$/.test(c));

  if (!ESTAT_APP_ID || codes.length === 0) {
    return NextResponse.json({});
  }

  const [pop20, pop15] = await Promise.all([
    fetchEstatBatch('0003445083', codes), // 2020年国勢調査
    fetchEstatBatch('0003149040', codes), // 2015年国勢調査
  ]);

  const result = {};
  for (const code of codes) {
    const p20 = pop20[code], p15 = pop15[code];
    if (p20 && p15 && p15 > 0) {
      result[code] = parseFloat(((p20 - p15) / p15 * 100).toFixed(1));
    }
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=2592000, stale-while-revalidate=86400' },
  });
}
