import { NextResponse } from 'next/server';

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat'));
  const lng = parseFloat(searchParams.get('lng'));
  if (!lat || !lng) return NextResponse.json({ name: null });

  // 半径20m以内の名前付き建物を取得（広げると誤って隣接建物を返す）
  const query = `[out:json][timeout:10];(way["building"]["name"](around:20,${lat},${lng});relation["building"]["name"](around:20,${lat},${lng}););out body center;`;

  try {
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' }, next: { revalidate: 86400 } }
    );
    const text = await res.text();
    if (!text.startsWith('{')) return NextResponse.json({ name: null });

    const elements = JSON.parse(text).elements || [];
    if (elements.length === 0) return NextResponse.json({ name: null });

    // 最も近い建物を返す
    let nearest = null;
    let nearestDist = Infinity;
    for (const el of elements) {
      const elLat = el.center?.lat ?? el.lat;
      const elLng = el.center?.lon ?? el.lon;
      if (!elLat || !elLng) continue;
      const d = haversineM(lat, lng, elLat, elLng);
      if (d < nearestDist) { nearestDist = d; nearest = el; }
    }

    const tags = nearest?.tags || {};
    const rawDate = tags['start_date'] || tags['building:start_date'] || tags['construction_date'] || null;
    const yearMatch = rawDate?.match(/^(\d{4})/);
    const builtYear = yearMatch ? parseInt(yearMatch[1]) : null;

    return NextResponse.json({
      name: tags.name ?? null,
      buildingType: tags.building ?? null,
      distanceM: Math.round(nearestDist),
      builtYear,
    });
  } catch {
    return NextResponse.json({ name: null });
  }
}
