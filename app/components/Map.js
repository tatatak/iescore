'use client';

import { useEffect, useRef } from 'react';
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
    if (activeLayersRef.current.isochrone) {
      fetchIsochrone(flyTo.lng, flyTo.lat);
    }
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

    if (activeLayers.isochrone) {
      if (flyToRef.current) fetchIsochrone(flyToRef.current.lng, flyToRef.current.lat);
    } else {
      setIsochroneVisibility('none');
    }
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
