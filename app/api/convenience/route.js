import { NextResponse } from 'next/server';

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 最寄り駅距離(m) → 利便性スコア 1-10
function distanceToScore(m) {
  if (!m || m > 2000) return 1;
  if (m <= 160)  return 10; // 徒歩2分以内
  if (m <= 320)  return 9;  // 4分以内
  if (m <= 480)  return 8;  // 6分以内
  if (m <= 640)  return 7;  // 8分以内
  if (m <= 800)  return 6;  // 10分以内
  if (m <= 960)  return 5;  // 12分以内
  if (m <= 1200) return 4;  // 15分以内
  if (m <= 1500) return 3;  // 19分以内
  return 2;                  // 25分以内
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lng = parseFloat(searchParams.get('lng'));
  const lat = parseFloat(searchParams.get('lat'));
  if (!lng || !lat) return NextResponse.json({ error: 'lng and lat required' }, { status: 400 });

  const query = `[out:json][timeout:20];
(
  node["railway"~"station|halt"](around:2000,${lat},${lng});
  node["shop"="supermarket"](around:1000,${lat},${lng});
  node["amenity"~"hospital|clinic"](around:1000,${lat},${lng});
  node["amenity"~"kindergarten|childcare"](around:1000,${lat},${lng});
  way["amenity"~"kindergarten|childcare"](around:1000,${lat},${lng});
  node["amenity"="school"]["name"~"小学校|中学校|高校|高等学校|義務教育学校"](around:1500,${lat},${lng});
  way["amenity"="school"]["name"~"小学校|中学校|高校|高等学校|義務教育学校"](around:1500,${lat},${lng});
  node["highway"="bus_stop"](around:500,${lat},${lng});
);
out center;`;

  try {
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' }, cache: 'no-store' }
    );
    const text = await res.text();
    if (!text.startsWith('{')) return NextResponse.json({ error: 'Overpass error' }, { status: 502 });

    const elements = JSON.parse(text).elements || [];
    const stations     = elements.filter(e => e.tags?.railway === 'station' || e.tags?.railway === 'halt');
    const allSupermarkets = elements.filter(e => e.tags?.shop === 'supermarket');
    const supermarkets500 = allSupermarkets.filter(e => {
      const eLat = e.lat ?? e.center?.lat;
      const eLon = e.lon ?? e.center?.lon;
      return eLat && eLon && haversineM(lat, lng, eLat, eLon) <= 500;
    });
    const supermarkets = allSupermarkets; // 1000m圏
    const hospitals    = elements.filter(e => e.tags?.amenity === 'hospital' || e.tags?.amenity === 'clinic');
    const kindergartens = elements.filter(e => e.tags?.amenity === 'kindergarten' || e.tags?.amenity === 'childcare');
    const schools      = elements.filter(e => e.tags?.amenity === 'school');
    const busStops     = elements.filter(e => e.tags?.highway === 'bus_stop');

    // 徒歩15分以内（1200m）の駅を全て収集し、距離順でソート
    const stationsWithDist = [];
    for (const s of stations) {
      const sLat = s.lat ?? s.center?.lat;
      const sLon = s.lon ?? s.center?.lon;
      if (!sLat || !sLon) continue;
      const d = haversineM(lat, lng, sLat, sLon);
      const operator = s.tags?.operator || s.tags?.['railway:operator'] || '';
      stationsWithDist.push({ name: s.tags?.name || '不明', operator, distanceM: Math.round(d) });
    }
    stationsWithDist.sort((a, b) => a.distanceM - b.distanceM);

    // 同一駅名×運営会社でまとめ、最近傍ノードのみ残す（出入口・ホームが複数ノードある対策）
    const stationMap = new Map();
    for (const s of stationsWithDist.filter(s => s.distanceM <= 2000)) {
      const key = `${s.name}|${s.operator}`;
      if (!stationMap.has(key)) stationMap.set(key, s);
    }
    const nearbyStations = Array.from(stationMap.values())
      .sort((a, b) => a.distanceM - b.distanceM)
      .map(s => ({ ...s, walkMin: Math.round(s.distanceM * 1.3 / 80) }))
      .filter(s => s.walkMin <= 25);

    const nearestStation = stationsWithDist[0]?.name ?? null;
    const nearestStationM = stationsWithDist[0]?.distanceM ?? null;

    return NextResponse.json({
      nearestStation,
      nearestStationM,
      stations: nearbyStations,
      supermarkets: supermarkets.length,
      supermarkets500: supermarkets500.length,
      hospitals: hospitals.length,
      kindergartens: kindergartens.length,
      schools: schools.length,
      busStops: busStops.length,
      score: distanceToScore(nearestStationM),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
