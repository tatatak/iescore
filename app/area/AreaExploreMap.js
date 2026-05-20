'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Link from 'next/link';
import Image from 'next/image';
import popChangeData from './populationChangeData.json';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const PREF_NAMES = {
  '01':'北海道','02':'青森県','03':'岩手県','04':'宮城県','05':'秋田県',
  '06':'山形県','07':'福島県','08':'茨城県','09':'栃木県','10':'群馬県',
  '11':'埼玉県','12':'千葉県','13':'東京都','14':'神奈川県','15':'新潟県',
  '16':'富山県','17':'石川県','18':'福井県','19':'山梨県','20':'長野県',
  '21':'岐阜県','22':'静岡県','23':'愛知県','24':'三重県','25':'滋賀県',
  '26':'京都府','27':'大阪府','28':'兵庫県','29':'奈良県','30':'和歌山県',
  '31':'鳥取県','32':'島根県','33':'岡山県','34':'広島県','35':'山口県',
  '36':'徳島県','37':'香川県','38':'愛媛県','39':'高知県','40':'福岡県',
  '41':'佐賀県','42':'長崎県','43':'熊本県','44':'大分県','45':'宮崎県',
  '46':'鹿児島県','47':'沖縄県',
};

// 公示地価（円/㎡）→ 色
function priceColor(price) {
  if (price == null)    return '#d1d5db';
  if (price < 30000)   return '#dbeafe'; // 〜3万
  if (price < 70000)   return '#93c5fd'; // 3〜7万
  if (price < 100000)  return '#3b82f6'; // 7〜10万
  if (price < 200000)  return '#06b6d4'; // 10〜20万
  if (price < 300000)  return '#10b981'; // 20〜30万
  if (price < 400000)  return '#84cc16'; // 30〜40万
  if (price < 500000)  return '#eab308'; // 40〜50万
  if (price < 600000)  return '#f59e0b'; // 50〜60万
  if (price < 700000)  return '#f97316'; // 60〜70万
  if (price < 1000000) return '#ea580c'; // 70〜100万
  if (price < 2000000) return '#ef4444'; // 100〜200万
  if (price < 3000000) return '#b91c1c'; // 200〜300万
  return '#7f1d1d';                       // 300万〜
}

// 5年地価トレンド（%）→ 色
function trendColor(trend) {
  if (trend == null) return '#d1d5db';
  if (trend < -15) return '#ef4444';
  if (trend < -5)  return '#f97316';
  if (trend < 5)   return '#9ca3af';
  if (trend < 20)  return '#10b981';
  return '#059669';
}

// 人口変化率（%）→ 色（人口増減・将来推計共用）
function popColor(change) {
  if (change == null) return '#d1d5db';
  if (change < -10)  return '#ef4444';
  if (change < -5)   return '#f97316';
  if (change < 0)    return '#fbbf24';
  if (change < 5)    return '#86efac';
  if (change < 10)   return '#22c55e';
  return '#16a34a';
}


const PRICE_LEGEND = [
  { label: '〜3万円/㎡',  color: '#dbeafe' },
  { label: '3〜7万',      color: '#93c5fd' },
  { label: '7〜10万',     color: '#3b82f6' },
  { label: '10〜20万',    color: '#06b6d4' },
  { label: '20〜30万',    color: '#10b981' },
  { label: '30〜40万',    color: '#84cc16' },
  { label: '40〜50万',    color: '#eab308' },
  { label: '50〜60万',    color: '#f59e0b' },
  { label: '60〜70万',    color: '#f97316' },
  { label: '70〜100万',   color: '#ea580c' },
  { label: '100〜200万',  color: '#ef4444' },
  { label: '200〜300万',  color: '#b91c1c' },
  { label: '300万円〜',   color: '#7f1d1d' },
];

const TREND_LEGEND = [
  { label: '-15%以下（大幅下落）', color: '#ef4444' },
  { label: '-15〜-5%（下落）',     color: '#f97316' },
  { label: '±5%（横ばい）',       color: '#9ca3af' },
  { label: '+5〜20%（上昇）',      color: '#10b981' },
  { label: '+20%以上（大幅上昇）', color: '#059669' },
];

const POP_LEGEND = [
  { label: '-10%以下（大幅減少）', color: '#ef4444' },
  { label: '-10〜-5%（減少）',     color: '#f97316' },
  { label: '-5〜0%（微減）',       color: '#fbbf24' },
  { label: '0〜5%（微増）',        color: '#86efac' },
  { label: '5〜10%（増加）',       color: '#22c55e' },
  { label: '+10%以上（大幅増加）', color: '#16a34a' },
];
// 将来推計も同じ色スケールを使用

const REGIONS = [
  { name: '北海道', bounds: [[139.8, 41.6], [145.6, 45.3]] },
  { name: '北東北', bounds: [[139.6, 38.8], [141.9, 41.6]] }, // 青森・岩手・秋田
  { name: '南東北', bounds: [[139.5, 36.8], [141.7, 39.0]] }, // 宮城・山形・福島
  { name: '北関東', bounds: [[138.5, 35.7], [141.0, 37.1]] }, // 茨城・栃木・群馬
  { name: '首都圏', bounds: [[139.0, 35.1], [140.9, 36.2]] }, // 東京・神奈川・千葉・埼玉
  { name: '甲信越', bounds: [[137.3, 35.4], [139.6, 38.5]] }, // 山梨・長野・新潟
  { name: '北陸',   bounds: [[135.7, 35.4], [137.7, 37.3]] }, // 富山・石川・福井
  { name: '中京',   bounds: [[136.5, 34.5], [137.8, 35.4]] }, // 愛知中心
  { name: '京阪神', bounds: [[134.9, 34.3], [135.9, 35.1]] }, // 大阪・神戸・京都中心
  { name: '中国',   bounds: [[130.8, 33.9], [134.4, 35.4]] },
  { name: '四国',   bounds: [[132.3, 32.8], [134.8, 34.3]] },
  { name: '福岡',   bounds: [[129.9, 33.1], [131.0, 33.9]] },
  { name: '南九州', bounds: [[130.0, 30.9], [131.9, 32.9]] }, // 熊本・宮崎・鹿児島
  { name: '沖縄',   bounds: [[127.6, 26.0], [128.4, 27.0]] }, // 沖縄本島中心
];

function buildGeoJSON(areas, metric, popData, futureData) {
  return {
    type: 'FeatureCollection',
    features: areas.map(a => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
      properties: {
        color: metric === 'price'      ? priceColor(a.latestPrice)
             : metric === 'trend'      ? trendColor(a.trend)
             : metric === 'population' ? popColor(popData?.[a.muniCode] ?? null)
             :                           popColor(futureData?.[a.muniCode] ?? null),
        areaData: JSON.stringify({
          muniCode: a.muniCode,
          name: a.name,
          slug: a.slug,
          latestPrice: a.latestPrice,
          trend: a.trend,
        }),
      },
    })),
  };
}

export default function AreaExploreMap({ areas, futurePopData }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [metric, setMetric] = useState('price');
  const [selected, setSelected] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    const bounds = [[139.0, 35.1], [140.9, 36.2]]; // 首都圏（東京・神奈川・千葉・埼玉）

    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: 'mapbox://styles/mapbox/standard',
      bounds,
      fitBoundsOptions: { padding: 40 },
      language: 'ja',
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('load', () => {
      map.addSource('areas', {
        type: 'geojson',
        data: buildGeoJSON(areas, 'price'),
      });

      map.addLayer({
        id: 'areas-circle',
        type: 'circle',
        source: 'areas',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 7, 9, 16, 13, 30],
          'circle-color': ['get', 'color'],
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.45, 9, 0.70, 13, 0.85],
          'circle-stroke-width': 0,
        },
      });

      map.on('click', 'areas-circle', (e) => {
        const raw = e.features[0].properties.areaData;
        try { setSelected(JSON.parse(raw)); } catch {}
      });

      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['areas-circle'] });
        if (features.length === 0) setSelected(null);
      });

      map.on('mouseenter', 'areas-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'areas-circle', () => { map.getCanvas().style.cursor = ''; });

      setMapReady(true);
    });

    mapInstanceRef.current = map;
    return () => map.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapReady) return;
    const src = mapInstanceRef.current?.getSource('areas');
    if (src) src.setData(buildGeoJSON(areas, metric, popChangeData, futurePopData));
  }, [metric, mapReady, areas, futurePopData]);

  const legend = metric === 'price' ? PRICE_LEGEND : metric === 'trend' ? TREND_LEGEND : POP_LEGEND;
  const prefecture = selected?.muniCode ? PREF_NAMES[selected.muniCode.slice(0, 2)] : null;
  const panelPopChange = popChangeData?.[selected?.muniCode] ?? null;
  const panelFutureChange = futurePopData?.[selected?.muniCode] ?? null;
  const isLoading = false;

  return (
    <div ref={mapRef} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>

      {/* ヘッダー */}
      <div className="absolute top-0 left-0 right-0 bg-white border-b border-gray-200 z-20 shadow-sm">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1 self-start">
            <Link href="/?type=condo" className="px-3 py-1 text-xs rounded-lg font-medium whitespace-nowrap bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
              🏢 マンション
            </Link>
            <Link href="/?type=house" className="px-3 py-1 text-xs rounded-lg font-medium whitespace-nowrap bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
              🏡 戸建て
            </Link>
            <span className="ml-2 px-3 py-1 text-xs rounded-lg font-medium whitespace-nowrap bg-blue-600 text-white">
              🗺️ 広域
            </span>
          </div>
          <Link href="/">
            <Image src="/logo.png" alt="イエスコア" width={1396} height={684} className="h-8 w-auto" style={{ width: 'auto' }} />
          </Link>
        </div>
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-none">
          {REGIONS.map(r => (
            <button
              key={r.name}
              onClick={() => mapInstanceRef.current?.fitBounds(r.bounds, { padding: 40, duration: 800 })}
              className="shrink-0 text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-blue-600 hover:text-white transition-colors whitespace-nowrap"
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      {/* 右パネル */}
      <div className="absolute top-24 right-3 z-20 w-60 bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* トグル */}
        <div className="flex">
          {[
            { id: 'price',      label: '公示地価' },
            { id: 'trend',      label: '地価変動' },
            { id: 'population', label: '人口増減' },
            { id: 'future',     label: '将来推計' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setMetric(id)}
              className={`flex-1 py-2.5 text-[10px] font-semibold transition-colors ${metric === id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 凡例（折り畳み） */}
        <div className="px-3 pt-2 pb-1">
          <button
            onClick={() => setLegendOpen(o => !o)}
            className="flex items-center justify-between w-full py-1"
          >
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              {metric === 'price'      ? '住宅地 公示地価'
               : metric === 'trend'      ? '3年間 地価変動率'
               : metric === 'population' ? '2015→2020 人口変化率'
               :                           '2025→2040 将来推計変化率'}
            </span>
            <span className="text-xs text-gray-400 ml-2">{legendOpen ? '▲' : '▼'}</span>
          </button>
          {isLoading && (
            <p className="text-xs text-gray-400 py-1 text-center">読み込み中...</p>
          )}
          {legendOpen && !isLoading && (
            <div className="mt-1 space-y-1.5 pb-1">
              {legend.map(l => (
                <div key={l.label} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                  <span className="text-xs text-gray-600 leading-none">{l.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-300 shrink-0" />
                <span className="text-xs text-gray-400 leading-none">データなし</span>
              </div>
            </div>
          )}
        </div>

        {/* 選択エリア情報 */}
        {selected && (
          <div className="border-t border-gray-100 px-3 pt-3 pb-3">
            <p className="text-[10px] text-gray-400 mb-0.5">{prefecture}</p>
            <p className="font-bold text-gray-800 text-sm mb-2">{selected.name ?? selected.muniCode}</p>
            <div className="space-y-1 mb-3">
              {selected.latestPrice != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">公示地価</span>
                  <span className="font-semibold text-gray-800">
                    {selected.latestPrice >= 10000
                      ? `${Math.round(selected.latestPrice / 10000)}万円/㎡`
                      : `${selected.latestPrice.toLocaleString()}円/㎡`}
                  </span>
                </div>
              )}
              {selected.trend != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">3年地価変動</span>
                  <span className={`font-semibold ${selected.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {selected.trend > 0 ? '+' : ''}{selected.trend}%
                  </span>
                </div>
              )}
              {panelPopChange != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">人口増減（15→20）</span>
                  <span className={`font-semibold ${panelPopChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {panelPopChange > 0 ? '+' : ''}{panelPopChange}%
                  </span>
                </div>
              )}
              {panelFutureChange != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">将来推計（25→40）</span>
                  <span className={`font-semibold ${panelFutureChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {panelFutureChange > 0 ? '+' : ''}{panelFutureChange}%
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              {selected.slug && (
                <Link
                  href={`/area/${selected.slug}`}
                  className="block w-full text-center text-xs bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  エリア詳細 →
                </Link>
              )}
              {selected.name && (
                <Link
                  href={`/?q=${encodeURIComponent(selected.name)}`}
                  className="block w-full text-center text-xs bg-gray-100 text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  この住所で診断
                </Link>
              )}
            </div>
          </div>
        )}

        {!selected && (
          <p className="px-3 pb-3 text-xs text-gray-400 text-center">円をタップしてエリア詳細を表示</p>
        )}
      </div>

      {/* エリア数バッジ */}
      <div className="absolute bottom-10 left-3 z-20 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-gray-500 shadow">
        {areas.length}市区町村を表示
      </div>
    </div>
  );
}
