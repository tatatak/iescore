import { NextResponse } from 'next/server';

const KEY = process.env.REINFOLIB_API_KEY;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const z = searchParams.get('z') ?? '11';
  const x = searchParams.get('x');
  const y = searchParams.get('y');

  if (!x || !y || !KEY) return NextResponse.json({});

  const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/XKT013?response_format=geojson&z=${z}&x=${x}&y=${y}`;

  try {
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': KEY },
      next: { revalidate: 86400 * 30 },
    });
    if (!res.ok) return NextResponse.json({});
    const json = await res.json();

    // SHICODEごとにPTN_2025とPTN_2040を合計
    const agg = {};
    for (const f of json.features ?? []) {
      const p = f.properties;
      const code = String(p.SHICODE ?? '').slice(0, 5);
      if (!code || code.length !== 5) continue;
      const p2025 = parseFloat(p.PTN_2025 ?? 0);
      const p2040 = parseFloat(p.PTN_2040 ?? 0);
      if (!p2025) continue;
      if (!agg[code]) agg[code] = { p2025: 0, p2040: 0 };
      agg[code].p2025 += p2025;
      agg[code].p2040 += p2040;
    }

    // 変化率（%）に変換
    const result = {};
    for (const [code, { p2025, p2040 }] of Object.entries(agg)) {
      if (p2025 > 0) {
        result[code] = parseFloat(((p2040 - p2025) / p2025 * 100).toFixed(1));
      }
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=2592000, stale-while-revalidate=86400' },
    });
  } catch { return NextResponse.json({}); }
}
