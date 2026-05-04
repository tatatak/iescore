import { NextResponse } from 'next/server';

const REINFOLIB_API_KEY = process.env.REINFOLIB_API_KEY;

const WARD_CODES = {
  '11100|西区':'11101','11100|北区':'11102','11100|大宮区':'11103','11100|見沼区':'11104',
  '11100|中央区':'11105','11100|桜区':'11106','11100|浦和区':'11107','11100|南区':'11108',
  '11100|緑区':'11109','11100|岩槻区':'11110',
  '12100|中央区':'12101','12100|花見川区':'12102','12100|稲毛区':'12103',
  '12100|若葉区':'12104','12100|緑区':'12105','12100|美浜区':'12106',
  '14100|鶴見区':'14101','14100|神奈川区':'14102','14100|西区':'14103','14100|中区':'14104',
  '14100|南区':'14105','14100|保土ケ谷区':'14106','14100|磯子区':'14107','14100|金沢区':'14108',
  '14100|港北区':'14109','14100|戸塚区':'14110','14100|港南区':'14111','14100|旭区':'14112',
  '14100|緑区':'14113','14100|瀬谷区':'14114','14100|栄区':'14115','14100|泉区':'14116',
  '14100|青葉区':'14117','14100|都筑区':'14118',
  '14130|川崎区':'14131','14130|幸区':'14132','14130|中原区':'14133','14130|高津区':'14134',
  '14130|多摩区':'14135','14130|宮前区':'14136','14130|麻生区':'14137',
  '14150|緑区':'14151','14150|中央区':'14152','14150|南区':'14153',
  '15100|北区':'15101','15100|東区':'15102','15100|中央区':'15103','15100|江南区':'15104',
  '15100|秋葉区':'15105','15100|南区':'15106','15100|西区':'15107','15100|西蒲区':'15108',
  '22100|葵区':'22101','22100|駿河区':'22102','22100|清水区':'22103',
  '22130|中央区':'22138','22130|浜名区':'22139','22130|天竜区':'22140',
  '23100|千種区':'23101','23100|東区':'23102','23100|北区':'23103','23100|西区':'23104',
  '23100|中村区':'23105','23100|中区':'23106','23100|昭和区':'23107','23100|瑞穂区':'23108',
  '23100|熱田区':'23109','23100|中川区':'23110','23100|港区':'23111','23100|南区':'23112',
  '23100|守山区':'23113','23100|緑区':'23114','23100|名東区':'23115','23100|天白区':'23116',
  '26100|北区':'26101','26100|上京区':'26102','26100|左京区':'26103','26100|中京区':'26104',
  '26100|東山区':'26105','26100|下京区':'26106','26100|南区':'26107','26100|右京区':'26108',
  '26100|伏見区':'26109','26100|山科区':'26110','26100|西京区':'26111',
  '27100|都島区':'27102','27100|福島区':'27103','27100|此花区':'27104','27100|西区':'27106',
  '27100|港区':'27107','27100|大正区':'27108','27100|天王寺区':'27109','27100|浪速区':'27111',
  '27100|西淀川区':'27113','27100|東淀川区':'27114','27100|東成区':'27115','27100|生野区':'27116',
  '27100|旭区':'27117','27100|城東区':'27118','27100|阿倍野区':'27119','27100|住吉区':'27120',
  '27100|東住吉区':'27121','27100|西成区':'27122','27100|淀川区':'27123','27100|鶴見区':'27124',
  '27100|住之江区':'27125','27100|平野区':'27126','27100|北区':'27127','27100|中央区':'27128',
  '27140|堺区':'27141','27140|中区':'27142','27140|東区':'27143','27140|西区':'27144',
  '27140|南区':'27145','27140|北区':'27146','27140|美原区':'27147',
  '28100|東灘区':'28101','28100|灘区':'28102','28100|兵庫区':'28105','28100|長田区':'28106',
  '28100|須磨区':'28107','28100|垂水区':'28108','28100|北区':'28109','28100|中央区':'28110',
  '28100|西区':'28111',
  '33100|北区':'33101','33100|中区':'33102','33100|東区':'33103','33100|南区':'33104',
  '34100|中区':'34101','34100|東区':'34102','34100|南区':'34103','34100|西区':'34104',
  '34100|安佐南区':'34105','34100|安佐北区':'34106','34100|安芸区':'34107','34100|佐伯区':'34108',
  '40100|門司区':'40101','40100|若松区':'40103','40100|戸畑区':'40105',
  '40100|小倉北区':'40106','40100|小倉南区':'40107','40100|八幡東区':'40108','40100|八幡西区':'40109',
  '40130|東区':'40131','40130|博多区':'40132','40130|中央区':'40133','40130|南区':'40134',
  '40130|西区':'40135','40130|城南区':'40136','40130|早良区':'40137',
  '43100|中央区':'43101','43100|東区':'43102','43100|西区':'43103','43100|南区':'43104','43100|北区':'43105',
};

const TREND_YEARS = [2019, 2020, 2021, 2022, 2023, 2024];

async function getWardName(lng, lat) {
  try {
    const url = `https://geoapi.heartrails.com/api/json?method=searchByGeoLocation&x=${lng}&y=${lat}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    const data = await res.json();
    const raw = data?.response?.location?.[0]?.city || '';
    const shiIdx = raw.indexOf('市');
    if (shiIdx !== -1 && raw.endsWith('区') && shiIdx < raw.length - 1) {
      return raw.slice(shiIdx + 1);
    }
    return null;
  } catch { return null; }
}

async function fetchReinfolib(prefCode, cityCode, year) {
  const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/XIT001?year=${year}&area=${prefCode}&city=${cityCode}&priceClassification=02&Language=ja`;
  const res = await fetch(url, {
    headers: { 'Ocp-Apim-Subscription-Key': REINFOLIB_API_KEY },
    next: { revalidate: 86400 * 30 },
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.status === 'OK' && Array.isArray(json.data) ? json.data : [];
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const muniCode = searchParams.get('muniCode');
  const lng = searchParams.get('lng');
  const lat = searchParams.get('lat');

  if (!muniCode) return NextResponse.json({ error: 'muniCode required' }, { status: 400 });

  const prefCode = muniCode.slice(0, 2);
  let effectiveCode = muniCode;

  if (lng && lat) {
    const wardName = await getWardName(lng, lat);
    if (wardName) {
      const wardCode = WARD_CODES[`${muniCode}|${wardName}`];
      if (wardCode) effectiveCode = wardCode;
    }
  }

  const results = await Promise.all(TREND_YEARS.map(y => fetchReinfolib(prefCode, effectiveCode, y)));

  const yearlyStats = {};
  for (let i = 0; i < TREND_YEARS.length; i++) {
    const year = TREND_YEARS[i];
    const data = results[i];
    const condos = data.filter(d => d.Type === '中古マンション等' && d.TradePrice && parseFloat(d.Area) > 0);
    const houses = data.filter(d => d.Type === '宅地(土地と建物)' && d.TradePrice);
    yearlyStats[year] = {
      condoCount: condos.length,
      condoAvgUnitPrice: condos.length >= 3
        ? Math.round(condos.reduce((s, d) => s + parseInt(d.TradePrice) / parseFloat(d.Area), 0) / condos.length / 10000)
        : null,
      houseCount: houses.length,
      houseAvgPrice: houses.length >= 3
        ? Math.round(houses.reduce((s, d) => s + parseInt(d.TradePrice), 0) / houses.length / 10000)
        : null,
    };
  }

  return NextResponse.json({ muniCode, yearlyStats });
}
