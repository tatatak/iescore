import { NextResponse } from 'next/server';

const REINFOLIB_API_KEY = process.env.REINFOLIB_API_KEY;

async function fetchLandPriceYear(prefCode, cityCode, year) {
  const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/XCT001?year=${year}&area=${prefCode}&city=${cityCode}&division=00&Language=ja`; // cityCodeは3桁
  try {
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': REINFOLIB_API_KEY },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.status === 'OK' && Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const muniCode = searchParams.get('muniCode');
  if (!muniCode) return NextResponse.json({ error: 'muniCode required' }, { status: 400 });

  const prefCode = muniCode.slice(0, 2);
  const cityCode = muniCode.slice(prefCode.length); // 5桁→3桁文字列（例: "104"）
  const currentYear = new Date().getFullYear();
  // 直近5年（パフォーマンス確保のため）。キャッシュ後は高速。
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i);

  try {
    const results = await Promise.all(
      years.map(year => fetchLandPriceYear(prefCode, cityCode, year))
    );

    const yearData = years.map((year, i) => {
      const data = results[i];
      const residential = data.filter(d =>
        d['標準地番号 用途区分'] === '住宅地' &&
        d['1㎡当たりの価格'] &&
        d['標準地番号 市区町村コード 市区町村コード'] === cityCode
      );
      if (residential.length === 0) return null;

      const avgPrice = Math.round(
        residential.reduce((s, d) => s + parseInt(d['1㎡当たりの価格']), 0) / residential.length
      );

      // 相続税路線価（実値）: 0 の場合は倍率方式のエリアなので除外
      const withRosenka = residential.filter(d => parseInt(d['路線価 相続税路線価']) > 0);
      const avgRosenka = withRosenka.length > 0
        ? Math.round(withRosenka.reduce((s, d) => s + parseInt(d['路線価 相続税路線価']), 0) / withRosenka.length)
        : null;

      return { year, avgPrice, avgRosenka, count: residential.length };
    }).filter(Boolean);

    if (yearData.length === 0) {
      return NextResponse.json({ years: [], latestPrice: null, latestRosenka: null, trend: null });
    }

    const latest = yearData[yearData.length - 1];
    const first = yearData[0];
    const trend = first.avgPrice > 0
      ? parseFloat(((latest.avgPrice - first.avgPrice) / first.avgPrice * 100).toFixed(1))
      : null;

    return NextResponse.json({
      years: yearData,
      latestPrice: latest.avgPrice,
      latestRosenka: latest.avgRosenka,
      trend,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
