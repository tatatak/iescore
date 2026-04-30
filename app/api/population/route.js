import { NextResponse } from 'next/server';

const ESTAT_APP_ID = process.env.ESTAT_APP_ID;

// 国勢調査 市区町村別人口（各年の確認済みstatsDataId）
const CENSUS = [
  { year: 2010, statsDataId: '0003038587' },
  { year: 2015, statsDataId: '0003149040' },
  { year: 2020, statsDataId: '0003445083' },
];

// 都道府県名 → JIS2桁プレフィックス（中央区など全国に同名がある場合に絞り込むため）
const PREF_TO_PREFIX = {
  '北海道':'01','青森県':'02','岩手県':'03','宮城県':'04','秋田県':'05','山形県':'06','福島県':'07',
  '茨城県':'08','栃木県':'09','群馬県':'10','埼玉県':'11','千葉県':'12','東京都':'13','神奈川県':'14',
  '新潟県':'15','富山県':'16','石川県':'17','福井県':'18','山梨県':'19','長野県':'20','岐阜県':'21',
  '静岡県':'22','愛知県':'23','三重県':'24','滋賀県':'25','京都府':'26','大阪府':'27','兵庫県':'28',
  '奈良県':'29','和歌山県':'30','鳥取県':'31','島根県':'32','岡山県':'33','広島県':'34','山口県':'35',
  '徳島県':'36','香川県':'37','愛媛県':'38','高知県':'39','福岡県':'40','佐賀県':'41','長崎県':'42',
  '熊本県':'43','大分県':'44','宮崎県':'45','鹿児島県':'46','沖縄県':'47',
};

// HeartRails GeoAPI で市区町村名・都道府県名を取得（日本サーバー・認証不要・レート制限なし）
async function getCityFromHeartRails(lng, lat) {
  const url = `https://geoapi.heartrails.com/api/json?method=searchByGeoLocation&x=${lng}&y=${lat}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  const loc = data?.response?.location?.[0];
  if (!loc) return { city: null, pref: null };

  // 政令指定都市は "川崎市川崎区" のように市＋区が結合されるため市名だけ抽出
  const raw = loc.city || null;
  const shiIdx = raw ? raw.indexOf('市') : -1;
  const city =
    shiIdx !== -1 && raw.endsWith('区') && shiIdx < raw.length - 1
      ? raw.slice(0, shiIdx + 1)
      : raw;

  return { city, pref: loc.prefecture || null };
}

// Overpass で市区町村名から ref タグ（JIS 6桁）を取得（area index不使用・名前検索）
async function getJisCodeByName(city, jisPrefix) {
  const query = `[out:json][timeout:15];rel["name"="${city}"]["boundary"="administrative"]["ref"]["admin_level"~"^[6-8]$"];out tags;`;
  const res = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    {
      headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' },
      cache: 'no-store',
    }
  );
  const text = await res.text();
  if (!text.startsWith('{')) return null;

  const data = JSON.parse(text);
  const elements = data.elements || [];

  // jisPrefix で都道府県を絞り込む（"中央区" など同名が全国に複数ある場合）
  const target = jisPrefix
    ? elements.find(el => String(el.tags?.ref || '').startsWith(jisPrefix))
    : elements[0];

  const ref = String(target?.tags?.ref || '');
  // OSM ref は 6桁（検査数字付き）の場合があるため e-Stat 用に5桁に切り詰める
  return ref.length >= 5 ? ref.slice(0, 5) : null;
}

// 市区町村コードと名称を取得
async function getMuniCode(lng, lat) {
  const { city, pref } = await getCityFromHeartRails(lng, lat);
  if (!city) return { code: null, name: null };

  const jisPrefix = PREF_TO_PREFIX[pref] || null;
  const code = await getJisCodeByName(city, jisPrefix);
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
