'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const HAZARD_LAYERS = [
  {
    id: 'flood',
    label: '🌊 洪水浸水',
    tiles: ['https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png'],
  },
  {
    id: 'landslide',
    label: '🪨 土砂災害',
    tiles: [
      'https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png',
      'https://disaportaldata.gsi.go.jp/raster/05_jisuberikeikaikuiki/{z}/{x}/{y}.png',
      'https://disaportaldata.gsi.go.jp/raster/05_kyukeishakeikaikuiki/{z}/{x}/{y}.png',
    ],
  },
  {
    id: 'hightide',
    label: '🌀 高潮浸水',
    tiles: ['https://disaportaldata.gsi.go.jp/raster/03_hightide_shinsuishin_data/{z}/{x}/{y}.png'],
  },
  {
    id: 'tsunami',
    label: '🌊 津波浸水',
    tiles: ['https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/{z}/{x}/{y}.png'],
  },
];

const ISO_CONTOURS = [
  { minutes: 15, color: '#f97316', fillOpacity: 0.1 },
  { minutes: 10, color: '#eab308', fillOpacity: 0.15 },
  { minutes:  5, color: '#22c55e', fillOpacity: 0.2  },
];

export default function Map({ flyTo, activeLayers, onToggleLayer, onMapClick, onBuildingsLoaded, selectedPin, propertyType, onConvenienceData, highlightTarget, onNoiseData }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const mapStyleLoadedRef = useRef(false);
  const flyToRef = useRef(null);
  const areaNameRef = useRef(''); // エリア検索時の地名（建物選択では更新しない）
  const activeLayersRef = useRef(activeLayers);
  const prevActiveLayersRef = useRef({});
  const poiMarkersRef = useRef([]);
  const onMapClickRef = useRef(onMapClick);
  const onBuildingsLoadedRef = useRef(onBuildingsLoaded);
  const onConvenienceDataRef = useRef(onConvenienceData);
  const onNoiseDataRef = useRef(onNoiseData);
  const mapConvCleanupRef = useRef(null);
  const noiseIdleCleanupRef = useRef(null);
  const lastBuildingsRef = useRef([]);
  const selectedPinMarkerRef = useRef(null);
  const locationMarkerRef = useRef(null);
  const highlightedMarkerRef = useRef(null);
  const savedZoomRef = useRef(null);
  const [loadingPOI, setLoadingPOI] = useState(null);

  useEffect(() => { activeLayersRef.current = activeLayers; }, [activeLayers]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { onBuildingsLoadedRef.current = onBuildingsLoaded; }, [onBuildingsLoaded]);
  useEffect(() => { onConvenienceDataRef.current = onConvenienceData; }, [onConvenienceData]);
  useEffect(() => { onNoiseDataRef.current = onNoiseData; }, [onNoiseData]);

  // 地図初期化
  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [139.6917, 35.6895],
      zoom: 13,
      language: 'ja',
      customAttribution: '国土数値情報（国土交通省）・国土地理院・防災科研J-SHIS',
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(
      new mapboxgl.GeolocateControl({ trackUserLocation: true }),
      'top-right'
    );

    // 地図クリック → 建物名 or 逆ジオコーディング
    map.current.on('click', async (e) => {
      if (e.originalEvent.target.closest('.iescore-poi-marker')) return;
      const { lng, lat } = e.lngLat;
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

      // クリック地点のラベル付きフィーチャを優先
      const features = map.current.queryRenderedFeatures(e.point);
      const labeled = features.find(f => {
        if (!f.properties?.name) return false;
        const lid = f.layer?.id || '';
        return !lid.includes('road') && !lid.includes('boundary') &&
               !lid.includes('land') && !lid.includes('water') && !lid.includes('background');
      });

      let name, featureType = 'address';
      if (labeled) {
        name = labeled.properties.name_ja || labeled.properties.name;
      } else {
        try {
          const res = await fetch(
            `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&access_token=${token}&language=ja&country=jp`
          );
          const data = await res.json();
          const feat = data.features?.[0];
          if (!feat) return;
          name = feat.properties.name_preferred || feat.properties.place_formatted;
          featureType = feat.properties.feature_type || 'address';
        } catch {
          return;
        }
      }

      if (name) onMapClickRef.current?.({ lng, lat, name, featureType });
    });

    map.current.on('load', () => {
      mapStyleLoadedRef.current = true;
      HAZARD_LAYERS.forEach(({ id, tiles }) => {
        tiles.forEach((tileUrl, i) => {
          const sourceId = `${id}-source-${i}`;
          const layerId = `${id}-layer-${i}`;
          map.current.addSource(sourceId, {
            type: 'raster',
            tiles: [tileUrl],
            tileSize: 256,
            attribution: '国土地理院',
          });
          map.current.addLayer({
            id: layerId,
            type: 'raster',
            source: sourceId,
            paint: { 'raster-opacity': 0.6 },
            layout: { visibility: 'none' },
          });
        });
      });
    });
  }, []);

  // 選択マンションの赤ピン
  useEffect(() => {
    if (selectedPinMarkerRef.current) {
      selectedPinMarkerRef.current.remove();
      selectedPinMarkerRef.current = null;
    }
    // ビルが選択されたらロケーションピンを隠す
    if (selectedPin && locationMarkerRef.current) {
      locationMarkerRef.current.remove();
      locationMarkerRef.current = null;
    }
    if (!selectedPin || !map.current) return;

    const el = document.createElement('div');
    el.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none';
    el.innerHTML = `
      <div style="background:#dc2626;color:white;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35);font-size:16px">
        <span style="transform:rotate(45deg)">🏢</span>
      </div>
      <div style="background:white;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;color:#111827;box-shadow:0 1px 4px rgba(0,0,0,0.2);margin-top:4px;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis;text-align:center">
        ${selectedPin.name}
        ${selectedPin.address ? `<div style="font-size:9px;font-weight:400;color:#6b7280;margin-top:1px;overflow:hidden;text-overflow:ellipsis">${selectedPin.address}</div>` : ''}
      </div>
    `;

    selectedPinMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([selectedPin.lng, selectedPin.lat])
      .addTo(map.current);
  }, [selectedPin]);

  // flyTo
  useEffect(() => {
    if (!flyTo || !map.current) return;

    // 前回の idle リスナーをキャンセル
    if (mapConvCleanupRef.current) {
      mapConvCleanupRef.current();
      mapConvCleanupRef.current = null;
    }

    flyToRef.current = flyTo;
    // 場所が変わったのでPOIキャッシュを全破棄
    poiMarkersRef.current.forEach(m => m.remove());
    poiMarkersRef.current = [];
    if (!flyTo.skipBuildingSearch) {
      lastBuildingsRef.current = [];
      areaNameRef.current = flyTo.name || '';
    }
    const isArea = flyTo.featureType && !['address', 'poi'].includes(flyTo.featureType);
    map.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: 17, essential: true });

    // Overpass で全POIカウントを取得（タイル読み込みと無関係に即時実行）
    fetchAllCountsFromOverpass(flyTo.lng, flyTo.lat);

    // ロケーションピン（住所・エリア検索時）
    if (locationMarkerRef.current) {
      locationMarkerRef.current.remove();
      locationMarkerRef.current = null;
    }
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none';
    if (!isArea) {
      // 番地レベルの住所: 青い涙滴ピン
      el.innerHTML = `
        <div style="background:#2563eb;color:white;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:15px">
          <span style="transform:rotate(45deg)">📍</span>
        </div>
        <div style="background:white;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;color:#111827;box-shadow:0 1px 4px rgba(0,0,0,0.2);margin-top:4px;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis">
          ${flyTo.name}
        </div>`;
      locationMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([flyTo.lng, flyTo.lat])
        .addTo(map.current);
    } else {
      // 丁目・町・エリア: 円形の淡いマーカー
      el.innerHTML = `
        <div style="background:rgba(37,99,235,0.12);border:2px solid #2563eb;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px">
          📍
        </div>
        <div style="background:white;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;color:#111827;box-shadow:0 1px 4px rgba(0,0,0,0.2);margin-top:4px;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis">
          ${flyTo.name}
        </div>`;
      locationMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'top' })
        .setLngLat([flyTo.lng, flyTo.lat])
        .addTo(map.current);
    }
    if (isArea) {
      fetchAndDrawBoundary(flyTo.name);
    } else {
      clearBoundary();
    }
    if (activeLayersRef.current.isochrone) fetchIsochrone(flyTo.lng, flyTo.lat);
    // マンションモードのみ建物を取得（ドロップダウン用）、マーカーはチェックボックス状態に従う
    // skipBuildingSearch=true はマンション選択時のフライトなので建物リストを再取得しない
    if (propertyType !== 'house' && !flyTo.skipBuildingSearch) fetchBuildings(flyTo, activeLayersRef.current.buildings);

    // 騒音解析：タイル読み込み完了後に実行
    if (noiseIdleCleanupRef.current) { noiseIdleCleanupRef.current(); noiseIdleCleanupRef.current = null; }
    clearNoiseHighlights();
    onNoiseDataRef.current?.(null);
    const noiseHandler = () => { analyzeNoise(flyTo.lng, flyTo.lat); };
    map.current.once('idle', noiseHandler);
    noiseIdleCleanupRef.current = () => map.current?.off('idle', noiseHandler);

    ['supermarket', 'konbini', 'station', 'medical', 'kindergarten', 'school', 'busstop', 'reform'].forEach(type => {
      if (activeLayersRef.current[type]) fetchPOI(type, flyTo.lng, flyTo.lat);
    });
  }, [flyTo]);

  // レイヤー表示切替
  useEffect(() => {
    if (!map.current) return;

    // ハザードレイヤーはスタイルロード後のみ操作可
    if (mapStyleLoadedRef.current) {
      HAZARD_LAYERS.forEach(({ id, tiles }) => {
        tiles.forEach((_, i) => {
          const layerId = `${id}-layer-${i}`;
          if (!map.current.getLayer(layerId)) return;
          map.current.setLayoutProperty(layerId, 'visibility', activeLayers[id] ? 'visible' : 'none');
        });
      });
    }

    const prev = prevActiveLayersRef.current;

    if (activeLayers.isochrone !== prev.isochrone) {
      if (activeLayers.isochrone) {
        if (flyToRef.current) fetchIsochrone(flyToRef.current.lng, flyToRef.current.lat);
        const isMobile = window.innerWidth < 768;
        map.current.easeTo({ zoom: isMobile ? 13 : 15, essential: true });
      } else {
        setIsochroneVisibility('none');
      }
    }

    ['supermarket', 'konbini', 'station', 'medical', 'kindergarten', 'school', 'busstop', 'reform'].forEach(type => {
      if (activeLayers[type] === prev[type]) return;
      if (activeLayers[type]) {
        if (!showCachedPOIMarkers(type) && flyToRef.current) fetchPOI(type, flyToRef.current.lng, flyToRef.current.lat);
      } else {
        hidePOIMarkers(type);
      }
    });


    // buildings: チェックON → キャッシュ済みリストからマーカー追加（再フェッチしない）
    if (activeLayers.buildings !== prev.buildings) {
      if (activeLayers.buildings) {
        if (lastBuildingsRef.current.length > 0) {
          addBuildingMarkers(lastBuildingsRef.current);
        } else if (flyToRef.current) {
          fetchBuildings(flyToRef.current, true);
        }
      } else {
        clearPOIMarkers('buildings');
      }
    }

    if (activeLayers.noise !== prev.noise) {
      if (activeLayers.noise) drawNoiseHighlights();
      else clearNoiseHighlights();
    }

    prevActiveLayersRef.current = activeLayers;
  }, [activeLayers]);

  const noiseGeomRef = useRef(null); // { features: [...] }

  const clearNoiseHighlights = () => {
    if (!map.current) return;
    ['noise-hl-glow3','noise-hl-glow2','noise-hl-glow1','noise-hl-core'].forEach(id => {
      if (map.current.getLayer(id)) map.current.removeLayer(id);
    });
    if (map.current.getSource('noise-hl')) map.current.removeSource('noise-hl');
  };

  const drawNoiseHighlights = () => {
    if (!map.current || !mapStyleLoadedRef.current || !noiseGeomRef.current) return;
    clearNoiseHighlights();
    map.current.addSource('noise-hl', { type: 'geojson', data: noiseGeomRef.current });
    // 外側から内側へ重ねてグロー表現（音が広がるイメージ）
    map.current.addLayer({ id: 'noise-hl-glow3', type: 'line', source: 'noise-hl',
      paint: { 'line-color': ['get', 'color'], 'line-width': 400, 'line-opacity': 0.015, 'line-blur': 120 } });
    map.current.addLayer({ id: 'noise-hl-glow2', type: 'line', source: 'noise-hl',
      paint: { 'line-color': ['get', 'color'], 'line-width': 180, 'line-opacity': 0.05, 'line-blur': 50 } });
    map.current.addLayer({ id: 'noise-hl-glow1', type: 'line', source: 'noise-hl',
      paint: { 'line-color': ['get', 'color'], 'line-width': 60, 'line-opacity': 0.14, 'line-blur': 16 } });
    map.current.addLayer({ id: 'noise-hl-core', type: 'line', source: 'noise-hl',
      paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.90 } });
  };

  const analyzeNoise = (lng, lat) => {
    if (!map.current || !mapStyleLoadedRef.current) return;
    const center = map.current.project([lng, lat]);
    const R = 450;
    const bbox = [[center.x - R, center.y - R], [center.x + R, center.y + R]];
    const features = map.current.queryRenderedFeatures(bbox);

    let nearestRailM = Infinity, nearestRailName = null, nearestRailFeature = null;
    let nearestRoadM = Infinity, nearestRoadClass = null, nearestRoadFeature = null;
    const MAJOR_ROAD = new Set(['motorway', 'trunk', 'primary', 'secondary']);

    for (const f of features) {
      const cls = f.properties?.class;
      const layerId = f.layer?.id || '';
      const isRail = cls === 'rail' || layerId.includes('rail');
      const isMajorRoad = MAJOR_ROAD.has(cls);
      if (!isRail && !isMajorRoad) continue;
      const geo = f.geometry;
      if (!geo) continue;
      const lines = geo.type === 'LineString' ? [geo.coordinates]
                  : geo.type === 'MultiLineString' ? geo.coordinates : [];
      for (const line of lines) {
        for (const [clng, clat] of line) {
          const d = haversineM(lat, lng, clat, clng);
          if (isRail && d < nearestRailM) {
            nearestRailM = d; nearestRailName = f.properties?.name_ja || f.properties?.name || null;
            nearestRailFeature = f;
          }
          if (isMajorRoad && d < nearestRoadM) {
            nearestRoadM = d; nearestRoadClass = cls; nearestRoadFeature = f;
          }
        }
      }
    }

    // ジオメトリを建物中心から400m以内に切り抜く
    // OSMフィーチャーは路線全体を持つため、そのまま描画すると視覚的中心が建物からずれる
    const clipGeomToRadius = (geo, clat, clng, radiusM) => {
      const clipLine = (coords) => {
        let nearestIdx = 0, minD = Infinity;
        coords.forEach(([cx, cy], i) => {
          const d = haversineM(clat, clng, cy, cx);
          if (d < minD) { minD = d; nearestIdx = i; }
        });
        let s = nearestIdx, e = nearestIdx;
        while (s > 0 && haversineM(clat, clng, coords[s-1][1], coords[s-1][0]) < radiusM) s--;
        while (e < coords.length - 1 && haversineM(clat, clng, coords[e+1][1], coords[e+1][0]) < radiusM) e++;
        const seg = coords.slice(s, e + 1);
        return seg.length >= 2 ? seg : null;
      };
      if (geo.type === 'LineString') {
        const seg = clipLine(geo.coordinates);
        return seg ? { type: 'LineString', coordinates: seg } : null;
      }
      if (geo.type === 'MultiLineString') {
        const segs = geo.coordinates.map(clipLine).filter(Boolean);
        return segs.length > 0 ? { type: 'MultiLineString', coordinates: segs } : null;
      }
      return geo;
    };

    const hlFeatures = [];
    if (nearestRailFeature) {
      const clipped = clipGeomToRadius(nearestRailFeature.geometry, lat, lng, 400);
      if (clipped) hlFeatures.push({ type: 'Feature', geometry: clipped, properties: { color: '#dc2626' } });
    }
    if (nearestRoadFeature) {
      const clipped = clipGeomToRadius(nearestRoadFeature.geometry, lat, lng, 400);
      if (clipped) hlFeatures.push({ type: 'Feature', geometry: clipped, properties: { color: '#ea580c' } });
    }
    noiseGeomRef.current = hlFeatures.length > 0
      ? { type: 'FeatureCollection', features: hlFeatures } : null;

    // noise レイヤーがすでに ON なら即描画
    if (activeLayersRef.current.noise) drawNoiseHighlights();

    onNoiseDataRef.current?.({
      railM: nearestRailM < Infinity ? Math.round(nearestRailM) : null,
      railName: nearestRailName,
      roadM: nearestRoadM < Infinity ? Math.round(nearestRoadM) : null,
      roadClass: nearestRoadClass,
    });
  };

  const fetchIsochrone = async (lng, lat) => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const minutes = ISO_CONTOURS.map(c => c.minutes).join(',');
    const url = `https://api.mapbox.com/isochrone/v1/mapbox/walking/${lng},${lat}?contours_minutes=${minutes}&polygons=true&access_token=${token}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!map.current || !mapStyleLoadedRef.current) return;

      if (map.current.getSource('iso-source')) {
        map.current.getSource('iso-source').setData(data);
        setIsochroneVisibility('visible');
      } else {
        map.current.addSource('iso-source', { type: 'geojson', data });

        ISO_CONTOURS.forEach(({ minutes, color, fillOpacity }) => {
          map.current.addLayer({
            id: `iso-fill-${minutes}`,
            type: 'fill',
            source: 'iso-source',
            filter: ['==', ['get', 'contour'], minutes],
            paint: { 'fill-color': color, 'fill-opacity': fillOpacity },
          });
          map.current.addLayer({
            id: `iso-line-${minutes}`,
            type: 'line',
            source: 'iso-source',
            filter: ['==', ['get', 'contour'], minutes],
            paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0.8 },
          });
        });
      }
    } catch (e) {
      console.error('Isochrone fetch error:', e);
    }
  };

  // 検索クエリに付与する市区名（建物選択後も直前のエリア名を使う）
  const getAreaHint = () => {
    const name = areaNameRef.current || flyToRef.current?.name || '';
    const m2 = name.match(/^(.+?市.+?区)/);
    if (m2) return m2[1];
    const m1 = name.match(/^(.+?[市区郡])/);
    return m1 ? m1[1] : (name.length > 12 ? name.slice(0, 12) : name);
  };

  const POI_CONFIG = {
    supermarket: {
      tags: ['shop=supermarket'],
      emoji: '🛒', color: '#16a34a', pulseColor: '#22c55e', label: 'スーパー', radius: 1500,
      filter: (el) => {
        const n = el.tags?.name || '';
        return !['セブン', 'ローソン', 'ファミリ', 'ミニストップ', 'デイリー', 'セイコーマート', 'ポプラ', 'ニューデイズ', 'キオスク', 'コンビニ'].some(k => n.includes(k));
      },
    },
    konbini: {
      tags: ['shop=convenience'],
      emoji: '🏪', color: '#7c3aed', pulseColor: '#a78bfa', label: 'コンビニ', radius: 1000,
    },
    station: {
      tags: ['railway=station', 'railway=tram_stop'],
      emoji: '🚉', color: '#1d4ed8', pulseColor: '#60a5fa', label: '駅', radius: 2000,
    },
    medical: {
      tags: ['amenity=hospital', 'amenity=clinic', 'amenity=doctors', 'amenity=dentist',
             'healthcare=doctor', 'healthcare=clinic', 'healthcare=hospital', 'healthcare=dentist'],
      emoji: '🏥', color: '#dc2626', pulseColor: '#f87171', label: '医療機関', radius: 1500,
      popupBuilder: (el) => {
        const name = el.tags?.name || '医療機関';
        const amenity = el.tags?.amenity || '';
        const hc = el.tags?.healthcare || '';
        const typeLabel = el.tags?._typeLabel
          || ((amenity === 'hospital' || hc === 'hospital') ? '病院'
          : (amenity === 'dentist' || hc === 'dentist') ? '歯科'
          : (amenity === 'clinic' || hc === 'clinic') ? 'クリニック'
          : '診療所');
        const phone = el.tags?.phone || el.tags?.['contact:phone'] || el.tags?.['contact:mobile'] || '';
        const hours = el.tags?.opening_hours || '';
        const speciality = el.tags?.['healthcare:speciality'] || el.tags?.['medical_system:western'] || '';
        const area = getAreaHint();
        const searchQ = encodeURIComponent(area ? `${name} ${area}` : name);
        const elLat = el.lat ?? el.center?.lat;
        const elLon = el.lon ?? el.center?.lon;
        const mapsQ = elLat && elLon ? `${elLat},${elLon}` : searchQ;
        return `
          <p style="font-size:12px;margin:0;font-weight:600">${name}</p>
          <p style="font-size:10px;margin:2px 0 0;color:#888">${typeLabel}${speciality ? ' · ' + speciality : ''}</p>
          ${phone ? `<p style="font-size:10px;margin:4px 0 0"><a href="tel:${phone}" style="color:#333;text-decoration:none">📞 ${phone}</a></p>` : ''}
          ${hours ? `<p style="font-size:10px;margin:2px 0 0;color:#666">🕐 ${hours}</p>` : ''}
          <div style="margin-top:6px;display:flex;gap:6px">
            <a href="https://www.google.com/search?q=${searchQ}" target="_blank" rel="noopener"
               style="font-size:10px;color:#2563eb;text-decoration:none;background:#eff6ff;padding:2px 7px;border-radius:4px">🔍 Web検索</a>
            <a href="https://www.google.com/maps?q=${mapsQ}" target="_blank" rel="noopener"
               style="font-size:10px;color:#2563eb;text-decoration:none;background:#eff6ff;padding:2px 7px;border-radius:4px">📍 地図</a>
          </div>`;
      },
    },
    kindergarten: {
      customQuery: (r, lat, lng) =>
        `[out:json][timeout:15];(` +
        `node["amenity"="kindergarten"](around:${r},${lat},${lng});way["amenity"="kindergarten"](around:${r},${lat},${lng});` +
        `node["amenity"="childcare"](around:${r},${lat},${lng});way["amenity"="childcare"](around:${r},${lat},${lng});` +
        `node["amenity"="social_facility"]["social_facility"="day_care"](around:${r},${lat},${lng});way["amenity"="social_facility"]["social_facility"="day_care"](around:${r},${lat},${lng});` +
        `);out center;`,
      emoji: '👶', color: '#db2777', pulseColor: '#f9a8d4', label: '幼稚園・保育園', radius: 1000,
      popupBuilder: (el) => {
        const name = el.tags?.name || '幼稚園・こども園';
        const typeLabel = el.tags?._typeLabel || '幼稚園';
        const phone = el.tags?.phone || el.tags?.['contact:phone'] || el.tags?.['contact:mobile'] || '';
        const hours = el.tags?.opening_hours || '';
        const area = getAreaHint();
        const searchQ = encodeURIComponent(area ? `${name} ${area}` : name);
        const elLat = el.lat ?? el.center?.lat;
        const elLon = el.lon ?? el.center?.lon;
        const mapsQ = elLat && elLon ? `${elLat},${elLon}` : searchQ;
        return `
          <p style="font-size:12px;margin:0;font-weight:600">${name}</p>
          <p style="font-size:10px;margin:2px 0 0;color:#888">${typeLabel}</p>
          ${phone ? `<p style="font-size:10px;margin:4px 0 0"><a href="tel:${phone}" style="color:#333;text-decoration:none">📞 ${phone}</a></p>` : ''}
          ${hours ? `<p style="font-size:10px;margin:2px 0 0;color:#666">🕐 ${hours}</p>` : ''}
          <div style="margin-top:6px;display:flex;gap:6px">
            <a href="https://www.google.com/search?q=${searchQ}" target="_blank" rel="noopener"
               style="font-size:10px;color:#2563eb;text-decoration:none;background:#eff6ff;padding:2px 7px;border-radius:4px">🔍 Web検索</a>
            <a href="https://www.google.com/maps?q=${mapsQ}" target="_blank" rel="noopener"
               style="font-size:10px;color:#2563eb;text-decoration:none;background:#eff6ff;padding:2px 7px;border-radius:4px">📍 地図</a>
          </div>`;
      },
    },
    school: {
      customQuery: (r, lat, lng) =>
        `[out:json][timeout:15];(node["amenity"="school"]["name"~"小学校|中学校|高校|高等学校|義務教育学校"](around:${r},${lat},${lng});way["amenity"="school"]["name"~"小学校|中学校|高校|高等学校|義務教育学校"](around:${r},${lat},${lng});relation["amenity"="school"]["name"~"小学校|中学校|高校|高等学校|義務教育学校"](around:${r},${lat},${lng}););out center;`,
      emoji: '🏫', color: '#7c3aed', pulseColor: '#a78bfa', label: '小学校・中学校', radius: 1500,
    },
    busstop: {
      tags: ['highway=bus_stop'],
      emoji: '🚌', color: '#0284c7', pulseColor: '#38bdf8', label: 'バス停', radius: 600,
    },
    buildings: {
      emoji: '🏢', color: '#6366f1', pulseColor: '#a5b4fc', label: 'マンション',
    },
    reform: {
      apiPath: (lat, lng) => `/api/reform?lat=${lat}&lng=${lng}`,
      emoji: '🔨', color: '#d97706', pulseColor: '#fbbf24', label: 'リフォーム会社',
    },
  };

  const clearPOIMarkers = (type) => {
    poiMarkersRef.current
      .filter(m => m._poiType === type)
      .forEach(m => m.remove());
    poiMarkersRef.current = poiMarkersRef.current.filter(m => m._poiType !== type);
  };

  const applyMarkerHighlight = (el) => {
    const icon  = el.querySelector('.iescore-poi-icon');
    const pulse = el.querySelector('.iescore-poi-pulse');
    if (icon)  { icon.style.transform = 'scale(1.7)'; icon.style.boxShadow = '0 0 0 3px white, 0 0 0 5px rgba(0,0,0,0.25)'; icon.style.transition = 'transform 0.15s, box-shadow 0.15s'; }
    if (pulse) { pulse.style.animationDuration = '0.5s'; pulse.style.width = '42px'; pulse.style.height = '42px'; }
    el.style.zIndex = '100';
  };

  const clearMarkerHighlight = (el) => {
    const icon  = el.querySelector('.iescore-poi-icon');
    const pulse = el.querySelector('.iescore-poi-pulse');
    if (icon)  { icon.style.transform = ''; icon.style.boxShadow = ''; }
    if (pulse) { pulse.style.animationDuration = ''; pulse.style.width = ''; pulse.style.height = ''; }
    el.style.zIndex = '';
  };

  useEffect(() => {
    if (!highlightTarget || !map.current) return;
    const { lat, lng } = highlightTarget;

    // 前のハイライトを解除
    if (highlightedMarkerRef.current) {
      clearMarkerHighlight(highlightedMarkerRef.current.getElement());
      if (highlightedMarkerRef.current.getPopup()?.isOpen()) highlightedMarkerRef.current.togglePopup();
      highlightedMarkerRef.current = null;
    }

    // 対象マーカーを座標で検索（約110m以内）
    // HeartRails と OSM で同じ駅の座標が数十m単位でずれるケースがあるため余裕を持たせる
    const EPS = 0.001;
    const { poiType } = highlightTarget;
    const found = poiMarkersRef.current.find(m => {
      if (m._isHidden) return false;
      if (poiType && m._poiType !== poiType) return false;
      const pos = m.getLngLat();
      return Math.abs(pos.lat - lat) < EPS && Math.abs(pos.lng - lng) < EPS;
    });

    // lat===null は「ハイライト解除＋元の住所に戻る」シグナル
    if (lat === null) {
      if (flyToRef.current) {
        const returnZoom = savedZoomRef.current ?? map.current.getZoom();
        savedZoomRef.current = null;
        map.current.flyTo({ center: [flyToRef.current.lng, flyToRef.current.lat], zoom: returnZoom, essential: true });
      }
      return;
    }

    savedZoomRef.current = map.current.getZoom();
    map.current.flyTo({ center: [lng, lat], zoom: map.current.getZoom(), essential: true });

    if (found) {
      applyMarkerHighlight(found.getElement());
      if (!found.getPopup()?.isOpen()) found.togglePopup();
      highlightedMarkerRef.current = found;
    }
  }, [highlightTarget]);

  const hidePOIMarkers = (type) => {
    poiMarkersRef.current
      .filter(m => m._poiType === type && !m._isHidden)
      .forEach(m => { m.remove(); m._isHidden = true; });
  };

  const showCachedPOIMarkers = (type) => {
    const hidden = poiMarkersRef.current.filter(m => m._poiType === type && m._isHidden);
    hidden.forEach(m => { m.addTo(map.current); m._isHidden = false; });
    return hidden.length > 0;
  };

  const addBuildingMarkers = (list) => {
    clearPOIMarkers('buildings');
    const cfg = POI_CONFIG.buildings;
    list.forEach(({ name, lat, lng }) => {
      const markerEl = document.createElement('div');
      markerEl.className = 'iescore-poi-marker';
      markerEl.innerHTML = `
        <div class="iescore-poi-pulse" style="background:${cfg.pulseColor}"></div>
        <div class="iescore-poi-icon" style="background:${cfg.color}">${cfg.emoji}</div>
      `;
      const popup = new mapboxgl.Popup({ offset: 18, closeButton: false })
        .setHTML(`<p style="font-size:12px;margin:0;font-weight:600">${name}</p>`);
      const marker = new mapboxgl.Marker({ element: markerEl })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current);
      marker._poiType = 'buildings';
      poiMarkersRef.current.push(marker);
    });
  };

  const clearBoundary = () => {
    if (!map.current) return;
    ['boundary-fill', 'boundary-outline'].forEach(id => {
      if (map.current.getLayer(id)) map.current.removeLayer(id);
    });
    if (map.current.getSource('boundary')) map.current.removeSource('boundary');
  };

  const fetchAndDrawBoundary = async (name) => {
    clearBoundary();
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=geojson&polygon_geojson=1&limit=1&accept-language=ja`,
        { headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' } }
      );
      const data = await res.json();
      const feature = data.features?.[0];
      const gtype = feature?.geometry?.type;
      if (!feature || !['Polygon', 'MultiPolygon'].includes(gtype)) return;
      if (!map.current.isStyleLoaded()) return;
      map.current.addSource('boundary', { type: 'geojson', data: feature });
      map.current.addLayer({
        id: 'boundary-fill',
        type: 'fill',
        source: 'boundary',
        paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.08 },
      });
      map.current.addLayer({
        id: 'boundary-outline',
        type: 'line',
        source: 'boundary',
        paint: { 'line-color': '#2563eb', 'line-width': 2, 'line-dasharray': [4, 2] },
      });
    } catch { /* silent */ }
  };

  const fetchBuildings = async (flyTo, showMarkers) => {
    clearPOIMarkers('buildings');
    const { lng, lat, featureType } = flyTo;
    const isArea = featureType && !['address', 'poi'].includes(featureType);
    const radius = isArea ? 400 : 20;

    setLoadingPOI('マンション');
    let buildingList = [];
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const res = await fetch(
        `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng},${lat}.json?radius=${radius}&limit=50&access_token=${token}`
      );
      const data = await res.json();

      const EXCLUDE_LAYERS = new Set(['road', 'road_label', 'water', 'water_label', 'admin', 'place_label', 'country_label', 'state_label', 'natural_label', 'airport_label', 'transit_stop_label']);
      const EXCLUDE_KW = ['社宅', '寮', '宿舎', '官舎'];
      const seen = new Set();

      (data.features || []).forEach(feat => {
        const rawName = feat.properties?.name_ja || feat.properties?.name;
        const fname = rawName?.replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, '').trim();
        if (!fname || seen.has(fname)) return;
        const layer = feat.properties?.tilequery?.layer || '';
        if (EXCLUDE_LAYERS.has(layer)) return;
        if (EXCLUDE_KW.some(kw => fname.includes(kw))) return;
        if (/^[0-9A-Za-z０-９\-－]+号棟$/.test(fname) || /^[A-Za-z]棟$/.test(fname)) return;
        const coords = feat.geometry?.coordinates;
        const featLng = Array.isArray(coords) && typeof coords[0] === 'number' ? coords[0] : lng;
        const featLat = Array.isArray(coords) && typeof coords[1] === 'number' ? coords[1] : lat;
        seen.add(fname);
        buildingList.push({ name: fname, lat: featLat, lng: featLng });
      });

      lastBuildingsRef.current = buildingList;
      if (activeLayersRef.current.buildings) addBuildingMarkers(buildingList);
    } catch {
      // silent
    } finally {
      onBuildingsLoadedRef.current?.(buildingList);
      setLoadingPOI(null);
    }
  };

  // サーバーサイドプロキシ（/api/overpass）+ KSJで全POIカウントを一括取得
  const fetchAllCountsFromOverpass = async (centerLng, centerLat) => {
    const [overpassRes, ksjRes] = await Promise.allSettled([
      fetch(`/api/overpass?lat=${centerLat}&lng=${centerLng}`).then(r => {
        if (!r.ok) throw new Error('overpass proxy ' + r.status);
        return r.json();
      }),
      fetch(`/api/ksj-poi?lat=${centerLat}&lng=${centerLng}&radius=1000`).then(r => r.json()),
    ]);

    // 国土数値情報から医療機関・幼稚園カウント
    let hospitals = 0, hospitals500 = 0, hospitalList = [];
    let kindergartens = 0, kindergartens500 = 0, kindergartenList = [];
    if (ksjRes.status === 'fulfilled') {
      const ksj = ksjRes.value;
      hospitals = (ksj.hospitals || 0) + (ksj.clinics || 0) + (ksj.dentals || 0);
      hospitals500 = (ksj.hospitals500 || 0) + (ksj.clinics500 || 0) + (ksj.dentals500 || 0);
      hospitalList = [...(ksj.hospitalList || []), ...(ksj.clinicList || []), ...(ksj.dentalList || [])]
        .map(f => ({ name: f.name, distanceM: f.distM, lat: f.lat, lng: f.lng }))
        .sort((a, b) => a.distanceM - b.distanceM)
        .slice(0, 20);
      kindergartens = (ksj.kindergartens || 0) + (ksj.kodomoen || 0);
      kindergartens500 = (ksj.kindergartens500 || 0) + (ksj.kodomoen500 || 0);
      kindergartenList = [...(ksj.kindergartenList || []), ...(ksj.kodomoenList || [])]
        .map(f => ({ name: f.name, distanceM: f.distM, lat: f.lat, lng: f.lng }))
        .sort((a, b) => a.distanceM - b.distanceM)
        .slice(0, 20);
    }

    // 各ソースが成功したフィールドのみ渡す。失敗時は既存データを上書きしない
    onConvenienceDataRef.current?.({
      overpassDone: true,
      ...(overpassRes.status === 'fulfilled' ? {
        overpassOk: true,
        ...overpassRes.value,
      } : {}),
      ...(ksjRes.status === 'fulfilled' ? {
        hospitals, hospitals500, hospitalList,
        kindergartens, kindergartens500, kindergartenList,
      } : {}),
    });
  };

  const fetchPOI = async (type, lng, lat) => {
    const cfg = POI_CONFIG[type];
    setLoadingPOI(cfg.label);
    try {
      let elements = [];

      if (type === 'medical' || type === 'kindergarten') {
        // 国土数値情報KSJから取得（医療・幼稚園共通）
        const res = await fetch(`/api/ksj-poi?lat=${lat}&lng=${lng}&radius=${cfg.radius}`);
        const d = await res.json();
        if (type === 'medical') {
          const TYPE_LABEL = { hospital: '病院', clinic: '診療所', dental: '歯科' };
          elements = [...(d.hospitalList || []), ...(d.clinicList || []), ...(d.dentalList || [])]
            .map(f => ({
              lat: f.lat, lon: f.lng,
              tags: {
                name: f.name,
                amenity: f.type === 'hospital' ? 'hospital' : f.type === 'dental' ? 'dentist' : 'clinic',
                _typeLabel: TYPE_LABEL[f.type] || '医療機関',
              },
            }));
        } else {
          // kindergarten: 幼稚園+こども園
          elements = [...(d.kindergartenList || []), ...(d.kodomoenList || [])]
            .map(f => ({
              lat: f.lat, lon: f.lng,
              tags: {
                name: f.name,
                amenity: 'kindergarten',
                _typeLabel: f.type === 'kodomoen' ? '認定こども園' : '幼稚園',
              },
            }));
        }
      } else if (cfg.apiPath) {
        // カスタムAPI（リフォーム会社等）
        const res = await fetch(cfg.apiPath(lat, lng));
        const data = await res.json();
        elements = data.map(d => ({
          lat: d.lat, lon: d.lng,
          tags: { name: d.name, address: d.address, tel: d.tel },
        }));
      } else {
        // Overpass API
        const r = cfg.radius;
        const query = cfg.customQuery
          ? cfg.customQuery(r, lat, lng)
          : `[out:json][timeout:15];(${cfg.tags.map(t => `node[${t}](around:${r},${lat},${lng});way[${t}](around:${r},${lat},${lng});`).join('')});out center;`;
        const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
        const text = await res.text();
        if (!text.startsWith('{')) return;
        elements = JSON.parse(text).elements || [];
      }

      if (cfg.filter) elements = elements.filter(cfg.filter);

      // マップレイヤー表示時に件数も更新（スーパー・コンビニ・バス停）
      if ((type === 'supermarket' || type === 'konbini' || type === 'busstop') && flyToRef.current) {
        const { lat: cLat, lng: cLng } = flyToRef.current;
        const list = [];
        let cnt500 = 0, cnt200 = 0;
        elements.forEach(el => {
          const eLat = el.lat ?? el.center?.lat;
          const eLng = el.lon ?? el.center?.lon;
          if (!eLat || !eLng) return;
          const d = Math.round(haversineM(cLat, cLng, eLat, eLng));
          const maxR = type === 'busstop' ? 500 : 1000;
          if (d <= maxR) list.push({ name: el.tags?.name || '', distanceM: d, lat: eLat, lng: eLng });
          if (d <= 500) cnt500++;
          if (d <= 200) cnt200++;
        });
        list.sort((a, b) => a.distanceM - b.distanceM);
        if (type === 'supermarket') {
          onConvenienceDataRef.current?.({ supermarkets: list.length, supermarkets500: cnt500, supermarketList: list });
        } else if (type === 'konbini') {
          onConvenienceDataRef.current?.({ konbinis: list.length, konbinis500: cnt500, konbiniList: list });
        } else if (type === 'busstop') {
          onConvenienceDataRef.current?.({ busStops: cnt500, busStops200: cnt200, busStopList: list });
        }
      }

      clearPOIMarkers(type);
      elements.forEach(el => {
        const elLat = el.lat ?? el.center?.lat;
        const elLng = el.lon ?? el.center?.lon;
        if (!elLat || !elLng) return;

        const markerEl = document.createElement('div');
        markerEl.className = 'iescore-poi-marker';
        markerEl.innerHTML = `
          <div class="iescore-poi-pulse" style="background:${cfg.pulseColor}"></div>
          <div class="iescore-poi-icon" style="background:${cfg.color}">${cfg.emoji}</div>
        `;

        const popupHtml = cfg.apiPath
          ? (() => {
              const name = el.tags?.name || cfg.label;
              const addr = el.tags?.address || '';
              const searchQ = encodeURIComponent(`${name} ${addr}`);
              return `<p style="font-size:12px;margin:0;font-weight:600">${name}</p>
                ${addr ? `<p style="font-size:10px;margin:3px 0 0;color:#666">${addr}</p>` : ''}
                ${el.tags?.tel ? `<p style="font-size:10px;margin:2px 0 0;color:#666">📞 ${el.tags.tel}</p>` : ''}
                <div style="margin-top:6px;display:flex;gap:6px">
                  <a href="https://www.google.com/search?q=${searchQ}" target="_blank" rel="noopener"
                     style="font-size:10px;color:#2563eb;text-decoration:none;background:#eff6ff;padding:2px 7px;border-radius:4px">🔍 Web検索</a>
                  <a href="https://www.google.com/maps/search/${searchQ}" target="_blank" rel="noopener"
                     style="font-size:10px;color:#2563eb;text-decoration:none;background:#eff6ff;padding:2px 7px;border-radius:4px">📍 地図</a>
                </div>`;
            })()
          : cfg.popupBuilder
            ? cfg.popupBuilder(el)
            : `<p style="font-size:12px;margin:0;font-weight:600">${el.tags?.name || cfg.label}</p>`;

        const popup = new mapboxgl.Popup({ offset: 18, closeButton: false }).setHTML(popupHtml);

        const marker = new mapboxgl.Marker({ element: markerEl })
          .setLngLat([elLng, elLat])
          .setPopup(popup)
          .addTo(map.current);

        marker._poiType = type;
        poiMarkersRef.current.push(marker);

      });

    } catch (e) {
      // silent
    } finally {
      setLoadingPOI(null);
    }
  };

  const setIsochroneVisibility = (visibility) => {
    ISO_CONTOURS.forEach(({ minutes }) => {
      [`iso-fill-${minutes}`, `iso-line-${minutes}`].forEach(id => {
        if (map.current?.getLayer(id)) {
          map.current.setLayoutProperty(id, 'visibility', visibility);
        }
      });
    });
  };

  return (
    <div className="relative flex-1 h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* ローディングトースト */}
      {loadingPOI && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900/80 text-white text-xs px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
          <span className="animate-spin">⏳</span>
          {loadingPOI}を検索中…
        </div>
      )}

      {/* 徒歩圏凡例 */}
      {activeLayers.isochrone && (
        <div className="absolute bottom-8 left-44 bg-white rounded-xl shadow-md p-3 flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-gray-500 mb-0.5">徒歩圏</p>
          {[
            { minutes: 5,  color: '#22c55e', label: '5分' },
            { minutes: 10, color: '#eab308', label: '10分' },
            { minutes: 15, color: '#f97316', label: '15分' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
