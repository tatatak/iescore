'use client';

import { useState } from 'react';

function Stars({ score }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`text-lg ${i <= score ? 'text-yellow-400' : 'text-gray-200'}`}>
          ★
        </span>
      ))}
    </div>
  );
}

function ScoreCard({ icon, label, score, value, note }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="text-sm font-semibold text-gray-700">{label}</span>
        </div>
        <Stars score={score} />
      </div>
      <p className="text-sm text-gray-600">{value}</p>
      {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
    </div>
  );
}

const CHECKLIST = [
  {
    category: '自然災害リスク',
    icon: '🌊',
    items: [
      { id: 'flood', label: '洪水浸水リスクを確認した', mapLayer: 'flood', note: 'クリックで地図に浸水エリアを表示' },
      { id: 'landslide', label: '土砂災害リスクを確認した', mapLayer: 'landslide', note: 'クリックで地図に警戒区域を表示' },
    ],
  },
  {
    category: '立地・利便性',
    icon: '🚉',
    items: [
      { id: 'station', label: '最寄り駅まで徒歩15分以内', note: '実際に歩いて所要時間を確認' },
      { id: 'supermarket', label: '徒歩圏にスーパーがある', note: '徒歩10分以内が目安' },
      { id: 'medical', label: '医療機関・学校が近くにある', note: '子育て世帯は学区・保育園の空きも確認' },
    ],
  },
  {
    category: '建物・構造',
    icon: '🏗️',
    items: [
      { id: 'quake', label: '新耐震基準（1981年6月以降）', note: '旧耐震は融資・売却時に不利になりやすい' },
      { id: 'condition', label: '外壁・共用部の管理状態を確認', note: '管理組合の議事録・修繕履歴も確認' },
      { id: 'repair_fund', label: '修繕積立金が適正か（マンション）', note: '月1万円以下は値上げリスク大' },
    ],
  },
  {
    category: '権利・法律',
    icon: '📋',
    items: [
      { id: 'boundary', label: '土地の境界が確定している', note: '未確定なら売主負担での確定を交渉' },
      { id: 'private_road', label: '私道負担・通行権を確認した', note: '私道に面する場合は持分・掘削権に注意' },
      { id: 'floor_area', label: '建ぺい率・容積率を確認した', note: '将来の増改築の可能性に影響する' },
    ],
  },
  {
    category: '資金計画',
    icon: '💰',
    items: [
      { id: 'loan', label: '月々のローン返済額を試算した', note: '手取り月収の25%以内が目安' },
      { id: 'misc_cost', label: '諸費用を見込んでいる', note: '物件価格の3〜7%（登記・仲介・税など）' },
      { id: 'running', label: '管理費・固定資産税を加算した', note: 'ランニングコストを含めた総支出で判断' },
    ],
  },
];

export default function ScorePanel({ location, activeLayers, onToggleLayer }) {
  const [activeTab, setActiveTab] = useState('score');
  const [checkedItems, setCheckedItems] = useState({});

  const toggleCheck = (id) => setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));

  const allItems = CHECKLIST.flatMap(c => c.items);
  const totalCount = allItems.length;
  const checkedCount = allItems.filter(item =>
    item.mapLayer ? !!activeLayers[item.mapLayer] : !!checkedItems[item.id]
  ).length;

  if (!location) {
    return (
      <div className="w-72 shrink-0 bg-gray-50 border-l border-gray-200 flex flex-col items-center justify-center p-6 text-center">
        <span className="text-4xl mb-3">🏠</span>
        <p className="text-sm font-semibold text-gray-600">エリアを検索してください</p>
        <p className="text-xs text-gray-400 mt-2">
          住所や駅名を検索すると<br />エリアスコアが表示されます
        </p>
      </div>
    );
  }

  const scores = [
    { icon: '💰', label: '価格水準', score: 3, value: '成約価格データ準備中', note: '国交省APIキー取得後に表示' },
    { icon: '👥', label: '人口動向', score: 4, value: '人口推移データ準備中', note: 'e-Stat API接続後に表示' },
    { icon: '🌊', label: 'ハザードリスク', score: 4, value: '浸水・土砂リスクデータ準備中', note: '国土地理院タイル接続後に表示' },
    { icon: '🚉', label: '利便性', score: 3, value: '乗降客数データ準備中', note: '国土数値情報接続後に表示' },
  ];

  const total = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);

  return (
    <div className="w-72 shrink-0 bg-gray-50 border-l border-gray-200 flex flex-col overflow-hidden">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 p-4 shrink-0">
        <p className="text-xs text-gray-400 mb-1">エリアスコア</p>
        <p className="font-bold text-gray-900 text-base leading-snug">{location.name}</p>
        <div className="flex items-center gap-2 mt-2">
          <Stars score={total} />
          <span className="text-sm text-gray-500">総合 {total}/5</span>
        </div>
      </div>

      {/* タブ */}
      <div className="flex border-b border-gray-200 bg-white shrink-0">
        <button
          onClick={() => setActiveTab('score')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'score'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          スコア
        </button>
        <button
          onClick={() => setActiveTab('checklist')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'checklist'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          チェックリスト
          {checkedCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center bg-blue-500 text-white text-xs rounded-full w-4 h-4">
              {checkedCount}
            </span>
          )}
        </button>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'score' ? (
          <div className="flex flex-col gap-3 p-4">
            {scores.map((s) => <ScoreCard key={s.label} {...s} />)}
            <p className="text-xs text-gray-400 text-center pb-4">
              ※ データは順次接続予定。現在は構造確認用の表示です。
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {/* プログレスバー */}
            <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>確認済み</span>
                <span className="font-semibold">{checkedCount} / {totalCount}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(checkedCount / totalCount) * 100}%` }}
                />
              </div>
            </div>

            {CHECKLIST.map(({ category, icon, items }) => (
              <div key={category}>
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <span>{icon}</span>
                  <span className="text-xs font-bold text-gray-400">{category}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((item) => {
                    const checked = item.mapLayer ? !!activeLayers[item.mapLayer] : !!checkedItems[item.id];
                    return (
                      <button
                        key={item.id}
                        onClick={() => item.mapLayer ? onToggleLayer(item.mapLayer) : toggleCheck(item.id)}
                        className={`text-left w-full rounded-xl p-3 border shadow-sm transition-all ${
                          checked ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                            checked ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'
                          }`}>
                            {checked && '✓'}
                          </div>
                          <div>
                            <p className={`text-sm font-medium leading-snug ${checked ? 'text-blue-800' : 'text-gray-800'}`}>
                              {item.label}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 leading-tight">{item.note}</p>
                            {item.mapLayer && (
                              <p className={`text-xs mt-1 font-medium ${checked ? 'text-blue-500' : 'text-gray-300'}`}>
                                🗺 {checked ? '地図に表示中' : '地図に表示する'}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <p className="text-xs text-gray-400 text-center pb-2">
              ※ チェックはページを閉じるとリセットされます
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
