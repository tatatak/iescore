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

// Nominatim で座標 → 丁目名を取得
async function getDistrictFromNominatim(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=ja`,
      { headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' }, next: { revalidate: 86400 } }
    );
    const data = await res.json();
    const a = data?.address;
    if (!a) return null;
    // 丁目・番が含まれる候補を優先
    const candidates = [a.suburb, a.neighbourhood, a.quarter, a.road, a.village].filter(Boolean);
    for (const c of candidates) {
      if (/丁目|[一二三四五六七八九十]丁/.test(c)) return c;
    }
    return candidates[0] || null;
  } catch {
    return null;
  }
}

// 最頻値を返す
function modalYear(arr) {
  const counts = {};
  for (const yr of arr) counts[yr] = (counts[yr] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0] ? { year: parseInt(sorted[0][0]), count: sorted[0][1], total: arr.length } : null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const muniCode = searchParams.get('muniCode');

  if (!lat || !lng || !muniCode) {
    return NextResponse.json({ builtYear: null, source: null });
  }

  try {
    const prefCode = muniCode.slice(0, 2);

    const [district, data2025, data2024, data2023] = await Promise.all([
      getDistrictFromNominatim(lat, lng),
      fetchReinfolib(prefCode, muniCode, 2025),
      fetchReinfolib(prefCode, muniCode, 2024),
      fetchReinfolib(prefCode, muniCode, 2023),
    ]);

    const condos = [...data2025, ...data2024, ...data2023].filter(
      d => d.Type === '中古マンション等' && d.BuildingYear
    );

    if (condos.length === 0) {
      return NextResponse.json({ builtYear: null, source: null, district });
    }

    // 丁目で絞り込み（名前が部分一致するもの）
    let filtered = condos;
    if (district) {
      const narrow = condos.filter(d =>
        d.DistrictName && (d.DistrictName.includes(district) || district.includes(d.DistrictName))
      );
      if (narrow.length >= 2) filtered = narrow;
    }

    const years = filtered
      .map(d => d.BuildingYear?.replace('年', ''))
      .filter(y => y && /^\d{4}$/.test(y));

    const result = modalYear(years);
    if (!result) return NextResponse.json({ builtYear: null, source: null, district });

    return NextResponse.json({
      builtYear: result.year,
      matchCount: result.count,
      totalCount: result.total,
      district: district || null,
      source: 'reinfolib',
    });
  } catch (e) {
    return NextResponse.json({ builtYear: null, source: null });
  }
}
