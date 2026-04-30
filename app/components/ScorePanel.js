'use client';

import { useState, useEffect } from 'react';

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
      { id: 'isochrone', label: '徒歩5・10・15分圏を地図に表示', mapLayer: 'isochrone', note: 'クリックで徒歩圏エリアを表示（緑・黄・橙）' },
      { id: 'station', label: '最寄り駅まで徒歩15分以内', mapLayer: 'station', note: 'クリックで周辺の駅を地図に表示' },
      { id: 'busstop', label: 'バス停が近くにある', mapLayer: 'busstop', note: 'クリックで周辺のバス停を地図に表示' },
      { id: 'supermarket', label: '徒歩圏にスーパーがある', mapLayer: 'supermarket', note: 'クリックで周辺のスーパーを地図に表示' },
      { id: 'medical', label: '医療機関が近くにある', mapLayer: 'medical', note: 'クリックで周辺の病院・クリニックを地図に表示' },
      { id: 'school', label: '学校・保育園が近くにある', mapLayer: 'school', note: 'クリックで周辺の学校・保育園を地図に表示' },
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

const ALL_ITEMS = CHECKLIST.flatMap(c => c.items);
const TOTAL_COUNT = ALL_ITEMS.length;

function calcScore(checkedItems, activeLayers) {
  const checked = ALL_ITEMS.filter(item =>
    item.mapLayer ? !!activeLayers[item.mapLayer] : !!checkedItems[item.id]
  ).length;
  return { checked, stars: Math.round((checked / TOTAL_COUNT) * 5) };
}

function SavedList({ saved, onSelect, onDelete, onCompare }) {
  const [compareIds, setCompareIds] = useState([]);

  const toggleCompare = (id) => {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const comparing = saved.filter(p => compareIds.includes(p.id));

  if (saved.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-400 mt-8">
        <p className="text-2xl mb-2">📭</p>
        <p>保存済みの物件はありません</p>
        <p className="text-xs mt-1">チェックリストを記入して「保存」してください</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {compareIds.length >= 2 && (
        <button
          onClick={() => onCompare(comparing)}
          className="w-full py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl"
        >
          {compareIds.length}件を比較する
        </button>
      )}
      <p className="text-xs text-gray-400">最大3件まで比較できます</p>
      {saved.map(prop => (
        <div
          key={prop.id}
          className={`bg-white rounded-xl border shadow-sm p-3 transition-colors ${
            compareIds.includes(prop.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-100'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <button className="text-left flex-1" onClick={() => onSelect(prop)}>
              <p className="text-sm font-semibold text-gray-800 leading-tight">{prop.name}</p>
              <div className="flex items-center gap-1 mt-1">
                <Stars score={prop.stars} />
                <span className="text-xs text-gray-400">{prop.checked}/{TOTAL_COUNT}項目</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{new Date(prop.savedAt).toLocaleDateString('ja-JP')}</p>
            </button>
            <div className="flex flex-col gap-1 shrink-0">
              <button
                onClick={() => toggleCompare(prop.id)}
                className={`text-xs px-2 py-1 rounded-lg font-medium ${
                  compareIds.includes(prop.id)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                比較
              </button>
              <button
                onClick={() => onDelete(prop.id)}
                className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-400 hover:text-red-400"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CompareModal({ properties, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-gray-900">物件比較</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-3 text-gray-500 font-medium w-32">項目</th>
                {properties.map(p => (
                  <th key={p.id} className="p-3 text-center">
                    <p className="font-semibold text-gray-800 text-xs">{p.name}</p>
                    <div className="flex justify-center mt-1">
                      <Stars score={p.stars} />
                    </div>
                    <p className="text-xs text-gray-400">{p.checked}/{TOTAL_COUNT}項目</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CHECKLIST.map(cat => (
                <>
                  <tr key={cat.category} className="bg-gray-50">
                    <td colSpan={properties.length + 1} className="px-3 py-1.5 text-xs font-bold text-gray-400">
                      {cat.icon} {cat.category}
                    </td>
                  </tr>
                  {cat.items.map(item => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="p-3 text-xs text-gray-600 leading-tight">{item.label}</td>
                      {properties.map(p => {
                        const checked = item.mapLayer
                          ? !!(p.activeLayers || {})[item.mapLayer]
                          : !!(p.checkedItems || {})[item.id];
                        return (
                          <td key={p.id} className="p-3 text-center">
                            {checked
                              ? <span className="text-blue-500 font-bold">✓</span>
                              : <span className="text-gray-200">—</span>
                            }
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SaveModal({ defaultName, onSave, onCancel }) {
  const [name, setName] = useState(defaultName);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="font-bold text-gray-900 mb-1">物件名を入力</h2>
        <p className="text-xs text-gray-400 mb-4">わかりやすい名前をつけておくと比較しやすくなります</p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim())}
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 mb-4"
          placeholder="例：渋谷の候補物件・第1希望"
          autoFocus
        />
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
            キャンセル
          </button>
          <button
            onClick={() => name.trim() && onSave(name.trim())}
            className="flex-1 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-40"
            disabled={!name.trim()}
          >
            保存する
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ScorePanel({ location, activeLayers, onToggleLayer, onFlyTo }) {
  const [activeTab, setActiveTab] = useState('score');
  const [checkedItems, setCheckedItems] = useState({});
  const [saved, setSaved] = useState([]);
  const [compareProps, setCompareProps] = useState(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  useEffect(() => {
    const data = localStorage.getItem('iescore_saved');
    if (data) setSaved(JSON.parse(data));
  }, []);

  const toggleCheck = (id) => setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));

  const { checked, stars } = calcScore(checkedItems, activeLayers);

  const handleSave = () => {
    if (!location) return;
    setSaveModalOpen(true);
  };

  const handleSaveConfirm = (name) => {
    setSaveModalOpen(false);
    const newProp = {
      id: `prop_${Date.now()}`,
      name,
      lat: location.lat,
      lng: location.lng,
      checkedItems,
      activeLayers,
      checked,
      stars,
      savedAt: new Date().toISOString(),
    };
    const updated = [newProp, ...saved.filter(p => p.id !== newProp.id)];
    setSaved(updated);
    localStorage.setItem('iescore_saved', JSON.stringify(updated));
    setActiveTab('saved');
  };

  const handleDelete = (id) => {
    const updated = saved.filter(p => p.id !== id);
    setSaved(updated);
    localStorage.setItem('iescore_saved', JSON.stringify(updated));
  };

  const handleSelectSaved = (prop) => {
    if (onFlyTo) onFlyTo({ lat: prop.lat, lng: prop.lng, name: prop.name });
    setCheckedItems(prop.checkedItems || {});
    setActiveTab('checklist');
  };

  if (!location) {
    return (
      <div className="w-72 shrink-0 bg-gray-50 border-l border-gray-200 flex flex-col items-center justify-center p-6 text-center">
        <span className="text-4xl mb-3">🏠</span>
        <p className="text-sm font-semibold text-gray-600">エリアを検索してください</p>
        <p className="text-xs text-gray-400 mt-2">
          住所や駅名を検索すると<br />エリアスコアが表示されます
        </p>
        {saved.length > 0 && (
          <button
            onClick={() => setActiveTab('saved')}
            className="mt-4 text-xs text-blue-500 underline"
          >
            保存済み {saved.length} 件を見る
          </button>
        )}
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
    <>
      {compareProps && (
        <CompareModal properties={compareProps} onClose={() => setCompareProps(null)} />
      )}
      {saveModalOpen && (
        <SaveModal
          defaultName={location.name}
          onSave={handleSaveConfirm}
          onCancel={() => setSaveModalOpen(false)}
        />
      )}
      <div className="w-72 shrink-0 bg-gray-50 border-l border-gray-200 flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-white border-b border-gray-200 p-4 shrink-0">
          <p className="text-xs text-gray-400 mb-1">エリアスコア</p>
          <p className="font-bold text-gray-900 text-base leading-snug">{location.name}</p>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <Stars score={total} />
              <span className="text-sm text-gray-500">総合 {total}/5</span>
            </div>
            <button
              onClick={handleSave}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              保存
            </button>
          </div>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-200 bg-white shrink-0">
          {[
            { id: 'score', label: 'スコア' },
            { id: 'checklist', label: 'チェック' },
            { id: 'saved', label: `保存済み${saved.length > 0 ? ` (${saved.length})` : ''}` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'score' && (
            <div className="flex flex-col gap-3 p-4">
              {scores.map((s) => <ScoreCard key={s.label} {...s} />)}
              <p className="text-xs text-gray-400 text-center pb-4">
                ※ データは順次接続予定。現在は構造確認用の表示です。
              </p>
            </div>
          )}

          {activeTab === 'checklist' && (
            <div className="flex flex-col gap-4 p-4">
              {/* プログレスバー */}
              <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>確認済み</span>
                  <span className="font-semibold">{checked} / {TOTAL_COUNT}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(checked / TOTAL_COUNT) * 100}%` }}
                  />
                </div>
                <div className="flex justify-center mt-2">
                  <Stars score={stars} />
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
                      const isChecked = item.mapLayer ? !!activeLayers[item.mapLayer] : !!checkedItems[item.id];
                      return (
                        <button
                          key={item.id}
                          onClick={() => item.mapLayer ? onToggleLayer(item.mapLayer) : toggleCheck(item.id)}
                          className={`text-left w-full rounded-xl p-3 border shadow-sm transition-all ${
                            isChecked ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                              isChecked ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'
                            }`}>
                              {isChecked && '✓'}
                            </div>
                            <div>
                              <p className={`text-sm font-medium leading-snug ${isChecked ? 'text-blue-800' : 'text-gray-800'}`}>
                                {item.label}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5 leading-tight">{item.note}</p>
                              {item.mapLayer && (
                                <p className={`text-xs mt-1 font-medium ${isChecked ? 'text-blue-500' : 'text-gray-300'}`}>
                                  🗺 {isChecked ? '地図に表示中' : '地図に表示する'}
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

              <button
                onClick={handleSave}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700"
              >
                この物件を保存
              </button>
              <p className="text-xs text-gray-400 text-center pb-2">
                ※ チェックはページを閉じるとリセットされます
              </p>
            </div>
          )}

          {activeTab === 'saved' && (
            <SavedList
              saved={saved}
              onSelect={handleSelectSaved}
              onDelete={handleDelete}
              onCompare={setCompareProps}
            />
          )}
        </div>
      </div>
    </>
  );
}
