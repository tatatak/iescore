import { NextResponse } from 'next/server';

const REINFOLIB_KEY = process.env.REINFOLIB_API_KEY;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const prefCode = searchParams.get('prefCode') ?? '13';
  const cityCode = searchParams.get('cityCode') ?? '104';
  const year = searchParams.get('year') ?? '2025';

  const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/XCT001?year=${year}&area=${prefCode}&city=${cityCode}&division=00&Language=ja`;

  const res = await fetch(url, {
    headers: { 'Ocp-Apim-Subscription-Key': REINFOLIB_KEY },
    cache: 'no-store',
  });

  const json = await res.json();
  const data = json.data ?? [];

  // 最初の1件のキー一覧と値を返す
  const sample = data[0] ?? null;
  const keys = sample ? Object.keys(sample) : [];
  const first3 = data.slice(0, 3);

  return NextResponse.json({
    url,
    status: json.status,
    totalCount: data.length,
    sampleKeys: keys,
    first3Records: first3,
  });
}
