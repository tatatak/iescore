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

async function fetchPng(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return PNG.sync.read(buf);
}

// 5×5近傍グリッドの最悪（最低スコア）分類を返す。座標周辺50m相当の最大リスクを取得
function classifyWorstInGrid(palette, png, cx, cy) {
  let worst = { label: null, score: 10 };
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const px = Math.min(255, Math.max(0, cx + dx));
      const py = Math.min(255, Math.max(0, cy + dy));
      const idx = (py * png.width + px) * 4;
      const r = png.data[idx], g = png.data[idx + 1], b = png.data[idx + 2], a = png.data[idx + 3];
      if (a < 10) continue;
      let best = palette[0], bestDist = Infinity;
      for (const p of palette) {
        const d = (r - p.r) ** 2 + (g - p.g) ** 2 + (b - p.b) ** 2;
        if (d < bestDist) { bestDist = d; best = p; }
      }
      if (best.score < worst.score) worst = best;
    }
  }
  return worst;
}

// ---- 洪水浸水 ----
// 国土地理院 公式凡例画像 shinsui_legend3.png から全色を実測（2026-05-27）
// disaportaldata ラスタータイルのピクセル色と完全一致することを確認済み
const FLOOD_PALETTE = [
  { label: '0〜0.5m未満', score: 8, r: 247, g: 245, b: 169 }, // 淡黄（公式凡例）
  { label: '0.5〜3m未満', score: 6, r: 255, g: 216, b: 192 }, // ピーチ（公式凡例）
  { label: '3〜5m未満',   score: 4, r: 255, g: 183, b: 183 }, // ライトピンク（公式凡例）
  { label: '5〜10m未満',  score: 3, r: 255, g: 145, b: 145 }, // コーラル（公式凡例）
  { label: '10〜20m未満', score: 2, r: 242, g: 133, b: 201 }, // ピンクパープル（公式凡例）
  { label: '20m以上',     score: 1, r: 220, g: 122, b: 220 }, // パープル（公式凡例）
];

async function fetchFloodData(lon, lat, z) {
  const { x, y } = lonLatToTile(lon, lat, z);
  const { px, py } = lonLatToPixel(lon, lat, z, x, y);
  const url = `https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/${z}/${x}/${y}.png`;
  const png = await fetchPng(url).catch(() => null);
  if (!png) return null;
  return classifyWorstInGrid(FLOOD_PALETTE, png, px, py);
}

// ---- 高潮浸水 ----
// disaportaldata の 03_hightide タイルは全域で404（国交省がラスタータイル未提供）
// スコアを null として返し、エリアスコア計算から除外する
// 沿岸エリアで常に10/10を返すバグを防ぐ
async function fetchHightideData(_lon, _lat, _z) {
  return null;
}

// ---- 津波浸水 ----
// disaportaldata 04_tsunami_newlegend_data
// 洪水タイルとは異なる黄色〜ピーチ系グラデーション
// 実測値: 255,255,179(薄黄) / 248,225,166(薄橙) / 255,216,192(ピーチ) / 255,183,183(ピンク) / 255,145,145(濃ピンク)
const TSUNAMI_PALETTE = [
  { label: '0〜0.5m未満', score: 8, r: 255, g: 255, b: 179 },
  { label: '0.5〜3m未満', score: 6, r: 248, g: 225, b: 166 },
  { label: '3〜5m未満',   score: 4, r: 255, g: 216, b: 192 },
  { label: '5〜10m未満',  score: 3, r: 255, g: 183, b: 183 },
  { label: '10〜20m未満', score: 2, r: 255, g: 145, b: 145 },
  { label: '20m以上',     score: 1, r: 200, g: 80,  b: 80  },
];

async function fetchTsunamiData(lon, lat, z) {
  const { x, y } = lonLatToTile(lon, lat, z);
  const { px, py } = lonLatToPixel(lon, lat, z, x, y);
  const url = `https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/${z}/${x}/${y}.png`;
  const png = await fetchPng(url).catch(() => null);
  if (!png) return null;
  return classifyWorstInGrid(TSUNAMI_PALETTE, png, px, py);
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
      const png = await fetchPng(url).catch(() => null);
      if (!png) return { label, pixel: null };
      const idx = (py * png.width + px) * 4;
      return { label, pixel: { r: png.data[idx], g: png.data[idx+1], b: png.data[idx+2], a: png.data[idx+3] } };
    })
  );

  const anyTileFound = results.some(r => r.pixel !== null);
  if (!anyTileFound) return null;

  const hits = results.filter(r => r.pixel !== null && r.pixel.a > 10);
  if (hits.length === 0) return { label: null, score: 10 };

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
    const [elevRes, floodZ14, landslideZ14, tsunamiZ14] = await Promise.all([
      fetch(
        `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lng}&lat=${lat}&outtype=JSON`,
        { cache: 'no-store' }
      ).then(r => r.json()).catch(() => null),
      fetchFloodData(lon, latN, 14).catch(() => null),
      fetchLandslideData(lon, latN, 14).catch(() => null),
      fetchTsunamiData(lon, latN, 14).catch(() => null),
    ]);

    const elevation = typeof elevRes?.elevation === 'number' ? elevRes.elevation : null;

    const floodResult = floodZ14
      ?? await fetchFloodData(lon, latN, 12).catch(() => null)
      ?? { label: null, score: 10 };

    const landslideResult = landslideZ14
      ?? await fetchLandslideData(lon, latN, 12).catch(() => null)
      ?? { label: null, score: 10 };

    // 高潮: データ未提供のため null（スコア計算から除外）
    const hightideResult = null;

    const tsunamiResult = tsunamiZ14
      ?? await fetchTsunamiData(lon, latN, 12).catch(() => null)
      ?? { label: null, score: 10 };

    const hazardMin = Math.min(floodResult.score, landslideResult.score, tsunamiResult.score);

    return NextResponse.json({
      elevation,
      floodScore:      floodResult.score,
      floodLabel:      floodResult.label,
      landslideScore:  landslideResult.score,
      landslideLabel:  landslideResult.label,
      hightideScore:   null,
      hightideLabel:   null,
      tsunamiScore:    tsunamiResult.score,
      tsunamiLabel:    tsunamiResult.label,
      score: hazardMin,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
