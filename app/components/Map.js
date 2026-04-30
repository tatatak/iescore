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
];

const ISO_CONTOURS = [
  { minutes: 15, color: '#f97316', fillOpacity: 0.1 },
  { minutes: 10, color: '#eab308', fillOpacity: 0.15 },
  { minutes:  5, color: '#22c55e', fillOpacity: 0.2  },
];

export default function Map({ flyTo, activeLayers, onToggleLayer }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const flyToRef = useRef(null);
  const activeLayersRef = useRef(activeLayers);
  const prevActiveLayersRef = useRef({});
  const poiMarkersRef = useRef([]);
  const [loadingPOI, setLoadingPOI] = useState(null);

  useEffect(() => { activeLayersRef.current = activeLayers; }, [activeLayers]);

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

  // flyTo
  useEffect(() => {
    if (!flyTo || !map.current) return;
    flyToRef.current = flyTo;
    map.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: 14, essential: true });
    if (activeLayersRef.current.isochrone) fetchIsochrone(flyTo.lng, flyTo.lat);
    ['supermarket', 'station', 'medical', 'school', 'busstop'].forEach(type => {
      if (activeLayersRef.current[type]) fetchPOI(type, flyTo.lng, flyTo.lat);
    });
  }, [flyTo]);

  // レイヤー表示切替
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    HAZARD_LAYERS.forEach(({ id, tiles }) => {
      tiles.forEach((_, i) => {
        const layerId = `${id}-layer-${i}`;
        if (!map.current.getLayer(layerId)) return;
        map.current.setLayoutProperty(layerId, 'visibility', activeLayers[id] ? 'visible' : 'none');
      });
    });

    const prev = prevActiveLayersRef.current;

    if (activeLayers.isochrone !== prev.isochrone) {
      if (activeLayers.isochrone) {
        if (flyToRef.current) fetchIsochrone(flyToRef.current.lng, flyToRef.current.lat);
      } else {
        setIsochroneVisibility('none');
      }
    }

    ['supermarket', 'station', 'medical', 'school', 'busstop'].forEach(type => {
      if (activeLayers[type] === prev[type]) return; // 変化なし → スキップ
      if (activeLayers[type]) {
        if (flyToRef.current) fetchPOI(type, flyToRef.current.lng, flyToRef.current.lat);
      } else {
        clearPOIMarkers(type);
      }
    });

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
    },
    school: {
      tags: ['amenity=school', 'amenity=kindergarten'],
      emoji: '🏫', color: '#7c3aed', pulseColor: '#a78bfa', label: '学校・保育園', radius: 1500,
    },
    busstop: {
      tags: ['highway=bus_stop'],
      emoji: '🚌', color: '#0284c7', pulseColor: '#38bdf8', label: 'バス停', radius: 600,
    },
  };

  const clearPOIMarkers = (type) => {
    poiMarkersRef.current
      .filter(m => m._poiType === type)
      .forEach(m => m.remove());
    poiMarkersRef.current = poiMarkersRef.current.filter(m => m._poiType !== type);
  };

  const fetchPOI = async (type, lng, lat) => {
    clearPOIMarkers(type);
    const cfg = POI_CONFIG[type];
    const r = cfg.radius;
    const tagQuery = cfg.tags.map(t => `node[${t}](around:${r},${lat},${lng});way[${t}](around:${r},${lat},${lng});`).join('');
    const query = `[out:json][timeout:15];(${tagQuery});out center;`;
    setLoadingPOI(cfg.label);
    try {
      const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const text = await res.text();
      if (!text.startsWith('{')) return;
      const data = JSON.parse(text);
      data.elements?.forEach(el => {
        const elLat = el.lat ?? el.center?.lat;
        const elLng = el.lon ?? el.center?.lon;
        if (!elLat || !elLng) return;

        const markerEl = document.createElement('div');
        markerEl.className = 'iescore-poi-marker';
        markerEl.innerHTML = `
          <div class="iescore-poi-pulse" style="background:${cfg.pulseColor}"></div>
          <div class="iescore-poi-icon" style="background:${cfg.color}">${cfg.emoji}</div>
        `;

        const popup = new mapboxgl.Popup({ offset: 18, closeButton: false })
          .setHTML(`<p style="font-size:12px;margin:0;font-weight:600">${el.tags?.name || cfg.label}</p>`);

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

      {/* ハザードマップ切り替えボタン */}
      <div className="absolute bottom-8 left-4 bg-white rounded-xl shadow-md p-3 flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-500 mb-1">ハザードマップ</p>
        {HAZARD_LAYERS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onToggleLayer(id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeLayers[id]
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

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
