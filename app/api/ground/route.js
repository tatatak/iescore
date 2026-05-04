import { NextResponse } from 'next/server';

// AVS30（m/s）＋ ARV（揺れ増幅率）→ スコア 1-10
// 住宅が建つ実際の範囲（70〜400m/s）に圧縮。600m/s超の岩盤は住宅地に存在しないため10点に設定しない
function calcGroundScore(avs, arv) {
  if (!avs) return 5;
  const a = parseFloat(avs);
  let base;
  if (a >= 400)      base = 10;
  else if (a >= 350) base = 9;
  else if (a >= 300) base = 8;
  else if (a >= 250) base = 7;
  else if (a >= 200) base = 6;
  else if (a >= 160) base = 5;
  else if (a >= 130) base = 4;
  else if (a >= 100) base = 3;
  else if (a >= 70)  base = 2;
  else               base = 1;

  // ARV（揺れ増幅率）による±1補正
  let mod = 0;
  if (arv) {
    const r = parseFloat(arv);
    if (r < 1.5)  mod =  1;  // 揺れにくい
    if (r >= 3.5) mod = -1;  // 大きく揺れやすい
  }

  return Math.min(10, Math.max(1, base + mod));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  if (!lat || !lng) return NextResponse.json({ error: 'missing params' }, { status: 400 });

  try {
    // J-SHIS（防災科研）表層地盤API — APIキー不要・無料
    const url = `https://www.j-shis.bosai.go.jp/map/api/sstrct/V4/meshinfo.geojson?position=${lng},${lat}&epsg=4326`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' },
      next: { revalidate: 86400 },
    });
    const data = await res.json();
    const props = data?.features?.[0]?.properties;
    if (!props) return NextResponse.json({ score: 3, avs: null, arv: null, jname: null });

    const avs   = props.AVS  ? parseFloat(props.AVS)  : null;
    const arv   = props.ARV  ? parseFloat(props.ARV)  : null;
    const jname = props.JNAME ?? null;
    const score = calcGroundScore(avs, arv);

    return NextResponse.json({ score, avs, arv, jname });
  } catch {
    return NextResponse.json({ score: 3, avs: null, arv: null, jname: null });
  }
}
