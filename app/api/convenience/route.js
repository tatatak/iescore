import { NextResponse } from 'next/server';

function distanceToScore(m) {
  if (!m || m > 2000) return 1;
  if (m <= 160)  return 10;
  if (m <= 320)  return 9;
  if (m <= 480)  return 8;
  if (m <= 640)  return 7;
  if (m <= 800)  return 6;
  if (m <= 960)  return 5;
  if (m <= 1200) return 4;
  if (m <= 1500) return 3;
  return 2;
}

// 駅: HeartRails Express（日本専用・無料・APIキー不要）
async function fetchStations(lat, lng) {
  try {
    const res = await fetch(
      `https://express.heartrails.com/api/json?method=getStations&x=${lng}&y=${lat}`,
      { cache: 'no-store' }
    );
    const data = await res.json();
    return (data?.response?.station ?? [])
      .map(s => ({
        name: s.name,
        operator: s.line || '',
        distanceM: Math.round(parseFloat(s.distance || '9999')),
        lat: parseFloat(s.y) || null,
        lng: parseFloat(s.x) || null,
      }))
      .filter(s => s.distanceM <= 2000)
      .sort((a, b) => a.distanceM - b.distanceM);
  } catch {
    return [];
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lng = parseFloat(searchParams.get('lng'));
  const lat = parseFloat(searchParams.get('lat'));
  if (!lng || !lat) return NextResponse.json({ error: 'lng and lat required' }, { status: 400 });

  const stationsRaw = await fetchStations(lat, lng);

  const stationMap = new Map();
  for (const s of stationsRaw) {
    const key = `${s.name}|${s.operator}`;
    if (!stationMap.has(key)) stationMap.set(key, s);
  }
  const nearbyStations = Array.from(stationMap.values())
    .sort((a, b) => a.distanceM - b.distanceM)
    .map(s => ({ ...s, walkMin: Math.round(s.distanceM * 1.3 / 80) }))
    .filter(s => s.walkMin <= 25);

  const nearestStation  = stationsRaw[0]?.name ?? null;
  const nearestStationM = stationsRaw[0]?.distanceM ?? null;

  return NextResponse.json({
    nearestStation,
    nearestStationM,
    stations: nearbyStations,
    score: distanceToScore(nearestStationM),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' },
  });
}
