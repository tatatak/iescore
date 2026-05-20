'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import SearchBar, { BuildingSearchBar } from '../components/SearchBar';
import ScorePanel from '../components/ScorePanel';

const Map = dynamic(() => import('../components/Map'), { ssr: false });

export default function Home() {
  const [flyTo, setFlyTo] = useState(null);
  const [areaFlyTo, setAreaFlyTo] = useState(null);
  const [activeLayers, setActiveLayers] = useState({});
  const [mobileView, setMobileView] = useState('map');
  const [searchBarQuery, setSearchBarQuery] = useState('');
  const [buildingList, setBuildingList] = useState([]);
  const [buildingsLoading, setBuildingsLoading] = useState(false);
  const [selectedPin, setSelectedPin] = useState(null);
  const [propertyType, setPropertyType] = useState('condo');
  const [mapConvData, setMapConvData] = useState(null);
  const [highlightTarget, setHighlightTarget] = useState(null);
  const [noiseData, setNoiseData] = useState(null);
  const scoreElRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    if (type === 'house' || type === 'condo') setPropertyType(type);
  }, []);

  const [mapFlash, setMapFlash] = useState(false);
  const [mapFlashKey, setMapFlashKey] = useState(0);
  const mapFlashTimerRef = useRef(null);
  const onTotalChange = useCallback((v) => {
    if (scoreElRef.current) {
      if (v == null) { scoreElRef.current.style.display = 'none'; }
      else {
        const pct = v / 10;
        const cls = pct >= 0.8 ? 'text-green-700 bg-green-50 border-green-200'
          : pct >= 0.6 ? 'text-blue-700 bg-blue-50 border-blue-200'
          : pct >= 0.4 ? 'text-amber-700 bg-amber-50 border-amber-200'
          : 'text-red-700 bg-red-50 border-red-200';
        scoreElRef.current.className = `inline-flex items-baseline gap-0.5 font-bold px-2 py-0.5 rounded-lg border text-sm ${cls}`;
        scoreElRef.current.innerHTML = `総合 ${v}<span style="font-size:0.75em;font-weight:400;opacity:0.5">/10</span>`;
        scoreElRef.current.style.display = '';
      }
    }
  }, []);

  const handlePropertyTypeChange = (type) => {
    setPropertyType(type);
    if (type === 'house') {
      setSelectedPin(null);
      setActiveLayers(prev => ({ ...prev, buildings: false }));
    }
  };

  const toggleLayer = (id) => {
    setActiveLayers(prev => {
      const next = !prev[id];
      if (next) {
        clearTimeout(mapFlashTimerRef.current);
        setMapFlash(false);
        setTimeout(() => {
          setMapFlash(true);
          setMapFlashKey(k => k + 1);
          mapFlashTimerRef.current = setTimeout(() => setMapFlash(false), 1800);
        }, 10);
      }
      return { ...prev, [id]: next };
    });
  };

  const handleBuildingsLoaded = useCallback((list) => {
    setBuildingList(list);
    setBuildingsLoading(false);
  }, []);

  const handleConvenienceData = useCallback((data) => {
    setMapConvData(data);
  }, []);

  const handleSelect = (loc) => {
    setFlyTo(loc);
    setAreaFlyTo(loc);
    setMobileView('score');
    setSearchBarQuery(loc.name);
    setMapConvData(null);
    const isArea = loc.featureType && !['address', 'poi', 'street'].includes(loc.featureType);
    if (!isArea) setBuildingList([]);
    setBuildingsLoading(isArea && propertyType === 'condo');
    setActiveLayers(prev => ({ ...prev, buildings: isArea && propertyType === 'condo' }));
    setSelectedPin(null);
  };

  // ?q= パラメータがあれば初期ロード時に自動検索・選択
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (!q) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    fetch(`https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&access_token=${token}&language=ja&country=jp&limit=1`)
      .then(r => r.json())
      .then(data => {
        const f = data?.features?.[0];
        if (!f) return;
        const [lng, lat] = f.geometry.coordinates;
        handleSelect({
          lat,
          lng,
          name: f.properties?.name || q,
          featureType: f.properties?.feature_type,
        });
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // マンション名フォームからの選択 → 赤ピン + 地図底部バー
  const handleBuildingSelect = (loc) => {
    setFlyTo({ ...loc, skipBuildingSearch: true });
    setMobileView('score');
    setMapConvData(null);
    setBuildingsLoading(false);
    setActiveLayers(prev => ({ ...prev, buildings: false }));
    setSelectedPin(loc);

    // Mapbox v6 逆ジオコーディングで住所取得
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    fetch(`https://api.mapbox.com/search/geocode/v6/reverse?longitude=${loc.lng}&latitude=${loc.lat}&access_token=${token}&language=ja&types=address,neighborhood,locality`)
      .then(r => r.json())
      .then(data => {
        const f = data?.features?.[0];
        if (!f) return;
        const ctx = f.properties?.context || {};
        const parts = [
          ctx.region?.name || '',
          ctx.place?.name || '',
          ctx.locality?.name || ctx.neighborhood?.name || '',
        ].filter(Boolean);
        const addr = parts.join('');
        if (addr) setSelectedPin(prev => prev?.name === loc.name ? { ...prev, address: addr } : prev);
      })
      .catch(() => {});
  };

  const handleMapClick = (loc) => {
    setFlyTo(loc);
    setAreaFlyTo(loc);
    setMobileView('score');
    setSearchBarQuery(loc.name);
    setMapConvData(null);
    const isArea = loc.featureType && !['address', 'poi', 'street'].includes(loc.featureType);
    setBuildingsLoading(isArea && propertyType === 'condo');
    setActiveLayers(prev => ({ ...prev, buildings: isArea && propertyType === 'condo' }));
    setSelectedPin(null);
  };

  const handleFlyTo = (loc) => {
    setFlyTo(loc);
    setMobileView('score');
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-x-hidden w-full">
      <header className="flex items-start gap-3 px-4 py-2 bg-white border-b border-gray-200 shrink-0 z-[60]">
        {/* 左: フォーム群 */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-1">
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
            <Link
              href="/area"
              className="ml-2 px-3 py-1 text-xs rounded-lg font-medium whitespace-nowrap bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            >
              🗺️ 広域
            </Link>
            <Link
              href="/"
              className="px-3 py-1 text-xs rounded-lg font-medium whitespace-nowrap bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            >
              📝 記事
            </Link>
          </div>
          <SearchBar onSelect={handleSelect} externalQuery={searchBarQuery} proximity={areaFlyTo} />
          {propertyType === 'condo' && (
            <BuildingSearchBar currentLocation={areaFlyTo} onSelect={handleBuildingSelect} buildingList={buildingList} />
          )}
        </div>
        {/* 右: ロゴ + 総合スコア */}
        <h1 className="shrink-0 flex flex-col items-center gap-1">
          <Image src="/logo.png" alt="イエスコア" width={1396} height={684} className="h-10 md:h-16 w-auto" priority style={{ width: 'auto' }} />
          <span ref={scoreElRef} style={{ display: 'none' }} />
        </h1>
      </header>

      <main className="relative flex flex-1 overflow-hidden">
        {/* 地図: PCは常に表示、スマホはmap表示時のみ */}
        <div className={['flex-1 h-full relative overflow-hidden', mobileView === 'score' ? 'hidden md:block' : 'block'].join(' ')}>
          <Map flyTo={flyTo} activeLayers={activeLayers} onToggleLayer={toggleLayer} onMapClick={handleMapClick} onBuildingsLoaded={handleBuildingsLoaded} selectedPin={selectedPin} propertyType={propertyType} onConvenienceData={handleConvenienceData} highlightTarget={highlightTarget} onNoiseData={setNoiseData} />

          {/* ウェルカムオーバーレイ: 住所未選択時のみ表示 */}
          {!flyTo && (
            <div className="absolute inset-0 flex items-center justify-center z-[50] bg-black/40 pointer-events-none">
              <div className="bg-white rounded-2xl shadow-2xl p-8 mx-4 max-w-sm w-full pointer-events-auto text-center flex flex-col items-center gap-4">
                <Image src="/logo.png" alt="イエスコア" width={1396} height={684} className="h-14 w-auto" priority style={{ width: 'auto' }} />
                <p className="text-gray-800 font-bold leading-snug whitespace-nowrap" style={{ fontSize: 'clamp(0.9rem, 5vw, 1.25rem)' }}>
                  「ここに住んで、本当に大丈夫？」
                </p>
                <p className="text-blue-600 font-semibold text-base leading-snug -mt-2">
                  その不安、イエスコアが答えます。
                </p>
                <div className="flex flex-col gap-1.5 w-full">
                  {['🌊 水害・地盤・災害リスクがわかる', '🚉 駅・スーパー・病院までの距離がわかる', '📊 そのエリアの物件の相場がわかる', '📈 そのエリアの物件の将来価値がわかる'].map(t => (
                    <div key={t} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 text-left">{t}</div>
                  ))}
                </div>
                <p className="text-sm text-gray-600 font-medium text-center mb-0.5">🏢 マンション・🏡 戸建て</p>
                <div className="flex items-center gap-2 text-blue-500 text-sm animate-bounce">
                  <span>⬆️</span><span>上のフォームに住所を入力しよう</span>
                </div>
                <p className="text-sm text-gray-600 font-medium">完全無料・登録不要</p>
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
            buildingAddress={selectedPin?.address || null}
            propertyType={propertyType}
            onTotalChange={onTotalChange}
            buildingsLoading={buildingsLoading}
            mapConvData={mapConvData}
            onHighlightPOI={(lat, lng, poiType) => setHighlightTarget({ lat, lng, poiType: poiType ?? null, ts: Date.now() })}
            noiseData={noiseData}
          />
          </div>
        </div>
      </main>

      {/* モバイル用ボトムタブバー */}
      <div className="md:hidden flex border-t border-gray-200 bg-white shrink-0">
        <button
          onClick={() => setMobileView('map')}
          className={`flex-1 py-1.5 flex flex-row items-center justify-center gap-1.5 text-xs font-medium transition-colors relative overflow-hidden rounded-tl-lg ${
            mobileView === 'map' ? 'text-blue-600' : mapFlash ? 'text-red-500' : 'text-gray-400'
          }`}
        >
          {mapFlash && (
            <span key={mapFlashKey} className="map-tab-glow absolute inset-0 rounded pointer-events-none" />
          )}
          <span className={`text-base leading-none relative z-10 transition-transform duration-300 ${mapFlash ? 'scale-125' : 'scale-100'}`}>🗺</span>
          <span className="relative z-10">地図</span>
        </button>
        <button
          onClick={() => setMobileView('score')}
          className={`flex-1 py-1.5 flex flex-row items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
            mobileView === 'score' ? 'text-blue-600' : 'text-gray-400'
          }`}
        >
          <span className="text-base leading-none">📊</span>
          カルテ
        </button>
        <Link
          href="/"
          className="flex-1 py-1.5 flex flex-row items-center justify-center gap-1.5 text-xs font-medium transition-colors text-gray-400 hover:text-gray-600"
        >
          <span className="text-base leading-none">📝</span>
          記事
        </Link>
      </div>

      {/* 会社名フッター */}
      <footer className="text-center text-xs text-gray-400 py-1 bg-white border-t border-gray-100 shrink-0">
        © {new Date().getFullYear()} <Link href="/about" className="hover:underline">アクアオーブ株式会社</Link>
      </footer>
    </div>
  );
}
