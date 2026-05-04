import { NextResponse } from 'next/server';

// 日銀APIから無担保コールO/N物レート（≈政策金利）を取得
async function fetchCallRate() {
  const now = new Date();
  const end = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const start = `${prev.getFullYear()}${String(prev.getMonth() + 1).padStart(2, '0')}`;

  const url = `https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=json&lang=jp&db=FM01&code=STRDCLUCON&startDate=${start}&endDate=${end}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' },
    next: { revalidate: 86400 },
  });
  const data = await res.json();
  const values = data?.RESULTSET?.[0]?.VALUES?.VALUES ?? [];
  return [...values].reverse().find(v => v !== null) ?? null;
}

// 財務省CSVから10年国債利回りを取得
async function fetchJGB10y() {
  const res = await fetch('https://www.mof.go.jp/jgbs/reference/interest_rate/jgbcm.csv', {
    headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' },
    next: { revalidate: 86400 },
  });
  const text = await res.text();
  const dataLines = text.split('\n').filter(l => /^R\d+\.\d+\.\d+/.test(l.trim()));
  if (!dataLines.length) return null;
  const parts = dataLines[dataLines.length - 1].split(',');
  // 列順: 日付(0), 1年(1)〜10年(10)
  const val = parseFloat(parts[10]);
  return isNaN(val) ? null : val;
}

// 住宅金融支援機構ページからフラット35最低金利（21〜35年）を取得
async function fetchFlat35Rate() {
  const res = await fetch('https://www.simulation.jhf.go.jp/flat35/kinri/index.php/rates/top', {
    headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' },
    next: { revalidate: 86400 },
  });
  const html = await res.text();
  // ページ先頭に登場する X.XXX 形式の数値 = 21〜35年の最低金利
  const match = html.match(/(\d\.\d{3})/);
  return match ? parseFloat(match[1]) : null;
}

export async function GET() {
  try {
    const [callRate, jgb10y, flat35Rate] = await Promise.all([
      fetchCallRate(),
      fetchJGB10y(),
      fetchFlat35Rate(),
    ]);

    return NextResponse.json({
      callRate,   // 無担保コールO/N物レート（年％）≈ 政策金利の実勢値
      jgb10y,     // 10年国債利回り（年％）
      flat35Rate, // フラット35最低金利（21〜35年・住宅金融支援機構公式）
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
