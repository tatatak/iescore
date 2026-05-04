'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import SearchBar, { BuildingSearchBar } from './components/SearchBar';
import ScorePanel from './components/ScorePanel';

const Map = dynamic(() => import('./components/Map'), { ssr: false });

function StreetViewDrawer({ building, onClose }) {
  const isOpen = !!building;
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const mapPreviewUrl = building
    ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+6366f1(${building.lng},${building.lat})/${building.lng},${building.lat},17,0/480x320@2x?access_token=${token}`
    : '';

  const strippedAddrForMaps = building?.address
    ? building.address
        .replace(/^.+?[都道府県]/, '')
        .replace(/[0-9０-９一二三四五六七八九十百千]+丁目.*/, '')
    : '';
  const googleMapsUrl = building
    ? `https://www.google.com/maps/search/${encodeURIComponent(
        building.name + (strippedAddrForMaps ? ' ' + strippedAddrForMaps : '')
      )}`
    : '';

  const buildingName = building?.name || '';
  const homesUrl  = building ? `https://www.homes.co.jp/archive/list/search/?keyword=${encodeURIComponent(buildingName)}` : '';
  const suumoUrl  = building ? `https://suumo.jp/library/search/ichiran.html?qr=${encodeURIComponent(buildingName + (strippedAddrForMaps ? ' ' + strippedAddrForMaps : ''))}` : '';
  const athomeUrl = building ? `https://www.athome.co.jp/bldg-library/bldname_search/${encodeURIComponent(buildingName)}/` : '';

  return (
    <>
      <div
        className={`absolute left-0 top-0 bottom-0 z-50 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out
          w-full md:w-80
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">マンション情報</p>
            <p className="font-bold text-gray-900 text-sm truncate">🏢 {building?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none shrink-0 ml-3">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* 地図プレビュー */}
          {building && (
            <div className="relative">
              <img
                src={mapPreviewUrl}
                alt={building.name}
                className="w-full object-cover"
                style={{ height: '220px' }}
              />
            </div>
          )}

          {/* アクションボタン */}
          <div className="p-4 flex flex-col gap-2">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              <span>🗺</span>
              Google Maps で開く
            </a>
            <p className="text-xs text-gray-400 px-1 pt-1">物件を探す</p>
            {[
              { href: homesUrl,  label: 'HOMES で探す',     bg: 'bg-orange-50 hover:bg-orange-100', text: 'text-orange-700', emoji: '🏠' },
              { href: suumoUrl,  label: 'SUUMO で探す',     bg: 'bg-green-50  hover:bg-green-100',  text: 'text-green-700',  emoji: '🏡' },
              { href: athomeUrl, label: 'アットホームで探す', bg: 'bg-blue-50   hover:bg-blue-100',   text: 'text-blue-700',   emoji: '🔑' },
            ].map(({ href, label, bg, text, emoji }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 w-full py-2.5 ${bg} ${text} text-sm font-semibold rounded-xl transition-colors`}
              >
                <span>{emoji}</span>
                {label}
              </a>
            ))}
          </div>

          <p className="text-xs text-gray-400 text-center pb-4">
            Street View はGoogleが提供するサービスです
          </p>
        </div>
      </div>
    </>
  );
}

export default function Home() {
  const [flyTo, setFlyTo] = useState(null);
  const [areaFlyTo, setAreaFlyTo] = useState(null);
  const [activeLayers, setActiveLayers] = useState({});
  const [mobileView, setMobileView] = useState('map');
  const [searchBarQuery, setSearchBarQuery] = useState('');
  const [buildingList, setBuildingList] = useState([]);
  const [selectedPin, setSelectedPin] = useState(null);
  const [propertyType, setPropertyType] = useState('condo');

  const handlePropertyTypeChange = (type) => {
    setPropertyType(type);
    if (type === 'house') {
      setSelectedPin(null);
      setActiveLayers(prev => ({ ...prev, buildings: false }));
    }
  };

  const toggleLayer = (id) => {
    setActiveLayers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelect = (loc) => {
    setFlyTo(loc);
    setAreaFlyTo(loc);
    setMobileView('score');
    setSearchBarQuery(loc.name);
    const isArea = loc.featureType && loc.featureType !== 'address';
    if (!isArea) setBuildingList([]);
    setActiveLayers(prev => ({ ...prev, buildings: isArea && propertyType === 'condo' }));
    setSelectedPin(null);
  };

  // マンション名フォームからの選択 → 赤ピン + 地図底部バー
  const handleBuildingSelect = (loc) => {
    setFlyTo({ ...loc, skipBuildingSearch: true });
    setMobileView('score');
    setActiveLayers(prev => ({ ...prev, buildings: false }));
    setSelectedPin(loc);

    // 住所を逆ジオコーディングで取得して selectedPin に追加（Nominatim: 番地レベルまで取得可能）
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.lat}&lon=${loc.lng}&addressdetails=1&accept-language=ja`, {
      headers: { 'User-Agent': 'iescore.com/1.0 (contact: admin@iescore.com)' }
    })
      .then(r => r.json())
      .then(data => {
        const a = data?.address;
        if (a) {
          // 日本の住所: road は遊歩道名が入るため除外。city_district で区を取得、house_number は稀にある
          const rawParts = [
            a.state || a.province || '',
            a.city || a.town || a.village || a.county || '',
            a.city_district || '',
            a.suburb || '',
            a.neighbourhood || a.quarter || '',
            a.house_number || '',
          ].filter(Boolean);
          // 重複除去（city_district と suburb が同じ場合など）
          const seen = new Set();
          const parts = rawParts.filter(v => { if (seen.has(v)) return false; seen.add(v); return true; });
          const addr = parts.join('');
          if (addr) setSelectedPin(prev => prev?.name === loc.name ? { ...prev, address: addr } : prev);
        }
      })
      .catch(() => {});
  };

  const handleMapClick = (loc) => {
    setFlyTo(loc);
    setAreaFlyTo(loc);
    setMobileView('score');
    setSearchBarQuery(loc.name);
    const isArea = loc.featureType && loc.featureType !== 'address';
    setActiveLayers(prev => ({ ...prev, buildings: isArea && propertyType === 'condo' }));
    setSelectedPin(null);
  };

  const handleFlyTo = (loc) => {
    setFlyTo(loc);
    setMobileView('score');
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-x-hidden w-full">
      <header className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 shrink-0 z-[60]">
        {/* 左: ロゴ */}
        <h1 className="shrink-0">
          <img src="/logo.png" alt="イエスコア" className="h-14 md:h-20 w-auto" />
        </h1>
        {/* 右: フォーム群 */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex gap-1">
            {[
              { id: 'condo', label: '🏢 マンション' },
              { id: 'house', label: '🏡 戸建て' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => handlePropertyTypeChange(id)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors whitespace-nowrap ${
                  propertyType === id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <SearchBar onSelect={handleSelect} externalQuery={searchBarQuery} />
          {propertyType === 'condo' && (
            <BuildingSearchBar currentLocation={areaFlyTo} onSelect={handleBuildingSelect} buildingList={buildingList} />
          )}
        </div>
      </header>

      <main className="relative flex flex-1 overflow-hidden">
        {/* 地図: PCは常に表示、スマホはmap表示時のみ */}
        <div className={['flex-1 h-full relative overflow-hidden', mobileView === 'score' ? 'hidden md:block' : 'block'].join(' ')}>
          <Map flyTo={flyTo} activeLayers={activeLayers} onToggleLayer={toggleLayer} onMapClick={handleMapClick} onBuildingsLoaded={setBuildingList} selectedPin={selectedPin} propertyType={propertyType} />

          {/* マンション選択時の底部バー */}
          {selectedPin && (
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-xl z-30 px-4 pt-3 pb-4">
              {/* PCのみ: マンション名・住所を表示 */}
              <div className="hidden md:flex items-start justify-between mb-2.5">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 mb-0.5">選択中のマンション</p>
                  <p className="font-bold text-gray-900 text-sm truncate">🏢 {selectedPin.name}</p>
                  {selectedPin.address && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{selectedPin.address}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedPin(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl shrink-0 ml-3 leading-none"
                >✕</button>
              </div>
              <div className="flex gap-2 items-center">
                {[
                  { href: `https://www.homes.co.jp/archive/list/search/?keyword=${encodeURIComponent(selectedPin.name)}`, label: 'HOMES', emoji: '🏠', cls: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
                  { href: (() => {
                    const s = selectedPin.address
                      ? selectedPin.address.replace(/^.+?[都道府県]/, '').replace(/[0-9０-９一二三四五六七八九十百千]+丁目.*/, '')
                      : '';
                    return `https://suumo.jp/library/search/ichiran.html?qr=${encodeURIComponent(selectedPin.name + (s ? ' ' + s : ''))}`;
                  })(), label: 'SUUMO', emoji: '🏡', cls: 'bg-green-50 text-green-700 hover:bg-green-100' },
                  { href: `https://www.athome.co.jp/bldg-library/bldname_search/${encodeURIComponent(selectedPin.name)}/`, label: 'athome', emoji: '🔑', cls: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
                ].map(({ href, label, emoji, cls }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg text-center transition-colors ${cls}`}>
                    <span className="block text-base leading-none mb-0.5">{emoji}</span>
                    {label}
                  </a>
                ))}
                {/* スマホ用 ✕ */}
                <button
                  onClick={() => setSelectedPin(null)}
                  className="md:hidden shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
                >✕</button>
              </div>
            </div>
          )}
        </div>

        {/* スコアパネル: PCは右サイド固定幅、スマホはscore表示時に全画面 */}
        <div className={['flex-col w-full md:w-[500px] md:shrink-0', mobileView === 'map' ? 'hidden md:flex' : 'flex'].join(' ')}>
          <div className="flex flex-col flex-1 overflow-hidden">
          <ScorePanel
            location={flyTo}
            activeLayers={activeLayers}
            onToggleLayer={toggleLayer}
            onFlyTo={handleFlyTo}
            onOpenDrawer={selectedPin ? () => setMobileView('map') : null}
            buildingAddress={selectedPin?.address || null}
            propertyType={propertyType}
          />
          </div>
        </div>
      </main>

      {/* モバイル用ボトムタブバー */}
      <div className="md:hidden flex border-t border-gray-200 bg-white shrink-0">
        <button
          onClick={() => setMobileView('map')}
          className={`flex-1 py-2 flex flex-col items-center gap-0.5 text-xs font-medium transition-colors ${
            mobileView === 'map' ? 'text-blue-600' : 'text-gray-400'
          }`}
        >
          <span className="text-xl leading-none">🗺</span>
          地図
        </button>
        <button
          onClick={() => setMobileView('score')}
          className={`flex-1 py-2 flex flex-col items-center gap-0.5 text-xs font-medium transition-colors ${
            mobileView === 'score' ? 'text-blue-600' : 'text-gray-400'
          }`}
        >
          <span className="text-xl leading-none">📊</span>
          スコア
        </button>
      </div>
    </div>
  );
}
