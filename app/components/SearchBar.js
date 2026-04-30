'use client';

import { useState, useRef } from 'react';

export default function SearchBar({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef(null);

  const search = async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&access_token=${token}&language=ja&country=jp&limit=6`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      setResults(data.features || []);
      setIsOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const name = feature.properties.name_preferred || feature.properties.name;
    onSelect({ lng, lat, name });
    setQuery(name);
    setIsOpen(false);
  };

  return (
    <div className="relative w-72">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="住所・駅名で検索（地番不可）"
        className="w-full px-4 py-1.5 text-sm border border-gray-300 rounded-full focus:outline-none focus:border-blue-500"
      />
      {isOpen && results.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {results.map((f) => (
            <li
              key={f.id}
              onMouseDown={() => handleSelect(f)}
              className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50"
            >
              <p className="font-medium text-gray-800">
                {f.properties.name_preferred || f.properties.name}
              </p>
              <p className="text-xs text-gray-400">{f.properties.place_formatted}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
