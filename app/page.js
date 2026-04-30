'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import SearchBar from './components/SearchBar';
import ScorePanel from './components/ScorePanel';

const Map = dynamic(() => import('./components/Map'), { ssr: false });

export default function Home() {
  const [flyTo, setFlyTo] = useState(null);
  const [activeLayers, setActiveLayers] = useState({});

  const toggleLayer = (id) => {
    setActiveLayers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-4 px-4 h-14 bg-white border-b border-gray-200 shrink-0">
        <h1 className="text-xl font-bold text-gray-900 shrink-0">イエスコア</h1>
        <SearchBar onSelect={setFlyTo} />
      </header>
      <main className="flex flex-1 overflow-hidden">
        <Map flyTo={flyTo} activeLayers={activeLayers} onToggleLayer={toggleLayer} />
        <ScorePanel location={flyTo} activeLayers={activeLayers} onToggleLayer={toggleLayer} />
      </main>
    </div>
  );
}
