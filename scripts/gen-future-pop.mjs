// XKT013（将来推計人口250mメッシュ）から全国市区町村の2025→2040変化率を生成
// 実行: node scripts/gen-future-pop.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REINFOLIB_KEY = '91d0dbcd25d349699379c5d97f775a0a';
const OUT_PATH = path.join(__dirname, '../app/area/futurePopData.json');

const PREF_CODES = [
  '01','02','03','04','05','06','07','08','09','10',
  '11','12','13','14','15','16','17','18','19','20',
  '21','22','23','24','25','26','27','28','29','30',
  '31','32','33','34','35','36','37','38','39','40',
  '41','42','43','44','45','46','47',
];

function latLngToTile(lat, lng, z) {
  const n = 1 << z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return [x, y];
}

async function fetchMuniLatLngs(prefCode) {
  const latestYear = new Date().getFullYear() - 1;
  const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/XCT001?year=${latestYear}&area=${prefCode}&division=00&Language=ja`;
  try {
    const res = await fetch(url, { headers: { 'Ocp-Apim-Subscription-Key': REINFOLIB_KEY } });
    if (!res.ok) return {};
    const json = await res.json();
    const data = json.status === 'OK' && Array.isArray(json.data) ? json.data : [];
    const muniMap = {};
    for (const d of data) {
      if (d['標準地番号 用途区分'] !== '住宅地') continue;
      const price = parseInt(d['1㎡当たりの価格']);
      if (!price) continue;
      const lat = parseFloat(d['位置座標 緯度']);
      const lng = parseFloat(d['位置座標 経度']);
      if (!lat || !lng) continue;
      const pref = String(d['標準地番号 市区町村コード 県コード']).padStart(2, '0');
      const muni = String(d['標準地番号 市区町村コード 市区町村コード']).padStart(3, '0');
      const code = pref + muni;
      if (!muniMap[code]) muniMap[code] = { lats: [], lngs: [] };
      muniMap[code].lats.push(lat);
      muniMap[code].lngs.push(lng);
    }
    const result = {};
    for (const [code, d] of Object.entries(muniMap)) {
      if (d.lats.length < 3) continue;
      result[code] = {
        lat: d.lats.reduce((a, b) => a + b, 0) / d.lats.length,
        lng: d.lngs.reduce((a, b) => a + b, 0) / d.lngs.length,
      };
    }
    return result;
  } catch { return {}; }
}

async function fetchXKT013Tile(z, x, y) {
  const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/XKT013?response_format=geojson&z=${z}&x=${x}&y=${y}`;
  try {
    const res = await fetch(url, { headers: { 'Ocp-Apim-Subscription-Key': REINFOLIB_KEY } });
    if (!res.ok) return {};
    const json = await res.json();
    const agg = {};
    for (const f of json.features ?? []) {
      const p = f.properties;
      const code = String(p.SHICODE ?? '').slice(0, 5);
      const p2025 = parseFloat(p.PTN_2025 ?? 0);
      const p2040 = parseFloat(p.PTN_2040 ?? 0);
      if (!code || code.length !== 5 || !p2025) continue;
      if (!agg[code]) agg[code] = { p2025: 0, p2040: 0 };
      agg[code].p2025 += p2025;
      agg[code].p2040 += p2040;
    }
    const result = {};
    for (const [code, { p2025, p2040 }] of Object.entries(agg)) {
      if (p2025 > 0) result[code] = parseFloat(((p2040 - p2025) / p2025 * 100).toFixed(1));
    }
    return result;
  } catch (e) {
    console.warn(`tile ${z}/${x}/${y} failed:`, e.message);
    return {};
  }
}

async function main() {
  console.log('Step 1: Fetching municipality lat/lngs from REINFOLIB...');
  const allMuni = {};
  const PREF_BATCH = 8;
  for (let i = 0; i < PREF_CODES.length; i += PREF_BATCH) {
    const batch = PREF_CODES.slice(i, i + PREF_BATCH);
    const results = await Promise.all(batch.map(p => fetchMuniLatLngs(p)));
    for (const r of results) Object.assign(allMuni, r);
    process.stdout.write(`  ${Math.min(i + PREF_BATCH, PREF_CODES.length)}/47 prefectures done\r`);
  }
  console.log(`\n  Total municipalities: ${Object.keys(allMuni).length}`);

  console.log('Step 2: Computing unique z=12 tiles...');
  const Z = 12;
  const tileMap = new Map();
  for (const [code, { lat, lng }] of Object.entries(allMuni)) {
    const [tx, ty] = latLngToTile(lat, lng, Z);
    const key = `${tx}_${ty}`;
    if (!tileMap.has(key)) tileMap.set(key, { x: tx, y: ty, codes: [] });
    tileMap.get(key).codes.push(code);
  }
  const tiles = [...tileMap.values()];
  console.log(`  Unique tiles: ${tiles.length}`);

  console.log('Step 3: Fetching XKT013 tiles...');
  const merged = {};
  const TILE_BATCH = 20;
  for (let i = 0; i < tiles.length; i += TILE_BATCH) {
    const batch = tiles.slice(i, i + TILE_BATCH);
    const results = await Promise.all(batch.map(t => fetchXKT013Tile(Z, t.x, t.y)));
    for (const r of results) Object.assign(merged, r);
    process.stdout.write(`  ${Math.min(i + TILE_BATCH, tiles.length)}/${tiles.length} tiles done\r`);
  }
  console.log(`\n  Total municipalities with future data: ${Object.keys(merged).length}`);

  console.log(`Step 4: Saving to ${OUT_PATH}...`);
  fs.writeFileSync(OUT_PATH, JSON.stringify(merged));
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
