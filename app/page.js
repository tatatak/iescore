'use client';

import dynamic from 'next/dynamic';

const Map = dynamic(() => import('./components/Map'), { ssr: false });

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center px-4 h-14 bg-white border-b border-gray-200 shrink-0">
        <h1 className="text-xl font-bold text-gray-900">イエスコア</h1>
        <p className="ml-3 text-sm text-gray-500">その価格、適正ですか？</p>
      </header>
      <main className="flex-1">
        <Map />
      </main>
    </div>
  );
}
