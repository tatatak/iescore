import { NextResponse } from 'next/server';

const REINFOLIB_KEY = process.env.REINFOLIB_API_KEY;

// S12_009=2011, +4ずつ（エージェント情報。実フィールド名はdebug=1で確認）
const YEAR_FIELDS = {
  2019: 'S12_041', 2020: 'S12_045',
  2021: 'S12_049', 2022: 'S12_053', 2023: 'S12_057',
};

function toTile(lat, lng, z = 13) {
  const n = Math.pow(2, z);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y, z };
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchTile(x, y, z) {
  const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/XKT015?response_format=geojson&z=${z}&x=${x}&y=${y}`;
  const res = await fetch(url, {
    headers: { 'Ocp-Apim-Subscription-Key': REINFOLIB_KEY },
    next: { revalidate: 86400 * 30 },
  });
  if (!res.ok) return null;
  return res.json();
}

function parseFeature(f, lat, lng) {
  const geom = f.geometry;
  if (!geom?.coordinates?.length) return null;
  let flng, flat;
  if (geom.type === 'Point') {
    [flng, flat] = geom.coordinates;
  } else if (geom.type === 'LineString') {
    [flng, flat] = geom.coordinates[Math.floor(geom.coordinates.length / 2)];
  } else {
    return null;
  }
  const distM = Math.round(haversineM(lat, lng, flat, flng));
  const p = f.properties ?? {};

  const name = p.S12_001_ja ?? p.S12_004_ja ?? p.S12_004 ?? null;
  const line = p.S12_003_ja ?? p.S12_003 ?? null;
  const operator = p.S12_002_ja ?? p.S12_005_ja ?? p.S12_005 ?? null;

  const yearly = {};
  for (const [year, field] of Object.entries(YEAR_FIELDS)) {
    const v = p[field];
    if (v != null && v > 0) yearly[parseInt(year)] = Math.round(v);
  }

  const base = yearly[2019];
  const latest = yearly[2023];
  const trend = base > 0 && latest > 0
    ? Math.round((latest / base - 1) * 100)
    : null;

  return { name, operator, line, distM, yearly, trend };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat'));
  const lng = parseFloat(searchParams.get('lng'));
  const debug = searchParams.get('debug') === '1';
  if (!lat || !lng) return NextResponse.json({ stations: [] }, { status: 400 });

  const { x, y, z } = toTile(lat, lng);

  // debug=1 のとき: 中心タイルのみ返す（デバッグ用）
  if (debug) {
    const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/XKT015?response_format=geojson&z=${z}&x=${x}&y=${y}`;
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': REINFOLIB_KEY },
      next: { revalidate: 86400 * 30 },
    });
    const raw = await res.text();
    return NextResponse.json({
      httpStatus: res.status,
      tile: { z, x, y },
      url,
      raw: raw.slice(0, 2000),
    });
  }

  try {
    // 3×3グリッド（9タイル）を並列取得。タイル境界付近の駅も取りこぼさないようにする
    const tileFetches = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        tileFetches.push(fetchTile(x + dx, y + dy, z));
      }
    }
    const tileResults = await Promise.allSettled(tileFetches);

    // 全タイルのfeaturesをマージ（重複は駅名+路線名でdedup）
    const seen = new Set();
    const allFeatures = [];
    for (const r of tileResults) {
      if (r.status !== 'fulfilled' || !r.value?.features?.length) continue;
      for (const f of r.value.features) {
        const p = f.properties ?? {};
        const key = `${p.S12_001_ja ?? p.S12_004_ja}__${p.S12_003_ja}`;
        if (seen.has(key)) continue;
        seen.add(key);
        allFeatures.push(f);
      }
    }

    const stations = allFeatures
      .map(f => parseFeature(f, lat, lng))
      .filter(s => s?.name && s.distM < 2000)
      .sort((a, b) => a.distM - b.distM)
      .slice(0, 5);

    return NextResponse.json({ stations });
  } catch (e) {
    return NextResponse.json({ stations: [], error: e.message });
  }
}
