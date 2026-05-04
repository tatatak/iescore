import { NextResponse } from 'next/server';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let cachedFeatures = null;
function getFeatures() {
  if (!cachedFeatures) {
    const dir = join(process.cwd(), 'public/data');
    const files = readdirSync(dir).filter(f => f.startsWith('reform_') && f.endsWith('.geojson'));
    cachedFeatures = files.flatMap(f =>
      JSON.parse(readFileSync(join(dir, f), 'utf-8')).features
    );
  }
  return cachedFeatures;
}

const RADIUS_M = 1500;
const LAT_DELTA = (RADIUS_M / 111000) * 1.1;        // 緯度方向の余裕（約0.015度）
const LNG_DELTA = (RADIUS_M / 91000) * 1.1;          // 経度方向の余裕（東京付近）

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat'));
  const lng = parseFloat(searchParams.get('lng'));
  if (!lat || !lng) return NextResponse.json([]);

  try {
    const latMin = lat - LAT_DELTA, latMax = lat + LAT_DELTA;
    const lngMin = lng - LNG_DELTA, lngMax = lng + LNG_DELTA;

    const nearby = getFeatures()
      // バウンディングボックスで事前絞り込み（haversine対象を激減）
      .filter(f => {
        const [fLng, fLat] = f.geometry.coordinates;
        return fLat >= latMin && fLat <= latMax && fLng >= lngMin && fLng <= lngMax;
      })
      .map(f => ({
        name: f.properties.name,
        address: f.properties.address,
        tel: f.properties.tel,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        dist: haversineM(lat, lng, f.geometry.coordinates[1], f.geometry.coordinates[0]),
      }))
      .filter(f => f.dist <= RADIUS_M)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 30);

    return NextResponse.json(nearby);
  } catch {
    return NextResponse.json([]);
  }
}
