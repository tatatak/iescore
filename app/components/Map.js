'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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

export default function Map({ flyTo, activeLayers, onToggleLayer, onMapClick, onBuildingsLoaded, selectedPin, propertyType }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const flyToRef = useRef(null);
  const activeLayersRef = useRef(activeLayers);
  const prevActiveLayersRef = useRef({});
  const poiMarkersRef = useRef([]);
  const onMapClickRef = useRef(onMapClick);
  const onBuildingsLoadedRef = useRef(onBuildingsLoaded);
  const lastBuildingsRef = useRef([]);
  const selectedPinMarkerRef = useRef(null);
  const locationMarkerRef = useRef(null);
  const [loadingPOI, setLoadingPOI] = useState(null);

  useEffect(() => { activeLayersRef.current = activeLayers; }, [activeLayers]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { onBuildingsLoadedRef.current = onBuildingsLoaded; }, [onBuildingsLoaded]);

  // 地図初期化
  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [139.6917, 35.6895],
      zoom: 13,
      language: 'ja',
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
    flyToRef.current = flyTo;
    if (!flyTo.skipBuildingSearch) lastBuildingsRef.current = [];
    const isArea = flyTo.featureType && !['address', 'poi'].includes(flyTo.featureType);
    map.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: isArea ? 14 : 17, essential: true });

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
    if (activeLayersRef.current.isochrone) fetchIsochrone(flyTo.lng, flyTo.lat);
    // マンションモードのみ建物を取得（ドロップダウン用）、マーカーはチェックボックス状態に従う
    // skipBuildingSearch=true はマンション選択時のフライトなので建物リストを再取得しない
    if (propertyType !== 'house' && !flyTo.skipBuildingSearch) fetchBuildings(flyTo, activeLayersRef.current.buildings);
    ['supermarket', 'station', 'medical', 'kindergarten', 'school', 'busstop', 'reform'].forEach(type => {
      if (activeLayersRef.current[type]) fetchPOI(type, flyTo.lng, flyTo.lat);
    });
  }, [flyTo]);

  // レイヤー表示切替
  useEffect(() => {
    if (!map.current) return;

    // ハザードレイヤーはスタイルロード後のみ操作可（タイルロード中はスキップ）
    if (map.current.isStyleLoaded()) {
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
        map.current.easeTo({ zoom: 15, essential: true });
      } else {
        setIsochroneVisibility('none');
      }
    }

    ['supermarket', 'station', 'medical', 'kindergarten', 'school', 'busstop', 'reform'].forEach(type => {
      if (activeLayers[type] === prev[type]) return;
      if (activeLayers[type]) {
        if (flyToRef.current) fetchPOI(type, flyToRef.current.lng, flyToRef.current.lat);
      } else {
        clearPOIMarkers(type);
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

    prevActiveLayersRef.current = activeLayers;
  }, [activeLayers]);

  const fetchIsochrone = async (lng, lat) => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const minutes = ISO_CONTOURS.map(c => c.minutes).join(',');
    const url = `https://api.mapbox.com/isochrone/v1/mapbox/walking/${lng},${lat}?contours_minutes=${minutes}&polygons=true&access_token=${token}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!map.current || !map.current.isStyleLoaded()) return;

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

  const POI_CONFIG = {
    supermarket: {
      tags: ['shop=supermarket'],
      emoji: '🛒', color: '#16a34a', pulseColor: '#22c55e', label: 'スーパー', radius: 1500,
    },
    station: {
      tags: ['railway=station', 'railway=tram_stop'],
      emoji: '🚉', color: '#1d4ed8', pulseColor: '#60a5fa', label: '駅', radius: 2000,
    },
    medical: {
      tags: ['amenity=hospital', 'amenity=clinic', 'amenity=doctors'],
      emoji: '🏥', color: '#dc2626', pulseColor: '#f87171', label: '医療機関', radius: 1500,
      popupBuilder: (el) => {
        const name = el.tags?.name || '医療機関';
        const amenity = el.tags?.amenity || '';
        const typeLabel = amenity === 'hospital' ? '病院' : amenity === 'clinic' ? 'クリニック' : '診療所';
        const phone = el.tags?.phone || el.tags?.['contact:phone'] || el.tags?.['contact:mobile'] || '';
        const hours = el.tags?.opening_hours || '';
        const speciality = el.tags?.['healthcare:speciality'] || el.tags?.['medical_system:western'] || '';
        const searchQ = encodeURIComponent(name);
        return `
          <p style="font-size:12px;margin:0;font-weight:600">${name}</p>
          <p style="font-size:10px;margin:2px 0 0;color:#888">${typeLabel}${speciality ? ' · ' + speciality : ''}</p>
          ${phone ? `<p style="font-size:10px;margin:4px 0 0"><a href="tel:${phone}" style="color:#333;text-decoration:none">📞 ${phone}</a></p>` : ''}
          ${hours ? `<p style="font-size:10px;margin:2px 0 0;color:#666">🕐 ${hours}</p>` : ''}
          <div style="margin-top:6px;display:flex;gap:6px">
            <a href="https://www.google.com/search?q=${searchQ}" target="_blank" rel="noopener"
               style="font-size:10px;color:#2563eb;text-decoration:none;background:#eff6ff;padding:2px 7px;border-radius:4px">🔍 Web検索</a>
            <a href="https://www.google.com/maps/search/${searchQ}" target="_blank" rel="noopener"
               style="font-size:10px;color:#2563eb;text-decoration:none;background:#eff6ff;padding:2px 7px;border-radius:4px">📍 地図</a>
          </div>`;
      },
    },
    kindergarten: {
      tags: ['amenity=kindergarten', 'amenity=childcare'],
      emoji: '👶', color: '#db2777', pulseColor: '#f9a8d4', label: '幼稚園・保育園', radius: 1000,
      popupBuilder: (el) => {
        const name = el.tags?.name || '幼稚園・保育園';
        const amenity = el.tags?.amenity || '';
        const typeLabel = amenity === 'kindergarten' ? '幼稚園' : amenity === 'childcare' ? '保育園' : '幼稚園・保育園';
        const phone = el.tags?.phone || el.tags?.['contact:phone'] || el.tags?.['contact:mobile'] || '';
        const hours = el.tags?.opening_hours || '';
        const searchQ = encodeURIComponent(name);
        return `
          <p style="font-size:12px;margin:0;font-weight:600">${name}</p>
          <p style="font-size:10px;margin:2px 0 0;color:#888">${typeLabel}</p>
          ${phone ? `<p style="font-size:10px;margin:4px 0 0"><a href="tel:${phone}" style="color:#333;text-decoration:none">📞 ${phone}</a></p>` : ''}
          ${hours ? `<p style="font-size:10px;margin:2px 0 0;color:#666">🕐 ${hours}</p>` : ''}
          <div style="margin-top:6px;display:flex;gap:6px">
            <a href="https://www.google.com/search?q=${searchQ}" target="_blank" rel="noopener"
               style="font-size:10px;color:#2563eb;text-decoration:none;background:#eff6ff;padding:2px 7px;border-radius:4px">🔍 Web検索</a>
            <a href="https://www.google.com/maps/search/${searchQ}" target="_blank" rel="noopener"
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

  const fetchBuildings = async (flyTo, showMarkers) => {
    clearPOIMarkers('buildings');
    const { lng, lat, name, featureType } = flyTo;
    const types = 'apartments|residential|house|detached|terrace|semidetached_house|bungalow';

    // 区/町/村名を抽出（例: "東京都渋谷区" → "渋谷区"）
    const m = (name || '').match(/([^\s都道府県市]+[区町村])$/);
    const areaName = m ? m[1] : null;
    const useAreaQuery = featureType && !['address', 'poi'].includes(featureType) && areaName;

    // ±0.15度（約15km）のbboxをグローバルフィルターとして付与し、
    // 「南区」など全国に同名が存在する区名が他都市にマッチするのを防ぐ
    const bboxFilter = `[bbox:${lat - 0.15},${lng - 0.15},${lat + 0.15},${lng + 0.15}]`;

    const query = useAreaQuery
      ? `[out:json][timeout:30]${bboxFilter};area["name"="${areaName}"]["admin_level"~"[6-9]"]->.a;(way["building"~"${types}"]["name"](area.a);relation["building"~"${types}"]["name"](area.a););out center 300;`
      : `[out:json][timeout:15];(way["building"~"${types}"]["name"](around:1500,${lat},${lng});relation["building"~"${types}"]["name"](around:1500,${lat},${lng}););out center 100;`;

    setLoadingPOI('マンション');
    try {
      const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const text = await res.text();
      if (!text.startsWith('{')) return;
      const elements = JSON.parse(text).elements || [];

      const EXCLUDE_KW = ['社宅', '寮', '宿舎', '官舎'];
      const buildingList = [];
      elements.forEach(el => {
        const elLat = el.lat ?? el.center?.lat;
        const elLng = el.lon ?? el.center?.lon;
        const name = el.tags?.name;
        if (!elLat || !elLng || !name) return;
        if (EXCLUDE_KW.some(kw => name.includes(kw))) return;
        if (/^[0-9A-Za-z０-９\-－]+号棟$/.test(name) || /^[A-Za-z]棟$/.test(name)) return;
        buildingList.push({ name, lat: elLat, lng: elLng });
      });

      lastBuildingsRef.current = buildingList;
      if (activeLayersRef.current.buildings) addBuildingMarkers(buildingList);
      onBuildingsLoadedRef.current?.(buildingList);
    } catch {
      // silent
    } finally {
      setLoadingPOI(null);
    }
  };

  const fetchPOI = async (type, lng, lat) => {
    clearPOIMarkers(type);
    const cfg = POI_CONFIG[type];
    setLoadingPOI(cfg.label);
    try {
      let elements = [];

      if (cfg.apiPath) {
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
