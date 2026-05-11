import { NextResponse } from 'next/server';

const REINFOLIB_KEY = process.env.REINFOLIB_API_KEY;
const BASE = 'https://www.reinfolib.mlit.go.jp/ex-api/external';

// lat/lng → XYZ タイル座標（z=15）
function toTile(lat, lng, z = 15) {
  const n = Math.pow(2, z);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y, z };
}

// Point-in-Polygon（ray casting）- GeoJSON座標系 [lng, lat]
function pointInRing(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInFeature(lng, lat, feature) {
  const geom = feature?.geometry;
  if (!geom) return false;
  const inPoly = (rings) =>
    pointInRing(lng, lat, rings[0]) && !rings.slice(1).some(h => pointInRing(lng, lat, h));
  if (geom.type === 'Polygon')      return inPoly(geom.coordinates);
  if (geom.type === 'MultiPolygon') return geom.coordinates.some(inPoly);
  return false;
}

async function fetchTile(endpoint, x, y, z) {
  const url = `${BASE}/${endpoint}?response_format=geojson&z=${z}&x=${x}&y=${y}`;
  const res = await fetch(url, {
    headers: { 'Ocp-Apim-Subscription-Key': REINFOLIB_KEY },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat'));
  const lng = parseFloat(searchParams.get('lng'));
  if (!lat || !lng) return NextResponse.json({ error: 'missing params' }, { status: 400 });

  const { x, y, z } = toTile(lat, lng);

  const [xkt024, xkt003] = await Promise.allSettled([
    fetchTile('XKT024', x, y, z), // 高度利用地区
    fetchTile('XKT003', x, y, z), // 立地適正化計画
  ]);

  const tile024 = xkt024.status === 'fulfilled' ? xkt024.value : null;
  const tile003 = xkt003.status === 'fulfilled' ? xkt003.value : null;

  // 高度利用地区：点がポリゴン内に含まれるか
  const kouDoFeature = tile024?.features?.find(f => pointInFeature(lng, lat, f));
  const isKoudo = !!kouDoFeature;

  // 立地適正化計画：都市機能誘導区域に含まれるか
  const toshiFeature = tile003?.features?.find(f => {
    const k = f?.properties?.kubun_name_ja ?? '';
    return k.includes('都市機能誘導') && pointInFeature(lng, lat, f);
  });
  // 居住誘導区域（都市機能誘導より弱いシグナル）
  const kyojuFeature = !toshiFeature && tile003?.features?.find(f => {
    const k = f?.properties?.kubun_name_ja ?? '';
    return k.includes('居住誘導') && pointInFeature(lng, lat, f);
  });

  return NextResponse.json({
    isKoudo,                                           // 高度利用地区に該当
    isToshi: !!toshiFeature,                           // 都市機能誘導区域に該当
    isKyoju: !!kyojuFeature,                           // 居住誘導区域に該当（弱シグナル）
    kouDoName: kouDoFeature?.properties?.advanced_name ?? null,
    toshiName: toshiFeature?.properties?.kubun_name_ja ?? kyojuFeature?.properties?.kubun_name_ja ?? null,
  });
}
