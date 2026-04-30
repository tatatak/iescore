import { NextResponse } from 'next/server';

const REINFOLIB_API_KEY = process.env.REINFOLIB_API_KEY;

// 都道府県名 → JIS2桁プレフィックス
const PREF_TO_PREFIX = {
  '北海道':'01','青森県':'02','岩手県':'03','宮城県':'04','秋田県':'05','山形県':'06','福島県':'07',
  '茨城県':'08','栃木県':'09','群馬県':'10','埼玉県':'11','千葉県':'12','東京都':'13','神奈川県':'14',
  '新潟県':'15','富山県':'16','石川県':'17','福井県':'18','山梨県':'19','長野県':'20','岐阜県':'21',
  '静岡県':'22','愛知県':'23','三重県':'24','滋賀県':'25','京都府':'26','大阪府':'27','兵庫県':'28',
  '奈良県':'29','和歌山県':'30','鳥取県':'31','島根県':'32','岡山県':'33','広島県':'34','山口県':'35',
  '徳島県':'36','香川県':'37','愛媛県':'38','高知県':'39','福岡県':'40','佐賀県':'41','長崎県':'42',
  '熊本県':'43','大分県':'44','宮崎県':'45','鹿児島県':'46','沖縄県':'47',
};

async function getCityFromHeartRails(lng, lat) {
  const url = `https://geoapi.heartrails.com/api/json?method=searchByGeoLocation&x=${lng}&y=${lat}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  const loc = data?.response?.location?.[0];
  if (!loc) return { city: null, pref: null };
  const raw = loc.city || null;
  const shiIdx = raw ? raw.indexOf('市') : -1;
  const city =
    shiIdx !== -1 && raw.endsWith('区') && shiIdx < raw.length - 1
      ? raw.slice(0, shiIdx + 1)
      : raw;
  return { city, pref: loc.prefecture || null };
}

async function getJisCodeByName(city, jisPrefix) {
  const query = `[out:json][timeout:15];rel["name"="${city}"]["boundary"="administrative"]["ref"]["admin_level"~"^[6-8]$"];out tags;`;
  const res = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    { headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' }, cache: 'no-store' }
  );
  const text = await res.text();
  if (!text.startsWith('{')) return null;
  const data = JSON.parse(text);
  const elements = data.elements || [];
  const target = jisPrefix
    ? elements.find(el => String(el.tags?.ref || '').startsWith(jisPrefix))
    : elements[0];
  const ref = String(target?.tags?.ref || '');
  return ref.length >= 5 ? ref.slice(0, 5) : null;
}

async function getMuniCode(lng, lat) {
  const { city, pref } = await getCityFromHeartRails(lng, lat);
  if (!city) return { code: null, name: null };
  const jisPrefix = PREF_TO_PREFIX[pref] || null;
  const code = await getJisCodeByName(city, jisPrefix);
  return { code, name: city };
}

// REINFOLIB 成約価格情報を取得
async function fetchReinfolib(prefCode, cityCode, year) {
  const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/XIT001?year=${year}&area=${prefCode}&city=${cityCode}&priceClassification=02&Language=ja`;
  const res = await fetch(url, {
    headers: { 'Ocp-Apim-Subscription-Key': REINFOLIB_API_KEY },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.status === 'OK' && Array.isArray(json.data) ? json.data : [];
}

// "2024年第3四半期" → 20243（ソート用）
function periodToNum(period) {
  const m = period?.match(/(\d{4})年第(\d)四半期/);
  return m ? parseInt(m[1]) * 10 + parseInt(m[2]) : 0;
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
      return NextResponse.json({ error: 'area not found' }, { status: 404 });
    }

    const prefCode = muniCode.slice(0, 2);

    // 直近データを取得（2025 → 2024 → 2023 の順で試す）
    let allData = [];
    for (const year of [2025, 2024, 2023]) {
      const data = await fetchReinfolib(prefCode, muniCode, year);
      if (data.length > 0) { allData = data; break; }
    }

    if (allData.length === 0) {
      return NextResponse.json({ muniCode, muniName, condos: { count: 0, avgUnitPrice: null }, houses: { count: 0, avgPrice: null }, records: [] });
    }

    // 中古マンション統計
    const condos = allData.filter(d => d.Type === '中古マンション等' && d.TradePrice && parseFloat(d.Area) > 0);
    const avgUnitPrice = condos.length > 0
      ? Math.round(condos.reduce((s, d) => s + parseInt(d.TradePrice) / parseFloat(d.Area), 0) / condos.length / 10000)
      : null;

    // 宅地（土地+建物）統計
    const houses = allData.filter(d => d.Type === '宅地(土地と建物)' && d.TradePrice);
    const avgHousePrice = houses.length > 0
      ? Math.round(houses.reduce((s, d) => s + parseInt(d.TradePrice), 0) / houses.length / 10000)
      : null;

    // 最新10件の中古マンション
    const records = [...condos]
      .sort((a, b) => periodToNum(b.Period) - periodToNum(a.Period))
      .slice(0, 10)
      .map(d => ({
        district: d.DistrictName,
        price: Math.round(parseInt(d.TradePrice) / 10000),
        area: parseFloat(d.Area),
        unitPrice: Math.round(parseInt(d.TradePrice) / parseFloat(d.Area) / 10000),
        buildingYear: d.BuildingYear?.replace('年', '') || '',
        floorPlan: d.FloorPlan || '',
        period: d.Period || '',
      }));

    return NextResponse.json({
      muniCode,
      muniName,
      condos: { count: condos.length, avgUnitPrice },
      houses: { count: houses.length, avgPrice: avgHousePrice },
      records,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
