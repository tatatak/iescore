import { NextResponse } from 'next/server';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

async function queryOverpass(q) {
  let lastErr;
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q),
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) throw new Error('overpass ' + res.status);
      const data = await res.json();
      // remark が含まれる場合はサーバー側のタイムアウト・エラーなので次のエンドポイントへ
      if (data.remark) throw new Error('overpass remark: ' + data.remark);
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dlat = (lat2 - lat1) * (Math.PI / 180);
  const dlng = (lng2 - lng1) * (Math.PI / 180) * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(dlat * dlat + dlng * dlng) * R;
}

const KONBINI_KEYWORDS = ['セブン', 'ローソン', 'ファミリ', 'ミニストップ', 'デイリー', 'セイコーマート', 'ポプラ', 'ニューデイズ', 'キオスク', 'コンビニ'];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat'));
  const lng = parseFloat(searchParams.get('lng'));
  if (!lat || !lng) return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });

  const q = [
    '[out:json][timeout:7];(',
    `node["shop"~"^(supermarket|convenience)$"](around:1000,${lat},${lng});`,
    `way["shop"~"^(supermarket|convenience)$"](around:1000,${lat},${lng});`,
    `node["highway"="bus_stop"](around:500,${lat},${lng});`,
    `node["amenity"="school"](around:1500,${lat},${lng});`,
    `way["amenity"="school"](around:1500,${lat},${lng});`,
    ');out center;',
  ].join('');

  let supermarkets = 0, supermarkets500 = 0, konbinis = 0, konbinis500 = 0;
  let busStops = 0, busStops200 = 0, schools = 0;
  const supermarketList = [], konbiniList = [], busStopList = [], schoolList = [];

  try {
    const data = await queryOverpass(q);
    const seen = new Set();
    for (const el of data.elements || []) {
      const eLat = el.lat ?? el.center?.lat;
      const eLng = el.lon ?? el.center?.lon;
      if (!eLat || !eLng) continue;
      const key = `${eLat.toFixed(5)},${eLng.toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const d = haversineM(lat, lng, eLat, eLng);
      const tags = el.tags || {};
      const name = tags.name || '';

      if (tags.shop === 'supermarket' || tags.shop === 'convenience') {
        const isKonbini = tags.shop === 'convenience' || KONBINI_KEYWORDS.some(k => name.includes(k));
        if (isKonbini) {
          if (d <= 1000) { konbinis++; if (name) konbiniList.push({ name, distanceM: Math.round(d), lat: eLat, lng: eLng }); }
          if (d <= 500) konbinis500++;
        } else {
          if (d <= 1000) { supermarkets++; if (name) supermarketList.push({ name, distanceM: Math.round(d), lat: eLat, lng: eLng }); }
          if (d <= 500) supermarkets500++;
        }
      } else if (tags.highway === 'bus_stop') {
        if (d <= 500) { busStops++; if (name) busStopList.push({ name, distanceM: Math.round(d), lat: eLat, lng: eLng }); }
        if (d <= 200) busStops200++;
      } else if (tags.amenity === 'school') {
        const ok = name.includes('小学校') || name.includes('中学校') || name.includes('義務教育学校') ||
          /[^\x00-\x7F]小$/.test(name) || /[^\x00-\x7F]中$/.test(name);
        if (ok && !name.includes('専門') && !name.includes('大学') && !name.includes('高校') && d <= 1500) {
          schools++;
          if (name) schoolList.push({ name, distanceM: Math.round(d), lat: eLat, lng: eLng });
        }
      }
    }
    [supermarketList, konbiniList, busStopList, schoolList]
      .forEach(l => l.sort((a, b) => a.distanceM - b.distanceM));
  } catch {
    return NextResponse.json({ error: 'overpass_unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return NextResponse.json({
    supermarkets, supermarkets500, supermarketList,
    konbinis, konbinis500, konbiniList,
    busStops, busStops200, busStopList,
    schools, schoolList,
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
