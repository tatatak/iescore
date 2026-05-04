import { NextResponse } from 'next/server';

const REINFOLIB_API_KEY = process.env.REINFOLIB_API_KEY;

async function fetchReinfolib(prefCode, cityCode, year) {
  const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/XIT001?year=${year}&area=${prefCode}&city=${cityCode}&priceClassification=02&Language=ja`;
  const res = await fetch(url, {
    headers: { 'Ocp-Apim-Subscription-Key': REINFOLIB_API_KEY },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.status === 'OK' && Array.isArray(json.data) ? json.data : [];
}

async function getDistrictFromNominatim(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=ja`,
      { headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' }, next: { revalidate: 86400 } }
    );
    const data = await res.json();
    const a = data?.address;
    if (!a) return null;
    const candidates = [a.suburb, a.neighbourhood, a.quarter, a.village].filter(Boolean);
    for (const c of candidates) {
      if (/丁目|[一二三四五六七八九十]丁/.test(c)) return c;
    }
    return candidates[0] || null;
  } catch {
    return null;
  }
}

function modal(arr) {
  const counts = {};
  for (const v of arr) counts[v] = (counts[v] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

// 風営法上のリスク分類
function getZoningRisk(useDistrict) {
  if (!useDistrict) return null;
  // 商業地域・準工業地域・工業地域: 性風俗・パチンコとも出店許可
  if (['商業地域', '準工業地域', '工業地域', '工業専用地域'].some(z => useDistrict.includes(z))) return 'high';
  // 近隣商業地域: パチンコ等一部許可
  if (['近隣商業地域'].some(z => useDistrict.includes(z))) return 'mid';
  return 'low';
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const muniCode = searchParams.get('muniCode');

  if (!lat || !lng || !muniCode) {
    return NextResponse.json({ useDistrict: null });
  }

  try {
    const prefCode = muniCode.slice(0, 2);

    const [district, data2024, data2023] = await Promise.all([
      getDistrictFromNominatim(lat, lng),
      fetchReinfolib(prefCode, muniCode, 2024),
      fetchReinfolib(prefCode, muniCode, 2023),
    ]);

    // REINFOLIB XIT001 では用途地域は CityPlanning フィールドに入る
    // 「市街化調整区域」「非線引き区域」等は都市計画区域種別のため除外
    const ZONING_KEYWORDS = ['住居', '商業', '工業', '準工業', '近隣商業'];
    const all = [...data2024, ...data2023].filter(d =>
      d.CityPlanning && ZONING_KEYWORDS.some(k => d.CityPlanning.includes(k))
    );
    if (all.length === 0) return NextResponse.json({ useDistrict: null });

    // 丁目で絞り込み（3件以上マッチすれば採用）
    let filtered = all;
    if (district) {
      const narrow = all.filter(d =>
        d.DistrictName && (d.DistrictName.includes(district) || district.includes(d.DistrictName))
      );
      if (narrow.length >= 3) filtered = narrow;
    }

    const useDistrict = modal(filtered.map(d => d.CityPlanning));
    const risk = getZoningRisk(useDistrict);

    return NextResponse.json({ useDistrict, risk, district, source: 'reinfolib' });
  } catch {
    return NextResponse.json({ useDistrict: null });
  }
}
