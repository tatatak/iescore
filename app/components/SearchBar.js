'use client';

import { useState, useRef, useEffect } from 'react';

const HISTORY_KEY = 'iescore_search_history';
const MAX_HISTORY = 8;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function saveToHistory(item) {
  const prev = loadHistory().filter(h => h.name !== item.name);
  const next = [item, ...prev].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

// ① 住所・エリア検索フォーム
export default function SearchBar({ onSelect, externalQuery }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => { setHistory(loadHistory()); }, []);

  useEffect(() => {
    if (externalQuery) { setQuery(externalQuery); setIsOpen(false); }
  }, [externalQuery]);

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
    if (!val) {
      setResults([]);
      setIsOpen(true);
      return;
    }
    timerRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const name = feature.properties.name_preferred || feature.properties.name;
    const featureType = feature.properties.feature_type || 'address';
    const isArea = featureType && featureType !== 'address';

    // エリア選択時: 市区名を先頭に付与して曖昧さを排除
    // 例: "二階堂" → "鎌倉市二階堂"
    let displayName = name;
    if (isArea) {
      const ctx = feature.properties.context || {};
      // ① Mapbox v6 context から市区名取得
      let city = ctx.locality?.name || ctx.place?.name || '';

      // ② place_formatted の先頭（ASCII・全角カンマ両対応）
      if (!city || name.includes(city)) {
        const pf = (feature.properties.place_formatted || '').split(/[,、]/)[0]?.trim() || '';
        if (pf && /[市区郡町村]$/.test(pf) && !name.includes(pf)) city = pf;
      }

      // ③ 現在の検索クエリが市区名なら最終手段として使用
      if (!city || name.includes(city)) {
        const q = query.trim();
        if (/^.+[市区郡町村]$/.test(q) && !name.includes(q)) city = q;
      }

      if (city && !name.includes(city)) displayName = `${city}${name}`;
    }

    const item = { lng, lat, name: displayName, featureType };
    onSelect(item);
    saveToHistory(item);
    setHistory(loadHistory());
    setQuery(displayName);
    setIsOpen(false); // 選択したら即閉じる。絞り込みはフォーカス時に再検索
  };

  const handleHistorySelect = (item) => {
    onSelect(item);
    saveToHistory(item);
    setHistory(loadHistory());
    setQuery(item.name);
    setIsOpen(false);
  };

  const handleDeleteHistory = (e, name) => {
    e.stopPropagation();
    const next = loadHistory().filter(h => h.name !== name);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setHistory(next);
  };

  const showHistory = isOpen && !query && history.length > 0;
  const showResults = isOpen && query.length >= 2 && results.length > 0;

  return (
    <div className="relative flex-1 min-w-0">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => {
          if (!query) {
            setIsOpen(true);
          } else if (query.length >= 2) {
            search(query); // 再フォーカスで絞り込み候補を再表示
          }
        }}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="① まず住所・駅名・エリアで検索してみよう"
        className="w-full px-4 py-1.5 text-sm border border-gray-300 rounded-full focus:outline-none focus:border-blue-500"
      />

      {showHistory && (
        <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[70] overflow-hidden">
          <li className="px-4 py-1.5 text-xs text-gray-400 font-medium border-b border-gray-100">履歴</li>
          {history.map((item) => (
            <li
              key={item.name}
              onMouseDown={() => handleHistorySelect(item)}
              className="flex items-center justify-between px-4 py-2 text-sm cursor-pointer hover:bg-blue-50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-gray-300 shrink-0">🕐</span>
                <span className="text-gray-700 truncate">{item.name}</span>
              </div>
              <button
                onMouseDown={(e) => handleDeleteHistory(e, item.name)}
                className="text-gray-300 hover:text-gray-500 shrink-0 ml-2 text-base leading-none"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {showResults && (
        <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[70] overflow-hidden">
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

// ② マンション名検索フォーム（住所入力後に有効化）
export function BuildingSearchBar({ currentLocation, onSelect, buildingList = [] }) {
  const [query, setQuery] = useState('');
  const [apiResults, setApiResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const enabled = !!currentLocation;

  // エリアが変わったらリセット
  useEffect(() => {
    setQuery('');
    setApiResults([]);
    setIsOpen(false);
  }, [currentLocation?.lat, currentLocation?.lng]);

  // 表示するリスト: buildingList があればローカルフィルタ、なければ API 結果
  const displayed = buildingList.length > 0
    ? (query.length === 0
        ? buildingList
        : buildingList.filter(b => b.name.includes(query)))
    : apiResults;

  const searchApi = async (q) => {
    if (!q || q.length < 2 || !currentLocation || buildingList.length > 0) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/buildings-search?q=${encodeURIComponent(q)}&lat=${currentLocation.lat}&lng=${currentLocation.lng}`
      );
      setApiResults(await res.json());
      setIsOpen(true);
    } catch {
      setApiResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => searchApi(val), 400);
  };

  const handleFocus = () => {
    if (enabled) setIsOpen(true);
  };

  const handleSelect = (building) => {
    const item = { lng: building.lng, lat: building.lat, name: building.name, featureType: 'address' };
    onSelect(item);
    setQuery(building.name);
    setIsOpen(false);
  };

  const areaLabel = currentLocation
    ? currentLocation.name.length > 14 ? currentLocation.name.slice(0, 14) + '…' : currentLocation.name
    : '';

  const showDropdown = isOpen && enabled && displayed.length > 0;
  const showEmpty = isOpen && enabled && query.length >= 2 && displayed.length === 0 && !loading;

  return (
    <div className="relative flex-1 min-w-0">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">🏢</span>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          disabled={!enabled}
          placeholder={enabled
            ? buildingList.length > 0
              ? `② ${areaLabel}のマンションを選ぼう（${buildingList.length}件）`
              : `② ${areaLabel}周辺のマンション名を入力`
            : '① を先に入力してね'}
          className={`w-full pl-8 pr-4 py-1.5 text-sm border rounded-full focus:outline-none transition-colors ${
            enabled
              ? 'border-indigo-300 focus:border-indigo-500 bg-white'
              : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
          }`}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 animate-pulse">検索中</span>
        )}
      </div>

      {showDropdown && (
        <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-indigo-100 rounded-xl shadow-xl z-[70] overflow-y-auto max-h-64">
          {displayed.map((b) => (
            <li
              key={`${b.name}-${b.lat}`}
              onMouseDown={() => handleSelect(b)}
              className="px-4 py-2.5 text-sm cursor-pointer hover:bg-indigo-50 flex items-center gap-2"
            >
              <span className="text-indigo-400 shrink-0">🏢</span>
              <span className="font-medium text-indigo-800">{b.name}</span>
            </li>
          ))}
        </ul>
      )}

      {showEmpty && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[70] px-4 py-3 text-xs text-gray-400">
          OSMに登録されていないマンションは見つかりません
        </div>
      )}
    </div>
  );
}
