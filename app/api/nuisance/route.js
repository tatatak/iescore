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
  if (!lat || !lng) return NextResponse.json({ facilities: [] });

  const query = `[out:json][timeout:15];(
node["amenity"="crematorium"](around:500,${lat},${lng});
way["amenity"="crematorium"](around:500,${lat},${lng});
relation["amenity"="crematorium"](around:500,${lat},${lng});
node["man_made"="waste_treatment_plant"](around:500,${lat},${lng});
way["man_made"="waste_treatment_plant"](around:500,${lat},${lng});
relation["man_made"="waste_treatment_plant"](around:500,${lat},${lng});
node["amenity"="waste_transfer_station"](around:500,${lat},${lng});
way["amenity"="waste_transfer_station"](around:500,${lat},${lng});
way["landuse"="industrial"](around:300,${lat},${lng});
relation["landuse"="industrial"](around:300,${lat},${lng});
way["landuse"="cemetery"](around:300,${lat},${lng});
relation["landuse"="cemetery"](around:300,${lat},${lng});
way["amenity"="grave_yard"](around:300,${lat},${lng});
);out body center;`;

  try {
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' }, next: { revalidate: 86400 } }
    );
    const text = await res.text();
    if (!text.startsWith('{')) return NextResponse.json({ facilities: [] });

    const elements = JSON.parse(text).elements || [];
    if (elements.length === 0) return NextResponse.json({ facilities: [] });

    const facilities = [];
    const seen = new Set();

    for (const el of elements) {
      const elLat = el.center?.lat ?? el.lat;
      const elLng = el.center?.lon ?? el.lon;
      if (!elLat || !elLng) continue;

      const tags = el.tags || {};
      const dist = Math.round(haversineM(lat, lng, elLat, elLng));

      let baseLabel = null, icon = '⚠️';
      if (tags.amenity === 'crematorium')              { baseLabel = '火葬場';       icon = '🪦'; }
      else if (tags.man_made === 'waste_treatment_plant') { baseLabel = '廃棄物処理場'; icon = '🏭'; }
      else if (tags.amenity === 'waste_transfer_station') { baseLabel = 'ゴミ処理施設'; icon = '🗑️'; }
      else if (tags.landuse === 'industrial')          { baseLabel = '工業地帯';     icon = '🏭'; }
      else if (tags.landuse === 'cemetery' || tags.amenity === 'grave_yard') { baseLabel = '墓地'; icon = '⛩️'; }
      if (!baseLabel) continue;

      const label = tags.name ? `${baseLabel}（${tags.name}）` : baseLabel;
      const key = `${baseLabel}:${tags.name || el.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      facilities.push({ label, icon, distanceM: dist });
    }

    facilities.sort((a, b) => a.distanceM - b.distanceM);
    return NextResponse.json({ facilities });
  } catch {
    return NextResponse.json({ facilities: [] });
  }
}
