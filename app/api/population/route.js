import { NextResponse } from 'next/server';

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;

// 国勢調査 市区町村別人口（各年の確認済みstatsDataId）
const CENSUS = [
  { year: 2010, statsDataId: '0003038587' },
  { year: 2015, statsDataId: '0003149040' },
  { year: 2020, statsDataId: '0003445083' },
];

// ISO3166-2-lvl4 → 都道府県名
const ISO_TO_PREF = {
  'JP-01': '北海道',  'JP-02': '青森県',  'JP-03': '岩手県',  'JP-04': '宮城県',
  'JP-05': '秋田県',  'JP-06': '山形県',  'JP-07': '福島県',  'JP-08': '茨城県',
  'JP-09': '栃木県',  'JP-10': '群馬県',  'JP-11': '埼玉県',  'JP-12': '千葉県',
  'JP-13': '東京都',  'JP-14': '神奈川県', 'JP-15': '新潟県', 'JP-16': '富山県',
  'JP-17': '石川県',  'JP-18': '福井県',  'JP-19': '山梨県',  'JP-20': '長野県',
  'JP-21': '岐阜県',  'JP-22': '静岡県',  'JP-23': '愛知県',  'JP-24': '三重県',
  'JP-25': '滋賀県',  'JP-26': '京都府',  'JP-27': '大阪府',  'JP-28': '兵庫県',
  'JP-29': '奈良県',  'JP-30': '和歌山県', 'JP-31': '鳥取県', 'JP-32': '島根県',
  'JP-33': '岡山県',  'JP-34': '広島県',  'JP-35': '山口県',  'JP-36': '徳島県',
  'JP-37': '香川県',  'JP-38': '愛媛県',  'JP-39': '高知県',  'JP-40': '福岡県',
  'JP-41': '佐賀県',  'JP-42': '長崎県',  'JP-43': '熊本県',  'JP-44': '大分県',
  'JP-45': '宮崎県',  'JP-46': '鹿児島県', 'JP-47': '沖縄県',
};

// Nominatim reverse geocoding → 市区町村名 + 都道府県名を取得
async function getCityName(lng, lat) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' },
  });
  const data = await res.json();
  const addr = data?.address;
  if (!addr) return { city: null, pref: null };

  // city を最優先: 政令指定都市は city=川崎市、東京特別区は city=渋谷区 と正しく返る
  const city =
    addr.city || addr.town || addr.city_district || addr.suburb || addr.village || null;
  const isoCode = addr['ISO3166-2-lvl4'];
  const pref = (isoCode && ISO_TO_PREF[isoCode]) || addr.state || null;

  return { city, pref };
}

// Nominatim search → OSM relation ID を取得
async function getOsmRelationId(city, pref) {
  // 「中央区」など全国に同名が複数ある場合は都道府県名で絞り込む
  const q = pref ? `${city} ${pref}` : city;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&featuretype=settlement&countrycodes=jp&limit=3`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' },
  });
  const items = await res.json();

  const rel =
    items.find(i => i.osm_type === 'relation' && i.type === 'administrative') ||
    items.find(i => i.osm_type === 'relation') ||
    items[0];

  return rel?.osm_id ?? null;
}

// Overpass で relation ID から ref タグ（JIS 6桁）を取得
async function getRefByRelationId(osmId) {
  const query = `[out:json][timeout:10];rel(${osmId});out tags 1;`;
  const res = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    { headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' } }
  );
  const text = await res.text();
  if (!text.startsWith('{')) return null;

  const data = JSON.parse(text);
  const el = data.elements?.[0];
  if (!el?.tags?.ref) return null;

  const ref = String(el.tags.ref);
  // OSM ref は 6桁（検査数字付き）の場合があるため e-Stat 用に5桁に切り詰める
  return ref.length >= 5 ? ref.slice(0, 5) : null;
}

// 市区町村コードと名称を取得
async function getMuniCode(lng, lat) {
  const { city, pref } = await getCityName(lng, lat);
  if (!city) return { code: null, name: null };

  const osmId = await getOsmRelationId(city, pref);
  if (!osmId) return { code: null, name: city };

  const code = await getRefByRelationId(osmId);
  return { code, name: city };
}

// e-Stat国勢調査APIから市区町村の総人口を取得
async function fetchPopulation(statsDataId, areaCode) {
  const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${ESTAT_APP_ID}&statsDataId=${statsDataId}&cdArea=${areaCode}&limit=10`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  const json = await res.json();

  const status = json?.GET_STATS_DATA?.RESULT?.STATUS;
  if (status !== 0) return null;

  const dataVal = json?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;
  if (!dataVal) return null;

  const items = Array.isArray(dataVal) ? dataVal : [dataVal];
  const values = items
    .map(obj => parseInt(obj?.$ ?? '0', 10))
    .filter(v => Number.isFinite(v) && v > 0);

  return values.length ? Math.max(...values) : null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lng = searchParams.get('lng');
  const lat = searchParams.get('lat');

  if (!lng || !lat) {
    return NextResponse.json({ error: 'lng and lat required' }, { status: 400 });
  }

  try {
    const { code: muniCode, name: muniName } = await getMuniCode(lng, lat);
    if (!muniCode) {
      return NextResponse.json({ error: 'area not found', muniName }, { status: 404 });
    }

    const results = await Promise.allSettled(
      CENSUS.map(async ({ year, statsDataId }) => {
        const population = await fetchPopulation(statsDataId, muniCode);
        return { year, population };
      })
    );

    const data = results
      .filter(r => r.status === 'fulfilled' && r.value.population !== null)
      .map(r => r.value)
      .sort((a, b) => a.year - b.year);

    return NextResponse.json({ muniCode, muniName, data });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
