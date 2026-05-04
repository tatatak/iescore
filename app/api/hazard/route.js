import { NextResponse } from 'next/server';
import { PNG } from 'pngjs';

function lonLatToTile(lon, lat, z) {
  const n = Math.pow(2, z);
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

function lonLatToPixel(lon, lat, z, tx, ty) {
  const n = Math.pow(2, z);
  const px = Math.floor(((lon + 180) / 360 * n - tx) * 256);
  const latRad = lat * Math.PI / 180;
  const py = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n - ty) * 256);
  return { px: Math.min(255, Math.max(0, px)), py: Math.min(255, Math.max(0, py)) };
}

// 指定URLのタイルを取得してピクセルの RGBA を返す。タイルが存在しない場合は null
async function getPixel(url, px, py) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const png = PNG.sync.read(buf);
  const idx = (py * png.width + px) * 4;
  return { r: png.data[idx], g: png.data[idx + 1], b: png.data[idx + 2], a: png.data[idx + 3] };
}

// ---- 洪水浸水 ----
const FLOOD_PALETTE = [
  { label: '0〜0.5m未満', score: 8, r: 249, g: 240, b: 149 },
  { label: '0.5〜3m未満', score: 6, r: 249, g: 198, b: 0   },
  { label: '3〜5m未満',   score: 4, r: 242, g: 151, b: 0   },
  { label: '5〜10m未満',  score: 3, r: 229, g: 60,  b: 0   },
  { label: '10〜20m未満', score: 2, r: 195, g: 20,  b: 0   },
  { label: '20m以上',     score: 1, r: 130, g: 0,   b: 0   },
];

function classifyFlood(r, g, b, a) {
  if (a < 10) return { label: null, score: 10 };
  let best = FLOOD_PALETTE[0], bestDist = Infinity;
  for (const p of FLOOD_PALETTE) {
    const d = (r - p.r) ** 2 + (g - p.g) ** 2 + (b - p.b) ** 2;
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return { label: best.label, score: best.score };
}

async function fetchFloodData(lon, lat, z) {
  const { x, y } = lonLatToTile(lon, lat, z);
  const { px, py } = lonLatToPixel(lon, lat, z, x, y);
  const url = `https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/${z}/${x}/${y}.png`;
  const pixel = await getPixel(url, px, py).catch(() => null);
  if (!pixel) return null; // タイル404 → 別ズームでリトライ
  return classifyFlood(pixel.r, pixel.g, pixel.b, pixel.a);
}

// ---- 高潮浸水（台風・低気圧による海面上昇）----
async function fetchHightideData(lon, lat, z) {
  const { x, y } = lonLatToTile(lon, lat, z);
  const { px, py } = lonLatToPixel(lon, lat, z, x, y);
  const url = `https://disaportaldata.gsi.go.jp/raster/03_hightide_shinsuishin_data/${z}/${x}/${y}.png`;
  const pixel = await getPixel(url, px, py).catch(() => null);
  if (!pixel) return null;
  return classifyFlood(pixel.r, pixel.g, pixel.b, pixel.a); // 同パレット
}

// ---- 津波浸水 ----
async function fetchTsunamiData(lon, lat, z) {
  const { x, y } = lonLatToTile(lon, lat, z);
  const { px, py } = lonLatToPixel(lon, lat, z, x, y);
  const url = `https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/${z}/${x}/${y}.png`;
  const pixel = await getPixel(url, px, py).catch(() => null);
  if (!pixel) return null;
  return classifyFlood(pixel.r, pixel.g, pixel.b, pixel.a); // 同パレット
}

// ---- 土砂災害 ----
const LANDSLIDE_TILE_BASES = [
  { label: '土石流',   base: '05_dosekiryukeikaikuiki' },
  { label: '地すべり', base: '05_jisuberikeikaikuiki'   },
  { label: '急傾斜地', base: '05_kyukeishakeikaikuiki'  },
];

async function fetchLandslideData(lon, lat, z) {
  const { x, y } = lonLatToTile(lon, lat, z);
  const { px, py } = lonLatToPixel(lon, lat, z, x, y);

  const results = await Promise.all(
    LANDSLIDE_TILE_BASES.map(async ({ label, base }) => {
      const url = `https://disaportaldata.gsi.go.jp/raster/${base}/${z}/${x}/${y}.png`;
      const pixel = await getPixel(url, px, py).catch(() => null);
      return { label, pixel };
    })
  );

  // 全タイルが404の場合はズームフォールバック用に null を返す
  const anyTileFound = results.some(r => r.pixel !== null);
  if (!anyTileFound) return null;

  const hits = results.filter(r => r.pixel !== null && r.pixel.a > 10);
  if (hits.length === 0) return { label: null, score: 10 }; // タイルはあるが対象外

  const hitLabels = hits.map(h => h.label);
  const score = hitLabels.includes('土石流') ? 2 : 4;
  return { label: hitLabels.join('・') + '警戒区域あり', score };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lng = searchParams.get('lng');
  const lat = searchParams.get('lat');
  if (!lng || !lat) return NextResponse.json({ error: 'lng and lat required' }, { status: 400 });

  const lon = parseFloat(lng);
  const latN = parseFloat(lat);

  try {
    // 標高 + 洪水z14 + 土砂z14 + 高潮z14 + 津波z14 を並行取得
    const [elevRes, floodZ14, landslideZ14, hightideZ14, tsunamiZ14] = await Promise.all([
      fetch(
        `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lng}&lat=${lat}&outtype=JSON`,
        { cache: 'no-store' }
      ).then(r => r.json()).catch(() => null),
      fetchFloodData(lon, latN, 14).catch(() => null),
      fetchLandslideData(lon, latN, 14).catch(() => null),
      fetchHightideData(lon, latN, 14).catch(() => null),
      fetchTsunamiData(lon, latN, 14).catch(() => null),
    ]);

    const elevation = typeof elevRes?.elevation === 'number' ? elevRes.elevation : null;

    // 必要な場合のみ z=12 フォールバック
    const floodResult = floodZ14
      ?? await fetchFloodData(lon, latN, 12).catch(() => null)
      ?? { label: null, score: 10 };

    const landslideResult = landslideZ14
      ?? await fetchLandslideData(lon, latN, 12).catch(() => null)
      ?? { label: null, score: 10 };

    const hightideResult = hightideZ14
      ?? await fetchHightideData(lon, latN, 12).catch(() => null)
      ?? { label: null, score: 10 };

    const tsunamiResult = tsunamiZ14
      ?? await fetchTsunamiData(lon, latN, 12).catch(() => null)
      ?? { label: null, score: 10 };

    return NextResponse.json({
      elevation,
      floodScore:      floodResult.score,
      floodLabel:      floodResult.label,
      landslideScore:  landslideResult.score,
      landslideLabel:  landslideResult.label,
      hightideScore:   hightideResult.score,
      hightideLabel:   hightideResult.label,
      tsunamiScore:    tsunamiResult.score,
      tsunamiLabel:    tsunamiResult.label,
      score: Math.min(floodResult.score, landslideResult.score, hightideResult.score, tsunamiResult.score),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
