import { NextResponse } from 'next/server';
import muniCodes from '../../data/muniCodes.json';

const REINFOLIB_API_KEY = process.env.REINFOLIB_API_KEY;

// 政令指定都市の市コード+区名 → 区コード（REINFOLIB実データから確認済み）
const WARD_CODES = {
  // さいたま市 (11100)
  '11100|西区':'11101','11100|北区':'11102','11100|大宮区':'11103','11100|見沼区':'11104',
  '11100|中央区':'11105','11100|桜区':'11106','11100|浦和区':'11107','11100|南区':'11108',
  '11100|緑区':'11109','11100|岩槻区':'11110',
  // 千葉市 (12100)
  '12100|中央区':'12101','12100|花見川区':'12102','12100|稲毛区':'12103',
  '12100|若葉区':'12104','12100|緑区':'12105','12100|美浜区':'12106',
  // 横浜市 (14100) — REINFOLIB実順序
  '14100|鶴見区':'14101','14100|神奈川区':'14102','14100|西区':'14103','14100|中区':'14104',
  '14100|南区':'14105','14100|保土ケ谷区':'14106','14100|磯子区':'14107','14100|金沢区':'14108',
  '14100|港北区':'14109','14100|戸塚区':'14110','14100|港南区':'14111','14100|旭区':'14112',
  '14100|緑区':'14113','14100|瀬谷区':'14114','14100|栄区':'14115','14100|泉区':'14116',
  '14100|青葉区':'14117','14100|都筑区':'14118',
  // 川崎市 (14130) — REINFOLIB実順序
  '14130|川崎区':'14131','14130|幸区':'14132','14130|中原区':'14133','14130|高津区':'14134',
  '14130|多摩区':'14135','14130|宮前区':'14136','14130|麻生区':'14137',
  // 相模原市 (14150)
  '14150|緑区':'14151','14150|中央区':'14152','14150|南区':'14153',
  // 新潟市 (15100)
  '15100|北区':'15101','15100|東区':'15102','15100|中央区':'15103','15100|江南区':'15104',
  '15100|秋葉区':'15105','15100|南区':'15106','15100|西区':'15107','15100|西蒲区':'15108',
  // 静岡市 (22100)
  '22100|葵区':'22101','22100|駿河区':'22102','22100|清水区':'22103',
  // 浜松市 (22130) — 2024年再編後
  '22130|中央区':'22138','22130|浜名区':'22139','22130|天竜区':'22140',
  // 名古屋市 (23100)
  '23100|千種区':'23101','23100|東区':'23102','23100|北区':'23103','23100|西区':'23104',
  '23100|中村区':'23105','23100|中区':'23106','23100|昭和区':'23107','23100|瑞穂区':'23108',
  '23100|熱田区':'23109','23100|中川区':'23110','23100|港区':'23111','23100|南区':'23112',
  '23100|守山区':'23113','23100|緑区':'23114','23100|名東区':'23115','23100|天白区':'23116',
  // 京都市 (26100)
  '26100|北区':'26101','26100|上京区':'26102','26100|左京区':'26103','26100|中京区':'26104',
  '26100|東山区':'26105','26100|下京区':'26106','26100|南区':'26107','26100|右京区':'26108',
  '26100|伏見区':'26109','26100|山科区':'26110','26100|西京区':'26111',
  // 大阪市 (27100) — REINFOLIB実順序（JIS標準と異なる）
  '27100|都島区':'27102','27100|福島区':'27103','27100|此花区':'27104','27100|西区':'27106',
  '27100|港区':'27107','27100|大正区':'27108','27100|天王寺区':'27109','27100|浪速区':'27111',
  '27100|西淀川区':'27113','27100|東淀川区':'27114','27100|東成区':'27115','27100|生野区':'27116',
  '27100|旭区':'27117','27100|城東区':'27118','27100|阿倍野区':'27119','27100|住吉区':'27120',
  '27100|東住吉区':'27121','27100|西成区':'27122','27100|淀川区':'27123','27100|鶴見区':'27124',
  '27100|住之江区':'27125','27100|平野区':'27126','27100|北区':'27127','27100|中央区':'27128',
  // 堺市 (27140)
  '27140|堺区':'27141','27140|中区':'27142','27140|東区':'27143','27140|西区':'27144',
  '27140|南区':'27145','27140|北区':'27146','27140|美原区':'27147',
  // 神戸市 (28100)
  '28100|東灘区':'28101','28100|灘区':'28102','28100|兵庫区':'28105','28100|長田区':'28106',
  '28100|須磨区':'28107','28100|垂水区':'28108','28100|北区':'28109','28100|中央区':'28110',
  '28100|西区':'28111',
  // 岡山市 (33100)
  '33100|北区':'33101','33100|中区':'33102','33100|東区':'33103','33100|南区':'33104',
  // 広島市 (34100)
  '34100|中区':'34101','34100|東区':'34102','34100|南区':'34103','34100|西区':'34104',
  '34100|安佐南区':'34105','34100|安佐北区':'34106','34100|安芸区':'34107','34100|佐伯区':'34108',
  // 北九州市 (40100)
  '40100|門司区':'40101','40100|若松区':'40103','40100|戸畑区':'40105',
  '40100|小倉北区':'40106','40100|小倉南区':'40107','40100|八幡東区':'40108','40100|八幡西区':'40109',
  // 福岡市 (40130)
  '40130|東区':'40131','40130|博多区':'40132','40130|中央区':'40133','40130|南区':'40134',
  '40130|西区':'40135','40130|城南区':'40136','40130|早良区':'40137',
  // 熊本市 (43100)
  '43100|中央区':'43101','43100|東区':'43102','43100|西区':'43103','43100|南区':'43104','43100|北区':'43105',
};

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

// 政令指定都市の区名を取得（Overpass不使用・HeartRailsのみ）
async function getWardName(lng, lat) {
  try {
    const url = `https://geoapi.heartrails.com/api/json?method=searchByGeoLocation&x=${lng}&y=${lat}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    const raw = data?.response?.location?.[0]?.city || '';
    const shiIdx = raw.indexOf('市');
    if (shiIdx !== -1 && raw.endsWith('区') && shiIdx < raw.length - 1) {
      return raw.slice(shiIdx + 1); // "川崎市麻生区" → "麻生区"
    }
    return null;
  } catch { return null; }
}

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
  if (jisPrefix && muniCodes[`${jisPrefix}|${city}`]) {
    return muniCodes[`${jisPrefix}|${city}`];
  }

  // 静的テーブルにない町・村はOverpassで引く
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
  // population API がすでに解決した muniCode を直接受け取れる（Overpass の二重呼び出しを防ぐ）
  const passedCode = searchParams.get('muniCode');
  const passedName = searchParams.get('muniName') || '';

  if (!passedCode && !lng) {
    return NextResponse.json({ error: 'muniCode or lng/lat required' }, { status: 400 });
  }

  try {
    let muniCode = passedCode;
    let muniName = passedName;

    if (!muniCode) {
      if (!lat) return NextResponse.json({ error: 'lat required' }, { status: 400 });
      const result = await getMuniCode(lng, lat);
      muniCode = result.code;
      muniName = result.name;
    }

    if (!muniCode) {
      return NextResponse.json({ error: 'area not found' }, { status: 404 });
    }

    const prefCode = muniCode.slice(0, 2);

    // 政令指定都市は市コードでデータなし → 区コードに変換して再試行
    // lng/lat が渡されている場合は HeartRails で区名を取得（Overpass不使用）
    let effectiveCode = muniCode;
    if (lng && lat) {
      const wardName = await getWardName(lng, lat);
      if (wardName) {
        const wardCode = WARD_CODES[`${muniCode}|${wardName}`];
        if (wardCode) effectiveCode = wardCode;
      }
    }

    // 直近3年分を並列取得して結合（年ごとの件数バラつきを吸収）
    const [data2025, data2024, data2023] = await Promise.all([
      fetchReinfolib(prefCode, effectiveCode, 2025),
      fetchReinfolib(prefCode, effectiveCode, 2024),
      fetchReinfolib(prefCode, effectiveCode, 2023),
    ]);
const allData = [...data2025, ...data2024, ...data2023];

    if (allData.length === 0) {
      return NextResponse.json({ muniCode, muniName, condos: { count: 0, avgUnitPrice: null }, houses: { count: 0, avgPrice: null }, records: [] });
    }

    // 中古マンション統計
    const condos = allData.filter(d => d.Type === '中古マンション等' && d.TradePrice && parseFloat(d.Area) > 0);
    const avgUnitPrice = condos.length > 0
      ? Math.round(condos.reduce((s, d) => s + parseInt(d.TradePrice) / parseFloat(d.Area), 0) / condos.length / 10000)
      : null;
    const avgPrice = condos.length > 0
      ? Math.round(condos.reduce((s, d) => s + parseInt(d.TradePrice), 0) / condos.length / 10000)
      : null;
    const avgArea = condos.length > 0
      ? Math.round(condos.reduce((s, d) => s + parseFloat(d.Area), 0) / condos.length)
      : null;

    // 年代別単価（耐震基準に基づく区分）
    const eraRanges = [
      { key: 'pre1982',  label: '旧耐震 ～1982',  min: 0,    max: 1982 },
      { key: 'era1983',  label: '新耐震 1983～99', min: 1983, max: 1999 },
      { key: 'era2000',  label: '2000年代',        min: 2000, max: 2010 },
      { key: 'era2011',  label: '2011年以降',      min: 2011, max: 9999 },
    ];
    const eraStats = {};
    for (const era of eraRanges) {
      const subset = condos.filter(d => {
        const yr = parseInt(d.BuildingYear);
        return !isNaN(yr) && yr >= era.min && yr <= era.max;
      });
      eraStats[era.key] = subset.length > 0
        ? {
            label: era.label,
            count: subset.length,
            avgUnitPrice: Math.round(subset.reduce((s, d) => s + parseInt(d.TradePrice) / parseFloat(d.Area), 0) / subset.length / 10000),
            avgPrice: Math.round(subset.reduce((s, d) => s + parseInt(d.TradePrice), 0) / subset.length / 10000),
            avgArea: Math.round(subset.reduce((s, d) => s + parseFloat(d.Area), 0) / subset.length),
          }
        : { label: era.label, count: 0, avgUnitPrice: null, avgPrice: null, avgArea: null };
    }

    // 宅地（土地+建物）統計 - 直近10年以内築に絞り込み（件数不足時は全期間にフォールバック）
    const houses = allData.filter(d => d.Type === '宅地(土地と建物)' && d.TradePrice);
    const currentYear = new Date().getFullYear();
    const recentHouses = houses.filter(d => {
      const yr = parseInt(d.BuildingYear);
      return !isNaN(yr) && yr >= currentYear - 20;
    });
    const housesForStats = recentHouses.length >= 3 ? recentHouses : houses;
    const houseFiltered = recentHouses.length >= 3;
    const avgHousePrice = housesForStats.length > 0
      ? Math.round(housesForStats.reduce((s, d) => s + parseInt(d.TradePrice), 0) / housesForStats.length / 10000)
      : null;
    const housesWithArea = housesForStats.filter(d => parseFloat(d.Area) > 0);
    const avgHousePerSqm = housesWithArea.length > 0
      ? Math.round(housesWithArea.reduce((s, d) => s + parseInt(d.TradePrice) / parseFloat(d.Area), 0) / housesWithArea.length / 10000 * 10) / 10
      : null;

    const mapHouseRecord = d => ({
      type: 'house',
      district: d.DistrictName,
      price: Math.round(parseInt(d.TradePrice) / 10000),
      landArea: parseFloat(d.Area) || null,
      totalFloorArea: parseFloat(d.TotalFloorArea) || null,
      buildingYear: d.BuildingYear?.replace('年', '') || '',
      floorPlan: d.FloorPlan || '',
      period: d.Period || '',
      structure: d.Structure || '',
      nearestStation: d.NearestStation || '',
      timeToStation: d.TimeToNearestStation || '',
      cityPlanning: d.CityPlanning || '',
      coverageRatio: d.CoverageRatio || '',
      floorAreaRatio: d.FloorAreaRatio || '',
      renovation: d.Renovation || '',
      remarks: d.Remarks || '',
    });

    // 最新10件の中古マンション
    const records = [...condos]
      .sort((a, b) => periodToNum(b.Period) - periodToNum(a.Period))
      .slice(0, 10)
      .map(d => ({
        type: 'condo',
        district: d.DistrictName,
        price: Math.round(parseInt(d.TradePrice) / 10000),
        area: parseFloat(d.Area),
        unitPrice: Math.round(parseInt(d.TradePrice) / parseFloat(d.Area) / 10000),
        buildingYear: d.BuildingYear?.replace('年', '') || '',
        floorPlan: d.FloorPlan || '',
        period: d.Period || '',
        structure: d.Structure || '',
        nearestStation: d.NearestStation || '',
        timeToStation: d.TimeToNearestStation || '',
        cityPlanning: d.CityPlanning || '',
        coverageRatio: d.CoverageRatio || '',
        floorAreaRatio: d.FloorAreaRatio || '',
        renovation: d.Renovation || '',
        remarks: d.Remarks || '',
      }));

    // 最新10件の戸建て（直近10年以内築 or 全期間フォールバック）
    const houseRecords = [...housesForStats]
      .sort((a, b) => periodToNum(b.Period) - periodToNum(a.Period))
      .slice(0, 10)
      .map(mapHouseRecord);

    return NextResponse.json({
      muniCode,
      muniName,
      condos: { count: condos.length, avgUnitPrice, avgPrice, avgArea, eraStats },
      houses: { count: housesForStats.length, avgPrice: avgHousePrice, avgPerSqm: avgHousePerSqm, records: houseRecords, filtered: houseFiltered },
      records,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
