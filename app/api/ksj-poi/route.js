import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// キャッシュ（Lambda warm start で再利用）
let _medical = null;
let _kindergarten = null;

function loadMedical() {
  if (_medical) return _medical;
  const file = path.join(process.cwd(), 'public', 'data', 'ksj-medical.json');
  _medical = JSON.parse(fs.readFileSync(file, 'utf8')).grid;
  return _medical;
}

function loadKindergarten() {
  if (_kindergarten) return _kindergarten;
  const file = path.join(process.cwd(), 'public', 'data', 'ksj-kindergarten.json');
  _kindergarten = JSON.parse(fs.readFileSync(file, 'utf8')).grid;
  return _kindergarten;
}

function gridKey(lat, lng) {
  return `${Math.floor(lat * 10)}_${Math.floor(lng * 10)}`;
}

function distM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dlat = (lat2 - lat1) * (Math.PI / 180);
  const dlng = (lng2 - lng1) * (Math.PI / 180) * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(dlat * dlat + dlng * dlng) * R;
}

function queryGrid(grid, lat, lng, radius) {
  const clat = Math.floor(lat * 10);
  const clng = Math.floor(lng * 10);
  const results = [];
  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      const cell = grid[`${clat + dlat}_${clng + dlng}`];
      if (!cell) continue;
      for (const [fLat, fLng, typeCode, name] of cell) {
        const d = distM(lat, lng, fLat, fLng);
        if (d <= radius) results.push({ name, lat: fLat, lng: fLng, typeCode, distM: Math.round(d) });
      }
    }
  }
  results.sort((a, b) => a.distM - b.distM);
  return results;
}

// 医療機関: typeCode 0=病院, 1=診療所, 2=歯科
const MEDICAL_TYPE = { 0: 'hospital', 1: 'clinic', 2: 'dental' };
// 幼稚園: typeCode 0=幼稚園, 1=認定こども園
const KINDER_TYPE = { 0: 'kindergarten', 1: 'kodomoen' };

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat'));
  const lng = parseFloat(searchParams.get('lng'));
  const radius = parseInt(searchParams.get('radius') || '1500', 10);

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  // 医療機関
  const medResults = queryGrid(loadMedical(), lat, lng, radius);
  const hospitals  = medResults.filter(r => r.typeCode === 0);
  const clinics    = medResults.filter(r => r.typeCode === 1);
  const dentals    = medResults.filter(r => r.typeCode === 2);
  const toMedItem  = r => ({ name: r.name, lat: r.lat, lng: r.lng, type: MEDICAL_TYPE[r.typeCode], distM: r.distM });

  // 幼稚園・こども園
  const kinderResults = queryGrid(loadKindergarten(), lat, lng, radius);
  const kindergartens = kinderResults.filter(r => r.typeCode === 0);
  const kodomoen      = kinderResults.filter(r => r.typeCode === 1);
  const toKinderItem  = r => ({ name: r.name, lat: r.lat, lng: r.lng, type: KINDER_TYPE[r.typeCode], distM: r.distM });

  return NextResponse.json({
    // 医療機関
    hospitals:  hospitals.length,
    hospitals500:  hospitals.filter(r => r.distM <= 500).length,
    hospitalList:  hospitals.slice(0, 20).map(toMedItem),
    clinics:    clinics.length,
    clinics500: clinics.filter(r => r.distM <= 500).length,
    clinicList: clinics.slice(0, 20).map(toMedItem),
    dentals:    dentals.length,
    dentals500: dentals.filter(r => r.distM <= 500).length,
    dentalList: dentals.slice(0, 20).map(toMedItem),
    // 幼稚園・こども園
    kindergartens:  kindergartens.length,
    kindergartens500: kindergartens.filter(r => r.distM <= 500).length,
    kindergartenList: kindergartens.slice(0, 20).map(toKinderItem),
    kodomoen:   kodomoen.length,
    kodomoen500: kodomoen.filter(r => r.distM <= 500).length,
    kodomoenList: kodomoen.slice(0, 20).map(toKinderItem),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
