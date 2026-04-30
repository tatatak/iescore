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

export default function Map({ flyTo, activeLayers, onToggleLayer }) {
  const mapContainer = useRef(null);
  const map = useRef(null);

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

  useEffect(() => {
    if (!flyTo || !map.current) return;
    map.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: 14, essential: true });
  }, [flyTo]);

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    HAZARD_LAYERS.forEach(({ id, tiles }) => {
      tiles.forEach((_, i) => {
        const layerId = `${id}-layer-${i}`;
        if (!map.current.getLayer(layerId)) return;
        map.current.setLayoutProperty(
          layerId,
          'visibility',
          activeLayers[id] ? 'visible' : 'none'
        );
      });
    });
  }, [activeLayers]);

  return (
    <div className="relative flex-1 h-full">
      <div ref={mapContainer} className="w-full h-full" />

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
    </div>
  );
}
