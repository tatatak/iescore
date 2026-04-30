'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import SearchBar from './components/SearchBar';
import ScorePanel from './components/ScorePanel';

const Map = dynamic(() => import('./components/Map'), { ssr: false });

export default function Home() {
  const [flyTo, setFlyTo] = useState(null);
  const [activeLayers, setActiveLayers] = useState({});
  const [mobileView, setMobileView] = useState('map');

  const toggleLayer = (id) => {
    setActiveLayers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelect = (loc) => {
    setFlyTo(loc);
    setMobileView('score');
  };

  const handleFlyTo = (loc) => {
    setFlyTo(loc);
    setMobileView('score');
  };

  return (
    <div className="flex flex-col h-[100dvh]">
      <header className="flex items-center gap-3 px-4 h-14 bg-white border-b border-gray-200 shrink-0 z-10">
        <h1 className="text-lg md:text-xl font-bold text-gray-900 shrink-0">イエスコア</h1>
        <SearchBar onSelect={handleSelect} />
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* 地図: PCは常に表示、スマホはmap表示時のみ */}
        <div className={`flex-1 h-full ${mobileView === 'score' ? 'hidden md:block' : 'block'}`}>
          <Map flyTo={flyTo} activeLayers={activeLayers} onToggleLayer={toggleLayer} />
        </div>

        {/* スコアパネル: PCは右サイド固定幅、スマホはscore表示時に全画面 */}
        <div className={`
          flex-col overflow-hidden
          w-full md:w-72 md:shrink-0
          ${mobileView === 'map' ? 'hidden md:flex' : 'flex'}
        `}>
          <ScorePanel
            location={flyTo}
            activeLayers={activeLayers}
            onToggleLayer={toggleLayer}
            onFlyTo={handleFlyTo}
          />
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
