'use client';

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

export default function ScorePanel({ location }) {
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

  // TODO: 各APIと接続後に実データに差し替え
  const scores = [
    {
      icon: '💰',
      label: '価格水準',
      score: 3,
      value: '成約価格データ準備中',
      note: '国交省APIキー取得後に表示',
    },
    {
      icon: '👥',
      label: '人口動向',
      score: 4,
      value: '人口推移データ準備中',
      note: 'e-Stat API接続後に表示',
    },
    {
      icon: '🌊',
      label: 'ハザードリスク',
      score: 4,
      value: '浸水・土砂リスクデータ準備中',
      note: '国土地理院タイル接続後に表示',
    },
    {
      icon: '🚉',
      label: '利便性',
      score: 3,
      value: '乗降客数データ準備中',
      note: '国土数値情報接続後に表示',
    },
  ];

  const total = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);

  return (
    <div className="w-72 shrink-0 bg-gray-50 border-l border-gray-200 flex flex-col overflow-y-auto">
      {/* エリア名 + 総合スコア */}
      <div className="bg-white border-b border-gray-200 p-4">
        <p className="text-xs text-gray-400 mb-1">エリアスコア</p>
        <p className="font-bold text-gray-900 text-base leading-snug">{location.name}</p>
        <div className="flex items-center gap-2 mt-2">
          <Stars score={total} />
          <span className="text-sm text-gray-500">総合 {total}/5</span>
        </div>
      </div>

      {/* 4指標 */}
      <div className="flex flex-col gap-3 p-4">
        {scores.map((s) => (
          <ScoreCard key={s.label} {...s} />
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center pb-4 px-4">
        ※ データは順次接続予定。現在は構造確認用の表示です。
      </p>
    </div>
  );
}
