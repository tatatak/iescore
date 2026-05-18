'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';

// 鉄道事業者名 → 短縮表記
const OPERATOR_ABBR = {
  '東日本旅客鉄道': 'JR東日本', '西日本旅客鉄道': 'JR西日本', '東海旅客鉄道': 'JR東海',
  '九州旅客鉄道': 'JR九州', '北海道旅客鉄道': 'JR北海道', '四国旅客鉄道': 'JR四国',
  '小田急電鉄': '小田急', '東急電鉄': '東急', '京急電鉄': '京急', '京浜急行電鉄': '京急',
  '東京地下鉄': 'メトロ', '東京メトロ': 'メトロ', '東京都交通局': '都営',
  '東武鉄道': '東武', '西武鉄道': '西武', '京王電鉄': '京王',
  '相模鉄道': '相鉄', '京成電鉄': '京成', '新京成電鉄': '新京成',
  '東京臨海高速鉄道': 'りんかい線', '首都圏新都市鉄道': 'TX',
  '埼玉新都市交通': 'ニューシャトル', '埼玉高速鉄道': '埼玉高速',
  '横浜高速鉄道': 'みなとみらい', '横浜市交通局': '横浜市営',
  '大阪市高速電気軌道': 'Osaka Metro', '大阪府都市開発': '泉北高速',
  '南海電気鉄道': '南海', '近畿日本鉄道': '近鉄', '阪急電鉄': '阪急',
  '阪神電気鉄道': '阪神', '京阪電気鉄道': '京阪',
  '名古屋鉄道': '名鉄', '名古屋市交通局': '名古屋市営',
  '西日本鉄道': '西鉄', '福岡市': '福岡市地下鉄',
};
function operatorLabel(op) {
  if (!op) return '';
  return OPERATOR_ABBR[op] || op;
}

// 全角数字→半角変換＋非数字除去（整数用・小数用）
const toHalfInt = (v) =>
  v.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
   .replace(/[^0-9]/g, '');
const toHalfDec = (v) => {
  let s = v
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[．。]/g, '.')
    .replace(/[^0-9.]/g, '');
  const dot = s.indexOf('.');
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
  return s;
};

function Stars({ score }) {
  const pct = score / 10;
  const cls = pct >= 0.8 ? 'text-green-700 bg-green-50 border-green-200'
    : pct >= 0.6 ? 'text-blue-700 bg-blue-50 border-blue-200'
    : pct >= 0.4 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-700 bg-red-50 border-red-200';
  return (
    <span className={`inline-flex items-baseline gap-0.5 font-bold px-2 py-0.5 rounded-lg border text-sm ${cls}`}>
      {score}<span className="text-xs font-normal opacity-50">/10</span>
    </span>
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
      {note && <p className="text-xs text-gray-700 font-medium mt-1">{note}</p>}
    </div>
  );
}

function getGroundInfo(score, avs, arv, jname) {
  const arvLabel = !arv ? null
    : arv < 1.5 ? { text: `${arv}倍（揺れにくい）`,      color: 'text-green-600'  }
    : arv < 2.0 ? { text: `${arv}倍（やや揺れにくい）`,  color: 'text-blue-600'   }
    : arv < 2.5 ? { text: `${arv}倍（普通）`,            color: 'text-yellow-600' }
    : arv < 3.5 ? { text: `${arv}倍（揺れやすい）`,      color: 'text-orange-600' }
    :             { text: `${arv}倍（大きく揺れやすい）`, color: 'text-red-600'    };

  const liq = !jname ? null
    : (jname.includes('埋立') || jname.includes('三角州') || jname.includes('海岸低地') || jname.includes('旧河道'))
      ? { level: '高', textCls: 'text-red-700',    bgCls: 'bg-red-50',    note: '液状化が起きると地面が砂状になり、建物の傾斜やインフラ損傷が起こりやすくなります。' }
    : (jname.includes('低地') || jname.includes('谷底') || jname.includes('自然堤防') || jname.includes('干拓'))
      ? { level: '中', textCls: 'text-orange-700', bgCls: 'bg-orange-50', note: '大規模地震の際には液状化が起きる可能性があります。' }
    : (jname.includes('台地') || jname.includes('段丘') || jname.includes('丘陵') || jname.includes('山地') || jname.includes('岩'))
      ? { level: '低', textCls: 'text-green-700',  bgCls: 'bg-green-50',  note: '液状化が起きにくい地形です。' }
    : null;

  const diag = score >= 9
    ? { bg: 'bg-green-50 border-green-100',   color: 'text-green-700',  title: '非常に硬い地盤', text: '岩盤・礫層など最良クラスの地盤です。地震の揺れも増幅しにくく、建物の沈下リスクも低い優良な立地です。' }
    : score >= 7
    ? { bg: 'bg-green-50 border-green-100',   color: 'text-green-700',  title: '良好な地盤',     text: '比較的硬い地盤で、地震の揺れの増幅は小さめです。住宅建築に適した地盤です。' }
    : score >= 5
    ? { bg: 'bg-yellow-50 border-yellow-100', color: 'text-yellow-700', title: '普通の地盤',     text: '平均的な硬さの地盤です。建物の基礎設計によって安全性が変わります。' }
    : score >= 3
    ? { bg: 'bg-orange-50 border-orange-100', color: 'text-orange-700', title: '軟弱な地盤',     text: '柔らかめの地盤で、地震時の揺れが増幅しやすい傾向があります。マンションは杭基礎なら建物自体の強度は確保できますが、液状化や周辺インフラへの影響に注意が必要です。' }
    : { bg: 'bg-red-50 border-red-200',       color: 'text-red-700',    title: '非常に軟弱な地盤', text: '非常に柔らかい地盤で、地震時の大きな揺れや液状化リスクに注意が必要です。購入前に地盤調査レポートの確認を強くおすすめします。' };

  return { arvLabel, liq, diag };
}

function GroundScoreCard({ groundData, groundLoading }) {
  const score = groundLoading ? 3 : (groundData?.score ?? 5);
  const avs   = groundData?.avs   ?? null;
  const arv   = groundData?.arv   ?? null;
  const jname = groundData?.jname ?? null;
  const { arvLabel, liq, diag } = getGroundInfo(score, avs, arv, jname);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🪨</span>
          <span className="text-sm font-semibold text-gray-700">地盤リスク</span>
        </div>
        <Stars score={score} />
      </div>

      {groundLoading ? (
        <p className="text-sm text-gray-700 font-medium">読み込み中…</p>
      ) : !avs ? (
        <p className="text-sm text-gray-700 font-medium">データなし</p>
      ) : (
        <>
          <div className="space-y-1 mb-2">
            {jname && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-700 font-medium w-20 shrink-0">地形</span>
                <span className="text-gray-700 font-medium">{jname}</span>
              </div>
            )}
            {arvLabel && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-700 font-medium w-20 shrink-0">揺れの大きさ</span>
                <span className={`font-medium ${arvLabel.color}`}>{arvLabel.text}</span>
              </div>
            )}
            {liq && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-700 font-medium w-20 shrink-0">液状化リスク</span>
                <span className={`font-semibold px-1.5 py-0.5 rounded ${liq.textCls} ${liq.bgCls}`}>{liq.level}</span>
              </div>
            )}
          </div>

          {diag && (
            <div className={`rounded-lg px-3 py-2 border text-xs ${diag.bg}`}>
              <p className={`font-semibold mb-0.5 ${diag.color}`}>{diag.title}</p>
              <p className="text-gray-600 leading-relaxed">{diag.text}</p>
              {liq && <p className="text-gray-700 font-medium mt-1 leading-relaxed">{liq.note}</p>}
            </div>
          )}
        </>
      )}

      <p className="text-xs text-gray-700 font-medium mt-2">出典: 防災科研J-SHIS（表層地盤データ）</p>
    </div>
  );
}

// 利便性サブカテゴリ スコア関数
function calcBusStopScore(n)        { if (!n) return 1; if (n >= 5) return 10; if (n >= 3) return 8; if (n >= 2) return 6; if (n >= 1) return 4; return 1; }
function calcSupermarketScore(n500, n1k) { if (n500 == null) return 5; if (n500 >= 3) return 10; if (n500 >= 2) return 9; if (n500 >= 1) return 7; if (n1k >= 3) return 5; if (n1k >= 1) return 3; return 1; }
function calcKonbiniScore(n500, n1k)    { if (n500 == null) return 5; if (n500 >= 3) return 10; if (n500 >= 2) return 8; if (n500 >= 1) return 6; if (n1k >= 2) return 4; if (n1k >= 1) return 3; return 1; }
function calcMedicalScore(n)        { if (n == null) return 5; if (n >= 5) return 10; if (n >= 3) return 8; if (n >= 2) return 6; if (n >= 1) return 4; return 2; }
function calcKindergartenScore(n)   { if (n == null) return 5; if (n >= 3) return 10; if (n >= 2) return 8; if (n >= 1) return 5; return 2; }
function calcSchoolScore(n)         { if (n == null) return 5; if (n >= 2) return 10; if (n >= 1) return 7; return 3; }

function ConvSubCard({ icon, label, score, layerId, loading, activeLayers, onToggleLayer, children, topAction, list, onHighlightItem }) {
  const [showList, setShowList] = useState(false);
  const [activeIdx, setActiveIdx] = useState(null);
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="text-sm font-semibold text-gray-700">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {list && list.length > 0 && (
            <button
              onClick={() => setShowList(v => !v)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-0.5 rounded bg-blue-50 border border-blue-100"
            >
              {showList ? '▲ 閉じる' : `一覧 ▼`}
            </button>
          )}
          <Stars score={loading ? 3 : score} />
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-gray-700 font-medium">読み込み中…</p>
      ) : children}
      {showList && list && list.length > 0 && (
        <ul className="mt-2 max-h-36 overflow-y-auto border-t border-gray-100 pt-1.5 space-y-0.5">
          {list.map((item, i) => {
            const clickable = !!(item.lat && item.lng && onHighlightItem);
            return (
              <li key={i}
                className={`text-xs flex justify-between items-center py-0.5 px-1 rounded transition-colors ${clickable ? 'cursor-pointer hover:bg-blue-50 active:bg-blue-100' : ''} ${activeIdx === i ? 'bg-blue-50' : ''}`}
                onClick={() => {
                  if (!clickable) return;
                  // レイヤーOFFなら自動でONにする
                  if (layerId && activeLayers && !activeLayers[layerId]) onToggleLayer?.(layerId);
                  if (activeIdx === i) {
                    setActiveIdx(null);
                    onHighlightItem(null, null, null); // 解除シグナル
                  } else {
                    setActiveIdx(i);
                    onHighlightItem(item.lat, item.lng, layerId);
                  }
                }}
              >
                <span className={`truncate ${activeIdx === i ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                  {clickable && <span className="mr-1 opacity-50">📍</span>}{item.name}
                </span>
                <span className="text-gray-400 shrink-0 ml-2 tabular-nums">{item.distanceM}m</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex flex-col gap-1.5">
        {topAction}
        {layerId && <button
          onClick={() => onToggleLayer(layerId)}
          className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeLayers[layerId]
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {icon} 地図に表示
        </button>}
      </div>
    </div>
  );
}

function getFloodDiagnosis(score, label) {
  if (score >= 10) return {
    bg: 'bg-green-50 border-green-100', color: 'text-green-700',
    title: '浸水想定区域外',
    text: '国交省のL2洪水シミュレーションでは浸水しない想定です。ただし側溝・排水路の溢水（内水氾濫）は別途ハザードマップで確認を。',
  };
  if (score >= 8) return {
    bg: 'bg-yellow-50 border-yellow-100', color: 'text-yellow-700',
    title: `床下浸水レベル（${label}）`,
    text: '住宅の基礎・床下に浸水するレベルです。止水板の設置や重要書類の高い場所への保管を検討してください。',
  };
  if (score >= 6) return {
    bg: 'bg-orange-50 border-orange-100', color: 'text-orange-700',
    title: `1階浸水レベル（${label}）`,
    text: '1階の家具・電化製品が水没するレベルです。避難のタイミングと経路を事前に確認しておくことが重要です。',
  };
  if (score >= 4) return {
    bg: 'bg-red-50 border-red-100', color: 'text-red-700',
    title: `2階浸水レベル（${label}）`,
    text: '2階まで浸水する可能性があります。高台・高層階への垂直避難か、早めの広域避難が必要なエリアです。',
  };
  if (score >= 3) return {
    bg: 'bg-red-50 border-red-200', color: 'text-red-800',
    title: `屋根上浸水レベル（${label}）`,
    text: '2階建て屋根を超える水位が想定されます。命に関わる危険レベルです。警戒レベル発令前に避難できる準備が必須です。',
  };
  return {
    bg: 'bg-red-100 border-red-300', color: 'text-red-900',
    title: `壊滅的浸水レベル（${label}）`,
    text: 'マンションの高層階でも影響を受ける可能性があります。この立地での購入には特に慎重な検討が必要です。',
  };
}

function getHightideDiagnosis(score, label) {
  if (score >= 10) return {
    bg: 'bg-green-50 border-green-100', color: 'text-green-700',
    title: '高潮浸水想定区域外',
    text: '台風や低気圧による高潮（海面の異常上昇）の浸水想定区域外です。ただし海岸・河口付近では念のため自治体のハザードマップも確認してください。',
  };
  if (score >= 8) return {
    bg: 'bg-yellow-50 border-yellow-100', color: 'text-yellow-700',
    title: `床下浸水レベル（${label}）`,
    text: '台風の接近・上陸時に床下浸水が想定されるエリアです。台風情報を早めに確認し、止水板の設置や家財の移動を検討してください。',
  };
  if (score >= 6) return {
    bg: 'bg-orange-50 border-orange-100', color: 'text-orange-700',
    title: `1階浸水レベル（${label}）`,
    text: '大型台風の高潮で1階が浸水するレベルです。台風が接近する前の早期避難が重要です。海・湾岸・河口からの距離も確認しましょう。',
  };
  if (score >= 4) return {
    bg: 'bg-red-50 border-red-100', color: 'text-red-700',
    title: `2階浸水レベル（${label}）`,
    text: '2階まで浸水するリスクがあります。高潮は台風の強度次第で急激に水位が上がります。警戒レベル発令前に広域避難できる準備をしてください。',
  };
  if (score >= 3) return {
    bg: 'bg-red-50 border-red-200', color: 'text-red-800',
    title: `屋根上浸水レベル（${label}）`,
    text: '2階建て屋根を超える水位が想定される危険なエリアです。台風シーズンには早めの避難計画が不可欠です。',
  };
  return {
    bg: 'bg-red-100 border-red-300', color: 'text-red-900',
    title: `壊滅的浸水レベル（${label}）`,
    text: '10m以上の浸水が想定される極めてリスクの高いエリアです。購入にあたっては高潮リスクを十分に考慮した慎重な判断が必要です。',
  };
}

function getTsunamiDiagnosis(score, label) {
  if (score >= 10) return {
    bg: 'bg-green-50 border-green-100', color: 'text-green-700',
    title: '津波浸水想定区域外',
    text: '最大クラスの津波シミュレーションでも浸水しない想定です。ただし内陸部でも大きな地震の際は自治体の避難情報に従って行動してください。',
  };
  if (score >= 8) return {
    bg: 'bg-yellow-50 border-yellow-100', color: 'text-yellow-700',
    title: `床下浸水レベル（${label}）`,
    text: '最大クラスの津波で床下浸水が想定されるエリアです。津波は地震発生から数分〜数十分で到達します。揺れを感じたら即時の高台避難を優先してください。',
  };
  if (score >= 6) return {
    bg: 'bg-orange-50 border-orange-100', color: 'text-orange-700',
    title: `1階浸水レベル（${label}）`,
    text: '1階が浸水するレベルの津波リスクがあります。「津波てんでんこ」の原則通り、揺れを感じたらすぐ高台へ逃げることが命を守る最優先行動です。',
  };
  if (score >= 4) return {
    bg: 'bg-red-50 border-red-100', color: 'text-red-700',
    title: `2階浸水レベル（${label}）`,
    text: '2階まで達する津波リスクがあります。津波は波ではなく「水の壁」で、流れも速く建物ごと流される危険があります。避難場所と経路を今すぐ確認してください。',
  };
  if (score >= 3) return {
    bg: 'bg-red-50 border-red-200', color: 'text-red-800',
    title: `屋根上浸水レベル（${label}）`,
    text: '2階建て屋根を超える津波が想定される極めて危険なエリアです。この立地での購入は津波避難ビルの位置と到達時間を事前に把握することが必須です。',
  };
  return {
    bg: 'bg-red-100 border-red-300', color: 'text-red-900',
    title: `壊滅的浸水レベル（${label}）`,
    text: '10m以上の津波浸水が想定されます。過去の大津波被害地域と重なる可能性があります。購入にあたっては特に慎重な検討が必要です。',
  };
}

function getLandslideDiagnosis(score, label) {
  if (score >= 10) return {
    bg: 'bg-green-50 border-green-100', color: 'text-green-700',
    title: '土砂災害警戒区域外',
    text: '土石流・地すべり・急傾斜地崩壊のいずれの警戒区域にも該当しません。ただし周辺の地形（山・崖・急斜面）も目視で確認することをおすすめします。',
  };
  if (score >= 4) return {
    bg: 'bg-orange-50 border-orange-100', color: 'text-orange-700',
    title: label,
    text: '大雨・台風時には土砂災害のリスクがあります。市区町村の避難情報（警戒レベル3以上）を事前に把握し、早めの行動を心がけてください。',
  };
  return {
    bg: 'bg-red-50 border-red-200', color: 'text-red-700',
    title: label,
    text: '土石流は発生から到達まで時間が非常に短く、「逃げ遅れ」が起きやすい災害です。警戒レベル3（高齢者等避難）が発令されたら即時避難を検討してください。',
  };
}

function FloodScoreCard({ hazardData, hazardLoading, activeLayers, onToggleLayer }) {
  const score = hazardLoading ? 3 : (hazardData?.floodScore ?? 10);
  const label = hazardData?.floodLabel ?? null;
  const valueText = label ? `浸水深 ${label}` : '浸水なし（区域外）';
  const diagnosis = !hazardLoading ? getFloodDiagnosis(score, label) : null;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌊</span>
          <span className="text-sm font-semibold text-gray-700">洪水浸水リスク</span>
        </div>
        <Stars score={score} />
      </div>
      {hazardLoading ? (
        <p className="text-sm text-gray-700 font-medium">読み込み中…</p>
      ) : (
        <>
          <p className="text-sm text-gray-600">{valueText}</p>
          {diagnosis && (
            <div className={`mt-2 rounded-lg px-3 py-2 border text-xs ${diagnosis.bg}`}>
              <p className={`font-semibold mb-0.5 ${diagnosis.color}`}>{diagnosis.title}</p>
              <p className="text-gray-600 leading-relaxed">{diagnosis.text}</p>
            </div>
          )}
        </>
      )}
      <p className="text-xs text-gray-700 font-medium mt-2">スコア高=リスク低（10点満点）。国交省 L2洪水浸水想定区域データ使用</p>
      <button
        onClick={() => onToggleLayer('flood')}
        className={`mt-2 w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${
          activeLayers.flood
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        🌊 地図に洪水浸水エリアを表示
      </button>
    </div>
  );
}

function LandslideScoreCard({ hazardData, hazardLoading, activeLayers, onToggleLayer }) {
  const score = hazardLoading ? 3 : (hazardData?.landslideScore ?? 10);
  const label = hazardData?.landslideLabel ?? null;
  const valueText = label ?? '警戒区域外';
  const diagnosis = !hazardLoading ? getLandslideDiagnosis(score, label) : null;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🪨</span>
          <span className="text-sm font-semibold text-gray-700">土砂災害リスク</span>
        </div>
        <Stars score={score} />
      </div>
      {hazardLoading ? (
        <p className="text-sm text-gray-700 font-medium">読み込み中…</p>
      ) : (
        <>
          <p className="text-sm text-gray-600">{valueText}</p>
          {diagnosis && (
            <div className={`mt-2 rounded-lg px-3 py-2 border text-xs ${diagnosis.bg}`}>
              <p className={`font-semibold mb-0.5 ${diagnosis.color}`}>{diagnosis.title}</p>
              <p className="text-gray-600 leading-relaxed">{diagnosis.text}</p>
            </div>
          )}
        </>
      )}
      <p className="text-xs text-gray-700 font-medium mt-2">スコア高=リスク低（10点満点）。国交省 土砂災害警戒区域データ使用</p>
      <button
        onClick={() => onToggleLayer('landslide')}
        className={`mt-2 w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${
          activeLayers.landslide
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        🪨 地図に土砂災害警戒区域を表示
      </button>
    </div>
  );
}

function HightideScoreCard({ hazardData, hazardLoading, activeLayers, onToggleLayer, location }) {
  const score = hazardLoading ? 3 : (hazardData?.hightideScore ?? 10);
  const label = hazardData?.hightideLabel ?? null;
  const valueText = label ? `浸水深 ${label}` : '浸水なし（区域外）';
  const diagnosis = !hazardLoading ? getHightideDiagnosis(score, label) : null;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌀</span>
          <span className="text-sm font-semibold text-gray-700">高潮浸水リスク</span>
        </div>
        <Stars score={score} />
      </div>
      {hazardLoading ? (
        <p className="text-sm text-gray-700 font-medium">読み込み中…</p>
      ) : (
        <>
          <p className="text-sm text-gray-600">{valueText}</p>
          {diagnosis && (
            <div className={`mt-2 rounded-lg px-3 py-2 border text-xs ${diagnosis.bg}`}>
              <p className={`font-semibold mb-0.5 ${diagnosis.color}`}>{diagnosis.title}</p>
              <p className="text-gray-600 leading-relaxed">{diagnosis.text}</p>
            </div>
          )}
        </>
      )}
      <p className="text-xs text-gray-700 font-medium mt-2">スコア高=リスク低（10点満点）。国交省 高潮浸水想定区域データ使用</p>
      {location && (
        <a
          href={`https://disaportal.gsi.go.jp/maps/?ll=${location.lat},${location.lng}&z=15&base=pale`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 w-full py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
        >
          🌀 重ねるハザードマップで確認
        </a>
      )}
    </div>
  );
}

function TsunamiScoreCard({ hazardData, hazardLoading, activeLayers, onToggleLayer }) {
  const score = hazardLoading ? 3 : (hazardData?.tsunamiScore ?? 10);
  const label = hazardData?.tsunamiLabel ?? null;
  const valueText = label ? `浸水深 ${label}` : '浸水なし（区域外）';
  const diagnosis = !hazardLoading ? getTsunamiDiagnosis(score, label) : null;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌊</span>
          <span className="text-sm font-semibold text-gray-700">津波浸水リスク</span>
        </div>
        <Stars score={score} />
      </div>
      {hazardLoading ? (
        <p className="text-sm text-gray-700 font-medium">読み込み中…</p>
      ) : (
        <>
          <p className="text-sm text-gray-600">{valueText}</p>
          {diagnosis && (
            <div className={`mt-2 rounded-lg px-3 py-2 border text-xs ${diagnosis.bg}`}>
              <p className={`font-semibold mb-0.5 ${diagnosis.color}`}>{diagnosis.title}</p>
              <p className="text-gray-600 leading-relaxed">{diagnosis.text}</p>
            </div>
          )}
        </>
      )}
      <p className="text-xs text-gray-700 font-medium mt-2">スコア高=リスク低（10点満点）。国交省 津波浸水想定区域データ使用</p>
      <button
        onClick={() => onToggleLayer('tsunami')}
        className={`mt-2 w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${
          activeLayers.tsunami
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        🌊 地図に津波浸水エリアを表示
      </button>
    </div>
  );
}

function ZoningCard({ zoningData, zoningLoading }) {
  const RISK = {
    high: {
      bg: 'bg-red-50 border-red-100', color: 'text-red-700',
      title: '要注意（風俗店・パチンコの出店が法的に許可されるエリア）',
      text: '商業地域・準工業地域・工業地域は、風俗営業（性風俗・パチンコ等）の出店が風営法上許可されています。現地確認またはGoogleマップで周辺環境を事前に調べることをおすすめします。',
    },
    mid: {
      bg: 'bg-amber-50 border-amber-100', color: 'text-amber-700',
      title: 'やや注意（一部の娯楽・飲食施設の出店可）',
      text: '近隣商業地域はパチンコ等の出店が許可されています。夜間の騒音や人通りの変化を現地で確認することをおすすめします。',
    },
    low: {
      bg: 'bg-green-50 border-green-100', color: 'text-green-700',
      title: '住宅系地域（風俗営業の出店は原則禁止）',
      text: '住居専用・住居地域では風俗営業の出店が法令上制限されており、比較的静かな居住環境が期待できます。',
    },
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏘️</span>
          <span className="text-sm font-semibold text-gray-700">用途地域</span>
        </div>
        {!zoningLoading && <Stars score={calcZoningScore(zoningData)} />}
      </div>
      {zoningLoading ? (
        <p className="text-sm text-gray-700 font-medium">読み込み中…</p>
      ) : !zoningData?.useDistrict ? (
        <p className="text-sm text-gray-700 font-medium">データなし</p>
      ) : (() => {
        const cfg = RISK[zoningData.risk] || RISK.low;
        return (
          <>
            <p className="text-sm font-semibold text-gray-800 mb-2">{zoningData.useDistrict}</p>
            <div className={`rounded-lg px-3 py-2 border text-xs ${cfg.bg}`}>
              <p className={`font-semibold mb-0.5 ${cfg.color}`}>{cfg.title}</p>
              <p className="text-gray-600 leading-relaxed">{cfg.text}</p>
            </div>
          </>
        );
      })()}
      <p className="text-xs text-gray-700 font-medium mt-2">出典: 国交省REINFOLIB 成約データから推定（エリア近傍の最頻値）</p>
    </div>
  );
}

function NuisanceCard({ nuisanceData, nuisanceLoading }) {
  const facilities = nuisanceData?.facilities || [];
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏭</span>
          <span className="text-sm font-semibold text-gray-700">施設リスク</span>
        </div>
        {!nuisanceLoading && <Stars score={calcNuisanceScore(nuisanceData)} />}
      </div>
      {nuisanceLoading ? (
        <p className="text-sm text-gray-700 font-medium">読み込み中…</p>
      ) : facilities.length === 0 ? (
        <>
          <p className="text-sm text-gray-600">500m圏内に検出なし</p>
          <div className="mt-2 rounded-lg px-3 py-2 border text-xs bg-green-50 border-green-100">
            <p className="font-semibold text-green-700">工場・火葬場・廃棄物処理場・大型墓地なし</p>
            <p className="text-gray-600 leading-relaxed mt-0.5">OpenStreetMapのデータに基づきます。登録漏れがある場合があるため、現地でも確認をおすすめします。</p>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 mb-2">
            {facilities.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-red-50 rounded-lg px-3 py-2">
                <span>{f.icon}</span>
                <span className="font-medium text-red-700 flex-1">{f.label}</span>
                <span className="text-gray-700 font-medium shrink-0">{f.distanceM}m先</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg px-3 py-2 border text-xs bg-amber-50 border-amber-100">
            <p className="font-semibold text-amber-700">周辺に施設リスクあり</p>
            <p className="text-gray-600 leading-relaxed mt-0.5">現地で確認し、物件価格の妥当性も併せて検討してください。</p>
          </div>
        </>
      )}
      <p className="text-xs text-gray-700 font-medium mt-2">出典: OpenStreetMap（登録漏れあり・参考値）</p>
    </div>
  );
}

function calcNoiseScore(noiseData) {
  if (!noiseData) return null;
  const { railM, roadM } = noiseData;
  const railScore = railM == null ? 10
    : railM < 50 ? 1 : railM < 100 ? 3 : railM < 200 ? 5 : railM < 400 ? 7 : 10;
  const roadScore = roadM == null ? 10
    : roadM < 30 ? 1 : roadM < 50 ? 3 : roadM < 100 ? 5 : roadM < 200 ? 7 : 10;
  return Math.min(railScore, roadScore);
}

function getNoiseDiagnosis(noiseData) {
  if (!noiseData) return null;
  const { railM, roadM, railName, roadClass } = noiseData;
  const ROAD_LABEL = { motorway: '高速道路', trunk: '幹線道路', primary: '主要道路', secondary: '主要道路' };
  const roadLabel = ROAD_LABEL[roadClass] ?? '幹線道路';
  const railLabel = railName ?? '線路';

  // 線路と道路の両方が至近
  if (railM != null && railM < 100 && roadM != null && roadM < 50) {
    return { bg: 'bg-red-50 border-red-100', color: 'text-red-700',
      title: '騒音リスク：非常に高い',
      text: `${railLabel}（${railM}m）と${roadLabel}（${roadM}m）が至近に重なっています。電車の走行音・踏切・交通騒音が複合的に発生しやすい環境です。内見時は必ず夜間・朝のラッシュ時間帯も確認することをおすすめします。` };
  }
  // 線路が至近（100m未満）
  if (railM != null && railM < 100) {
    return { bg: 'bg-red-50 border-red-100', color: 'text-red-700',
      title: '線路が至近：騒音リスク高',
      text: `${railLabel}まで約${railM}mです。電車の走行音・踏切の警報音が日常的に聞こえる可能性があります。防音サッシの有無や運行本数・終電時刻を事前に確認しましょう。` };
  }
  // 幹線道路が至近（50m未満）
  if (roadM != null && roadM < 50) {
    return { bg: 'bg-red-50 border-red-100', color: 'text-red-700',
      title: `${roadLabel}が至近：騒音リスク高`,
      text: `${roadLabel}まで約${roadM}mです。大型車・バイクの通行音が昼夜問わず発生しやすい環境です。幹線道路沿いは振動も伴うことがあるため、内見時に窓を閉めた状態と開けた状態の両方を確認してください。` };
  }
  // 線路が中距離（100〜200m）
  if (railM != null && railM < 200) {
    return { bg: 'bg-orange-50 border-orange-100', color: 'text-orange-700',
      title: '線路がやや近い：注意',
      text: `${railLabel}まで約${railM}mです。窓を開けていると走行音が聞こえる場合があります。上層階ほど音が届きやすいため、希望階での内見を推奨します。` };
  }
  // 道路が近い（50〜100m）
  if (roadM != null && roadM < 100) {
    return { bg: 'bg-orange-50 border-orange-100', color: 'text-orange-700',
      title: `${roadLabel}がやや近い：注意`,
      text: `${roadLabel}まで約${roadM}mです。交通量の多い時間帯は騒音が気になる可能性があります。朝・夕の通勤時間帯に現地確認することをおすすめします。` };
  }
  // 線路が400m未満
  if (railM != null && railM < 400) {
    return { bg: 'bg-yellow-50 border-yellow-100', color: 'text-yellow-700',
      title: '騒音リスク：比較的低い',
      text: `最寄り線路まで約${railM}mあり、日常生活での騒音への影響は限定的です。ただし地形・建物配置によって音の届き方が変わるため、現地確認を忘れずに。` };
  }
  // 道路が200m未満
  if (roadM != null && roadM < 200) {
    return { bg: 'bg-yellow-50 border-yellow-100', color: 'text-yellow-700',
      title: '騒音リスク：比較的低い',
      text: `${roadLabel}まで約${roadM}mあります。通常の生活では大きな問題になりにくい距離ですが、風向きや季節によって音の感じ方が変わることがあります。` };
  }
  // 両方とも遠い
  return { bg: 'bg-green-50 border-green-100', color: 'text-green-700',
    title: '騒音リスク：低い',
    text: '主要な騒音源（線路・幹線道路）から十分な距離があります。静かな住環境が期待できます。' };
}

function NoiseScoreCard({ noiseData, activeLayers, onToggleLayer }) {
  const score = calcNoiseScore(noiseData);
  const diagnosis = noiseData ? getNoiseDiagnosis(noiseData) : null;
  const ROAD_LABEL = { motorway: '高速道路', trunk: '幹線道路', primary: '主要道路', secondary: '主要道路' };
  const riskTag = (m, thresholds) => {
    if (m == null) return null;
    if (m < thresholds[0]) return { label: '高', cls: 'text-red-600 bg-red-50 border-red-200' };
    if (m < thresholds[1]) return { label: '中', cls: 'text-orange-500 bg-orange-50 border-orange-200' };
    if (m < thresholds[2]) return { label: '低', cls: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
    return { label: '問題なし', cls: 'text-green-600 bg-green-50 border-green-200' };
  };
  const railRisk = riskTag(noiseData?.railM, [100, 200, 400]);
  const roadRisk = riskTag(noiseData?.roadM, [50, 100, 200]);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔊</span>
          <span className="text-sm font-semibold text-gray-700">騒音リスク</span>
        </div>
        {score != null && <Stars score={score} />}
      </div>
      {noiseData == null ? (
        <p className="text-sm text-gray-700 font-medium">解析中…</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-700 font-medium">🚃 最寄り線路{noiseData.railName ? `（${noiseData.railName}）` : ''}</span>
              {noiseData.railM != null ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">{noiseData.railM < 1000 ? `${noiseData.railM}m` : `${(noiseData.railM/1000).toFixed(1)}km`}</span>
                  <span className={`px-1.5 py-0.5 rounded border font-bold text-[10px] ${railRisk.cls}`}>{railRisk.label}</span>
                </div>
              ) : <span className="text-gray-400">範囲外</span>}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700 font-medium">🚗 最寄り{ROAD_LABEL[noiseData.roadClass] ?? '幹線道路'}</span>
              {noiseData.roadM != null ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">{noiseData.roadM < 1000 ? `${noiseData.roadM}m` : `${(noiseData.roadM/1000).toFixed(1)}km`}</span>
                  <span className={`px-1.5 py-0.5 rounded border font-bold text-[10px] ${roadRisk.cls}`}>{roadRisk.label}</span>
                </div>
              ) : <span className="text-gray-400">範囲外</span>}
            </div>
          </div>
          {diagnosis && (
            <div className={`mt-2 rounded-lg px-3 py-2 border text-xs ${diagnosis.bg}`}>
              <p className={`font-semibold mb-0.5 ${diagnosis.color}`}>{diagnosis.title}</p>
              <p className="text-gray-600 leading-relaxed">{diagnosis.text}</p>
            </div>
          )}
          <p className="text-xs text-gray-700 font-medium mt-2">スコア高=リスク低（10点満点）。地図タイルデータから算出</p>
        </>
      )}
      <button
        onClick={() => onToggleLayer('noise')}
        className={`mt-3 w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${
          activeLayers.noise ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        🔊 地図に騒音源をハイライト表示
      </button>
    </div>
  );
}

// 施設リスクスコア 1-10（距離と件数で判定）
function calcNuisanceScore(nuisanceData) {
  const facilities = nuisanceData?.facilities || [];
  if (facilities.length === 0) return 10;
  const closest = facilities[0]; // 距離昇順ソート済み
  if (closest.distanceM < 200) return 2;
  if (closest.distanceM < 350) return 4;
  return 6;
}

// 用途地域スコア 1-10
function calcZoningScore(zoningData) {
  if (!zoningData?.useDistrict) return 5;
  if (zoningData.risk === 'low')  return 9;
  if (zoningData.risk === 'mid')  return 5;
  if (zoningData.risk === 'high') return 2;
  return 5;
}

// 将来性スコア: 用途地域ベース + 高度利用地区/立地適正化計画 + 乗降客数トレンド
function calcFutureScore(zoningData, urbanData, passengerData) {
  const d = zoningData?.useDistrict;
  let base;
  if (!d)                           base = 5;
  else if (d.includes('商業'))      base = 9;
  else if (d.includes('近隣商業'))  base = 8;
  else if (d.includes('準住居') || d.includes('第二種住居')) base = 7;
  else if (d.includes('第一種住居') || d.includes('第二種中高層')) base = 6;
  else if (d.includes('第一種中高層') || d.includes('第二種低層') || d.includes('田園住居')) base = 5;
  else if (d.includes('第一種低層')) base = 4;
  else if (d.includes('準工業'))    base = 6;
  else if (d.includes('工業専用')) base = 2;
  else if (d.includes('工業'))      base = 3;
  else base = 5;

  const urbanBonus = (urbanData?.isKoudo ? 1 : 0) + (urbanData?.isToshi ? 1 : 0);

  // 最寄り駅の乗降客数トレンド（2019→2023）補正
  const trend = passengerData?.stations?.[0]?.trend ?? null;
  const passengerBonus = trend == null ? 0 : trend >= 5 ? 1 : trend <= -10 ? -1 : 0;

  return Math.min(10, Math.max(1, base + urbanBonus + passengerBonus));
}

// 乗降客数折れ線グラフ（LandPriceChartと同サイズ）
function PassengerLineChart({ yearly }) {
  const [containerRef, W] = useContainerWidth();
  const years = [2019, 2020, 2021, 2022, 2023];
  const H = 72;
  const PAD = { top: 16, bottom: 18, left: 8, right: 8 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const vals = years.map(y => yearly[y] ?? null);
  const validVals = vals.filter(v => v != null);
  if (!validVals.length) return null;
  const maxV = Math.max(...validVals);
  const minV = Math.min(...validVals);
  const range = maxV - minV || maxV;

  const pts = years.map((yr, i) => {
    const v = yearly[yr];
    if (v == null) return null;
    return {
      x: PAD.left + (i / 4) * chartW,
      y: PAD.top + chartH - ((v - minV) / range) * chartH,
      yr, v,
    };
  });
  const validPts = pts.filter(Boolean);
  const pathD = validPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const isUp = validPts.length >= 2 && validPts[validPts.length - 1].v >= validPts[0].v;
  const lineColor = isUp ? '#3b82f6' : '#ef4444';

  return (
    <div ref={containerRef}>
      {W > 0 && (
        <svg width={W} height={H}>
          <line x1={PAD.left} y1={PAD.top + chartH / 2} x2={W - PAD.right} y2={PAD.top + chartH / 2} stroke="#f3f4f6" strokeWidth="1" />
          {validPts.length >= 2 && (
            <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {pts.map((p, i) => (
            <g key={years[i]}>
              {p && <circle cx={p.x} cy={p.y} r="3.5" fill={lineColor} />}
              {p && (i === 0 || i === 4) && (() => {
                const ly = Math.max(12, p.y - 10);
                const anchor = i === 0 ? 'start' : 'end';
                const label = `${(p.v / 10000).toFixed(1)}万`;
                return (
                  <>
                    <text x={p.x} y={ly} textAnchor={anchor} fontSize="11" fontWeight="700"
                      stroke="white" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke">{label}</text>
                    <text x={p.x} y={ly} textAnchor={anchor} fontSize="11" fontWeight="700" fill={lineColor}>{label}</text>
                  </>
                );
              })()}
              <text x={PAD.left + (i / 4) * chartW} y={H - 2} textAnchor="middle" fontSize="11" fill="#9ca3af">
                {String(years[i]).slice(2)}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

// HeartRails駅名+路線名 × REINFOLIB乗降客数リスト をfuzzyマッチ
// HeartRails の路線名プレフィックス → REINFOLIB の事業者名キーワード
const HR_OP_MAP = [
  [/^JR/, '旅客鉄道'],
  [/^東急/, '東急'],
  [/^阪急/, '阪急'],
  [/^阪神/, '阪神'],
  [/^近鉄/, '近畿日本'],
  [/^南海/, '南海'],
  [/^名鉄/, '名古屋鉄道'],
  [/^西鉄/, '西日本鉄道'],
  [/^東武/, '東武'],
  [/^西武/, '西武'],
  [/^京急/, '京急'],
  [/^小田急/, '小田急'],
  [/^京王/, '京王'],
  [/^京成/, '京成'],
  [/^相鉄/, '相模鉄道'],
  [/^東京メトロ/, '東京地下鉄'],
  [/^都営/, '東京都交通局'],
];

function matchPassenger(stationName, hrLine, psList) {
  const sameStation = psList.filter(ps => ps.name === stationName);
  if (!sameStation.length) return null;
  if (sameStation.length === 1) return sameStation[0];

  // 1st pass: 路線名の部分一致（例: 阪急今津線→今津線、阪急神戸本線→神戸線）
  const stripped = (hrLine ?? '')
    .replace(/^(東急|東京メトロ|東京都交通局|都営|JR|京急|小田急|東武|西武|京王|相鉄|京成|阪急|阪神|近鉄|南海|名鉄|西鉄)/, '')
    .trim();
  for (const ps of sameStation) {
    const psLine = ps.line ?? '';
    if (stripped && (psLine.includes(stripped) || stripped.includes(psLine))) return ps;
  }

  // 2nd pass: 事業者名マッチ（例: JR神戸線→東海道線は路線名が異なるが「旅客鉄道」で一致）
  for (const [re, opKeyword] of HR_OP_MAP) {
    if (re.test(hrLine ?? '')) {
      const opMatch = sameStation.find(ps => (ps.operator ?? '').includes(opKeyword));
      if (opMatch) return opMatch;
    }
  }

  return null;
}

function StationPassengerCard({ passengerData, passengerLoading, convStations = [] }) {
  const psList = passengerData?.stations ?? [];
  const stations = convStations.slice(0, 4).map(s => {
    const ps = matchPassenger(s.name, s.operator, psList);
    return { name: s.name, operator: s.operator, walkMin: s.walkMin, yearly: ps?.yearly ?? {}, trend: ps?.trend ?? null };
  });

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📈</span>
        <span className="text-sm font-semibold text-gray-700">駅乗降客数トレンド（2019→2023）</span>
      </div>

      {passengerLoading ? (
        <p className="text-sm text-gray-700 font-medium">読み込み中…</p>
      ) : stations.length === 0 ? (
        <p className="text-sm text-gray-700 font-medium">データなし</p>
      ) : (
        <div className="space-y-3">
          {stations.map((s, i) => {
            const trend = s.trend;
            const trendCls = trend == null ? 'text-gray-400'
              : trend >= 5  ? 'text-green-600'
              : trend <= -10 ? 'text-red-600'
              : 'text-blue-600';
            const trendIcon = trend == null ? '' : trend >= 5 ? '↑' : trend <= -10 ? '↓' : '→';
            const latest = s.yearly[2023] ?? s.yearly[2022] ?? null;
            const hasYearly = Object.keys(s.yearly).length > 0;

            return (
              <div key={i} className={i > 0 ? 'pt-3 border-t border-gray-100' : ''}>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-sm font-semibold text-gray-800">{s.name}</span>
                    {s.operator && <span className="text-xs text-gray-400 ml-1">（{s.operator}）</span>}
                  </div>
                  <span className="text-xs text-gray-400">徒歩{s.walkMin}分</span>
                </div>
                {hasYearly ? (
                  <>
                    <div className="flex items-center gap-3 mb-0.5">
                      {latest != null && (
                        <span className="text-sm font-bold text-gray-700">
                          {(latest / 10000).toFixed(1)}万人
                          <span className="text-xs font-normal text-gray-400 ml-0.5">（2023年）</span>
                        </span>
                      )}
                      {trend != null && (
                        <span className={`text-xs font-semibold ${trendCls}`}>
                          {trendIcon} 2019比{trend > 0 ? '+' : ''}{trend}%
                        </span>
                      )}
                    </div>
                    <PassengerLineChart yearly={s.yearly} />
                  </>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">データ非公開（事業者未提供）</p>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-gray-700 font-medium mt-2">出典: 国土交通省 国土数値情報（REINFOLIB）</p>
    </div>
  );
}

function FutureScoreCard({ zoningData, urbanData, passengerData, zoningLoading, urbanLoading }) {
  const loading = zoningLoading || urbanLoading;
  const score = calcFutureScore(zoningData, urbanData, passengerData);
  const d = zoningData?.useDistrict;

  const comment = !d ? null
    : score >= 9 ? { bg: 'bg-green-50 border-green-100', color: 'text-green-700', title: '再開発ポテンシャル：高',   text: '高い容積率・用途の自由度があり、大規模再開発が起きやすいエリアです。地価上昇の恩恵を受けやすい立地です。' }
    : score >= 7 ? { bg: 'bg-blue-50 border-blue-100',   color: 'text-blue-700',   title: '再開発ポテンシャル：中〜高', text: '商業・住居混在エリアで、周辺開発による地価上昇が期待できる立地です。' }
    : score >= 5 ? { bg: 'bg-yellow-50 border-yellow-100', color: 'text-yellow-700', title: '再開発ポテンシャル：標準', text: '標準的な住宅地です。周辺開発の動向を継続して確認することをおすすめします。' }
    : { bg: 'bg-gray-50 border-gray-100', color: 'text-gray-700', title: '再開発ポテンシャル：低', text: '建築規制が厳しいエリアです。住環境の安定性は高い一方、地価の急上昇は起きにくい傾向があります。' };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏗️</span>
          <span className="text-sm font-semibold text-gray-700">将来性</span>
        </div>
        {!loading && <Stars score={score} />}
      </div>

      {loading ? (
        <p className="text-sm text-gray-700 font-medium">読み込み中…</p>
      ) : !d ? (
        <p className="text-sm text-gray-700 font-medium">データなし</p>
      ) : (
        <>
          <div className="space-y-1 mb-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-700 font-medium w-20 shrink-0">用途地域</span>
              <span className="text-gray-700 font-medium">{d}</span>
            </div>
            {urbanData?.isKoudo && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-700 font-medium w-20 shrink-0">都市計画指定</span>
                <span className="text-green-700 font-medium bg-green-50 px-1.5 py-0.5 rounded">🏗️ 高度利用地区</span>
              </div>
            )}
            {urbanData?.isToshi && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-700 font-medium w-20 shrink-0">立地適正化</span>
                <span className="text-blue-700 font-medium bg-blue-50 px-1.5 py-0.5 rounded">📍 都市機能誘導区域</span>
              </div>
            )}
          </div>
          {comment && (
            <div className={`rounded-lg px-3 py-2 border text-xs ${comment.bg}`}>
              <p className={`font-semibold mb-0.5 ${comment.color}`}>{comment.title}</p>
              <p className="text-gray-600 leading-relaxed">{comment.text}</p>
            </div>
          )}
        </>
      )}
      <p className="text-xs text-gray-700 font-medium mt-2">出典: 国土交通省 都市計画決定GIS（REINFOLIB）</p>
    </div>
  );
}

// ハザードスコア（API が 1-10 を返す）
function calcHazardScore(hazardData) {
  return hazardData?.score ?? 5;
}

// 利便性スコア（API が 1-10 を返す）
function calcConvScore(convData) {
  return convData?.score ?? 5;
}

// 駅スコア（最寄り駅距離 → 1-10）
function calcStationScore(convData) {
  const m = convData?.nearestStationM;
  if (!m) return null;
  if (m <= 160)  return 10;
  if (m <= 320)  return 9;
  if (m <= 480)  return 8;
  if (m <= 640)  return 7;
  if (m <= 800)  return 6;
  if (m <= 960)  return 5;
  if (m <= 1200) return 4;
  if (m <= 1500) return 3;
  if (m <= 2000) return 2;
  return 1;
}

// バス停スコア（500m圏内件数 → 1-10）
function calcBusScore(convData) {
  const n = convData?.busStops;
  if (n == null) return null;
  if (n === 0) return 2;
  if (n <= 2)  return 5;
  if (n <= 5)  return 7;
  if (n <= 9)  return 9;
  return 10;
}

// 価格スコア（手頃さ）: 安いほど高スコア 1-10
function calcPriceScore(txData) {
  const u = txData?.condos?.avgUnitPrice;
  if (!u) return 5;
  if (u < 20)  return 10;
  if (u < 30)  return 9;
  if (u < 40)  return 8;
  if (u < 60)  return 7;
  if (u < 80)  return 6;
  if (u < 100) return 5;
  if (u < 130) return 4;
  if (u < 160) return 3;
  if (u < 200) return 2;
  return 1;
}

// 地価トレンドスコア 1-10（5年変動率）
function calcLandPriceScore(trend) {
  if (trend === null || trend === undefined) return 5;
  if (trend >= 10) return 10;
  if (trend >=  7) return 9;
  if (trend >=  5) return 8;
  if (trend >=  3) return 7;
  if (trend >=  1) return 6;
  if (trend >= -1) return 5;
  if (trend >= -3) return 4;
  if (trend >= -5) return 3;
  if (trend >= -10) return 2;
  return 1;
}

// 成約価格トレンドスコア 1-10
function calcTrendScore(trendData, propertyType) {
  if (!trendData) return 5;
  const years = Object.keys(trendData).map(Number).sort();
  const pts = (propertyType === 'house'
    ? years.map(y => ({ year: y, value: trendData[y]?.houseAvgPrice }))
    : years.map(y => ({ year: y, value: trendData[y]?.condoAvgUnitPrice }))
  ).filter(p => p.value != null);
  if (pts.length < 2) return 5;
  const overallPct = Math.round(((pts[pts.length - 1].value - pts[0].value) / pts[0].value) * 100);
  const peakValue = Math.max(...pts.map(p => p.value));
  const peakIdx   = pts.findIndex(p => p.value === peakValue);
  const fromPeakPct = Math.round(((pts[pts.length - 1].value - peakValue) / peakValue) * 100);
  const hasPeakedAndDeclined = pts.length >= 3 && peakIdx > 0 && peakIdx < pts.length - 1 && fromPeakPct <= -3;
  return hasPeakedAndDeclined
    ? (overallPct >= 10 ? 5 : overallPct >= 5 ? 4 : overallPct >= 0 ? 3 : 2)
    : overallPct >= 15 ? 10
    : overallPct >= 10 ? 9
    : overallPct >=  5 ? 8
    : overallPct >=  2 ? 7
    : overallPct >= -2 ? 6
    : overallPct >= -5 ? 4
    : overallPct >= -10 ? 3
    : 2;
}

// 人口スコア 1-10
function calcPopScore(popData) {
  if (!popData?.data || popData.data.length < 2) return 5;
  const pct = (popData.data[popData.data.length - 1].population - popData.data[0].population) / popData.data[0].population * 100;
  if (pct > 15)  return 10;
  if (pct > 10)  return 9;
  if (pct > 5)   return 8;
  if (pct > 3)   return 7;
  if (pct > 0)   return 6;
  if (pct > -3)  return 5;
  if (pct > -5)  return 4;
  if (pct > -10) return 3;
  if (pct > -15) return 2;
  return 1;
}

// "2024年第4四半期" → "'24Q4"
function formatPeriod(p) {
  const m = p?.match(/(\d{4})年第(\d)四半期/);
  return m ? `'${m[1].slice(2)}Q${m[2]}` : p || '';
}

function TransactionDrawer({ tx, onClose }) {
  const isOpen = !!tx;

  // スクロールロック
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <>
      {/* バックドロップ */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* ドロワー本体（左からスライドイン） */}
      <div
        className={`fixed left-0 top-0 bottom-0 w-80 bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <h2 className="font-bold text-gray-900 text-sm">成約事例 詳細</h2>
          <button onClick={onClose} className="text-gray-700 font-medium hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {tx && (
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            {/* 価格ハイライト */}
            <div className={`rounded-xl p-4 ${tx.type === 'house' ? 'bg-green-50' : 'bg-blue-50'}`}>
              <p className="text-xs text-gray-700 font-medium mb-0.5">
                {tx.type === 'house' ? '🏡 戸建て' : '🏢 マンション'} · {tx.district} · {formatPeriod(tx.period)}
              </p>
              <p className={`text-2xl font-bold ${tx.type === 'house' ? 'text-green-700' : 'text-blue-700'}`}>
                {tx.price.toLocaleString()}万円
              </p>
              {tx.type === 'condo' && (
                <div className="flex gap-3 mt-1 text-sm text-gray-600">
                  <span>{tx.area}㎡</span>
                  <span className="text-blue-600 font-semibold">{tx.unitPrice}万円/㎡</span>
                </div>
              )}
              {tx.type === 'house' && (
                <div className="flex gap-3 mt-1 text-sm text-gray-600">
                  {tx.landArea && <span>土地 {tx.landArea}㎡</span>}
                  {tx.totalFloorArea && <span>延床 {tx.totalFloorArea}㎡</span>}
                </div>
              )}
            </div>

            {/* 基本情報 */}
            <section>
              <p className="text-xs font-bold text-gray-700 font-medium mb-2">基本情報</p>
              <div className="flex flex-col gap-1.5">
                <DrawerRow label="間取り" value={tx.floorPlan} />
                <DrawerRow label="築年" value={tx.buildingYear ? `${tx.buildingYear}年` : ''} />
                <DrawerRow label="構造" value={tx.structure} />
                {tx.type === 'house' && <DrawerRow label="土地面積" value={tx.landArea ? `${tx.landArea}㎡` : ''} />}
                {tx.type === 'house' && <DrawerRow label="延床面積" value={tx.totalFloorArea ? `${tx.totalFloorArea}㎡` : ''} />}
                <DrawerRow label="改装" value={tx.renovation} />
              </div>
            </section>

            {/* 立地 */}
            {(tx.nearestStation || tx.timeToStation) && (
              <section>
                <p className="text-xs font-bold text-gray-700 font-medium mb-2">立地</p>
                <div className="flex flex-col gap-1.5">
                  <DrawerRow label="最寄り駅" value={tx.nearestStation} />
                  <DrawerRow label="駅徒歩" value={tx.timeToStation ? `${tx.timeToStation}分` : ''} />
                </div>
              </section>
            )}

            {/* 法令・規制 */}
            {(tx.cityPlanning || tx.coverageRatio || tx.floorAreaRatio) && (
              <section>
                <p className="text-xs font-bold text-gray-700 font-medium mb-2">法令・規制</p>
                <div className="flex flex-col gap-1.5">
                  <DrawerRow label="都市計画" value={tx.cityPlanning} />
                  <DrawerRow label="建ぺい率" value={tx.coverageRatio ? `${tx.coverageRatio}%` : ''} />
                  <DrawerRow label="容積率" value={tx.floorAreaRatio ? `${tx.floorAreaRatio}%` : ''} />
                </div>
              </section>
            )}

            {/* 取引事情 */}
            {tx.remarks && (
              <section>
                <p className="text-xs font-bold text-gray-700 font-medium mb-2">取引の事情等</p>
                <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed">{tx.remarks}</p>
              </section>
            )}

            <p className="text-xs text-gray-700 font-medium text-center pb-2">出典: 国土交通省 不動産情報ライブラリ（REINFOLIB）</p>
          </div>
        )}
      </div>
    </>
  );
}


const ERA_TABS = [
  { key: 'era2011', label: '2011年以降' },
  { key: 'era2000', label: '2000年代' },
  { key: 'era1983', label: '1983〜99' },
  { key: 'pre1982', label: '〜1982' },
  { key: 'all',     label: '全年代' },
];

function CondoPriceSimulator({ condos, syncEra = null, syncArea = null }) {
  const [selectedEra, setSelectedEra] = useState('era2011');
  const [area, setArea] = useState('70');

  useEffect(() => {
    if (syncEra) setSelectedEra(syncEra);
  }, [syncEra]);

  useEffect(() => {
    if (syncArea != null && syncArea > 0) setArea(String(syncArea));
  }, [syncArea]);

  if (!condos?.avgUnitPrice) return null;

  const eraData = selectedEra === 'all'
    ? { label: '全年代平均', avgUnitPrice: condos.avgUnitPrice, avgPrice: condos.avgPrice, avgArea: condos.avgArea, count: condos.count, p25: condos.p25, p50: condos.p50, p75: condos.p75 }
    : condos.eraStats?.[selectedEra];

  const areaNum = parseFloat(area) || 0;
  const hasP = eraData?.p50 != null && eraData?.p25 != null && eraData?.p75 != null && (eraData?.count ?? 0) >= 5;
  const refUnitPrice = hasP ? eraData.p50 : eraData?.avgUnitPrice;
  const estimate = refUnitPrice && areaNum > 0 ? Math.round(refUnitPrice * areaNum) : null;
  const simRangeMin = hasP && eraData.p25 && areaNum > 0 ? Math.round(eraData.p25 * areaNum) : null;
  const simRangeMax = hasP && eraData.p75 && areaNum > 0 ? Math.round(eraData.p75 * areaNum) : null;

  return (
    <div className="border-t border-gray-100 pt-3 mt-1">
      <p className="text-xs font-bold text-gray-700 font-medium mb-2">📊 エリア成約相場（中古マンション）</p>

      {/* 年代タブ */}
      <div className="flex gap-1 mb-2 flex-wrap">
        {ERA_TABS.map(({ key, label }) => {
          const data = key === 'all' ? condos : condos.eraStats?.[key];
          const hasData = !!data?.avgUnitPrice;
          return (
            <button
              key={key}
              onClick={() => hasData && setSelectedEra(key)}
              className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
                selectedEra === key
                  ? 'bg-blue-600 text-white'
                  : hasData
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : 'bg-gray-50 text-gray-300 cursor-default'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {eraData?.avgUnitPrice ? (
        <>
          <div className="bg-blue-50 rounded-lg px-3 py-2 mb-2">
            <p className="text-xs text-gray-700 font-medium mb-0.5">{eraData.label}</p>
            {hasP ? (
              <>
                <p className="text-lg font-bold text-blue-700">{eraData.p50}万円/㎡ <span className="text-xs font-normal text-gray-700 font-medium">（中央値）</span></p>
                <p className="text-xs text-gray-700 font-medium mt-0.5">適正レンジ（P25〜P75）: {eraData.p25}〜{eraData.p75}万円/㎡</p>
              </>
            ) : (
              <p className="text-lg font-bold text-blue-700">{eraData.avgUnitPrice}万円/㎡</p>
            )}
            <div className="flex flex-wrap gap-x-3 text-xs text-gray-700 font-medium mt-0.5">
              {eraData.avgPrice && <span>平均成約価格 約{eraData.avgPrice.toLocaleString()}万円</span>}
              {eraData.avgArea  && <span>平均面積 約{eraData.avgArea}㎡</span>}
              <span>{eraData.count}件</span>
            </div>
          </div>

          <p className="text-xs text-gray-700 font-medium mb-1">希望の広さ</p>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              inputMode="numeric"
              value={area}
              onChange={e => setArea(toHalfInt(e.target.value))}
              className="w-20 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
            />
            <span className="text-xs text-gray-700 font-medium">㎡</span>
          </div>
          {estimate && (
            <div className="bg-white rounded-lg px-3 py-2 border border-blue-200">
              {hasP && simRangeMin && simRangeMax ? (
                <>
                  <p className="text-xs text-gray-700 font-medium">適正レンジ（P25〜P75）</p>
                  <p className="text-lg font-bold text-blue-700">約{simRangeMin.toLocaleString()}万〜{simRangeMax.toLocaleString()}万円</p>
                  <p className="text-xs text-gray-700 font-medium">中央値 {eraData.p50}万円/㎡ × {area}㎡ ≒ 約{estimate.toLocaleString()}万円</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-700 font-medium">このエリアの目安</p>
                  <p className="text-lg font-bold text-blue-700">約{estimate.toLocaleString()}万円</p>
                  <p className="text-xs text-gray-700 font-medium">{eraData.avgUnitPrice}万円/㎡ × {area}㎡</p>
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-gray-700 font-medium text-center py-2">この年代のデータなし</p>
      )}

      <p className="text-sm text-gray-700 font-medium mt-3">※ 国交省REINFOLIB 中古成約価格</p>
    </div>
  );
}

const LAND_FEATURES = [
  { id: 'flag',    label: '旗竿地',          rate: -0.25, minus: true  },
  { id: 'corner',  label: '角地',            rate: +0.08, minus: false },
  { id: 'south',   label: '日当たり良好',    rate: +0.04, minus: false },
  { id: 'slope',   label: '傾斜地・高低差あり', rate: -0.12, minus: true  },
  { id: 'narrow',  label: '前面道路4m未満',  rate: -0.10, minus: true  },
];

function HousePriceSimulator({ records, landAreaProp, avgPerSqmAll, totalCount, adjustmentRate = 0 }) {
  const [landArea, setLandArea] = useState('120');
  useEffect(() => { if (landAreaProp) setLandArea(String(landAreaProp)); }, [landAreaProp]);

  // 全件ベースの平米単価を優先。なければ表示件数から計算（フォールバック）
  const validRecords = records?.filter(r => r.landArea > 0) || [];
  const avgPerSqm = avgPerSqmAll ?? (
    validRecords.length > 0
      ? validRecords.reduce((s, r) => s + r.price / r.landArea, 0) / validRecords.length
      : null
  );
  const count = totalCount ?? validRecords.length;
  if (!avgPerSqm) return null;

  const baseEstimate = landArea ? Math.round(avgPerSqm * parseFloat(landArea)) : null;
  const estimate = baseEstimate ? Math.round(baseEstimate * (1 + adjustmentRate)) : null;
  const hasAdjustment = adjustmentRate !== 0;

  return (
    <div className="border-t border-gray-100 pt-3 mt-1">
      <p className="text-xs font-bold text-gray-700 font-medium mb-2">💡 価格シミュレーター</p>
      <p className="text-xs text-gray-700 font-medium mb-1.5">希望の土地面積</p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={landArea}
          onChange={e => setLandArea(toHalfInt(e.target.value))}
          placeholder="例: 150"
          className="w-24 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-400"
        />
        <span className="text-xs text-gray-700 font-medium">㎡</span>
      </div>

      {estimate && (
        <div className={`mt-2 rounded-lg px-3 py-2 ${hasAdjustment ? 'bg-amber-50' : 'bg-green-50'}`}>
          <p className="text-xs text-gray-700 font-medium">このエリアの目安（土地＋建物込み）</p>
          <p className={`text-lg font-bold ${hasAdjustment ? 'text-amber-700' : 'text-green-700'}`}>
            約 {estimate.toLocaleString()}万円
          </p>
          {hasAdjustment ? (
            <p className="text-xs text-gray-700 font-medium">
              基準 {baseEstimate?.toLocaleString()}万円
              {adjustmentRate > 0 ? ` ＋${Math.round(adjustmentRate * 100)}%` : ` ${Math.round(adjustmentRate * 100)}%`}
              補正（コスト診断の土地条件に連動）
            </p>
          ) : (
            <p className="text-xs text-gray-700 font-medium">
              成約{count}件の平均 {Math.round(avgPerSqm * 10) / 10}万円/㎡（土地） × {landArea}㎡
            </p>
          )}
        </div>
      )}
      <p className="text-xs text-gray-700 font-medium mt-2">※ 中古成約価格を元にした参考値です</p>
    </div>
  );
}


function yearToEra(y) {
  const yr = parseInt(y);
  if (!yr) return null;
  if (yr <= 1982) return 'pre1982';
  if (yr <= 1999) return 'era1983';
  if (yr <= 2010) return 'era2000';
  return 'era2011';
}

function getBaseRentYield(address) {
  if (!address) return 6.5;
  if (/東京都/.test(address)) {
    if (/千代田区|中央区|港区|新宿区|渋谷区/.test(address)) return 3.8;
    if (/文京区|台東区|墨田区|江東区|品川区|目黒区|大田区|世田谷区|杉並区|豊島区|北区|荒川区|板橋区|練馬区|足立区|葛飾区|江戸川区/.test(address)) return 4.3;
    return 5.0;
  }
  if (/横浜市|川崎市/.test(address)) return 5.0;
  if (/大阪市|名古屋市|福岡市|札幌市|仙台市|さいたま市|千葉市|京都市|神戸市|広島市|北九州市|熊本市|岡山市|相模原市/.test(address)) return 5.2;
  if (/神奈川県|千葉県|埼玉県|愛知県|大阪府|兵庫県|福岡県|京都府|宮城県|北海道|広島県|静岡県/.test(address)) return 6.0;
  return 7.5;
}

function calcRentYield(address, builtYear, nearestStationM, areaNum) {
  let y = getBaseRentYield(address);
  const yr = parseInt(builtYear) || 0;
  if (yr > 0 && yr <= 1981) y += 1.5;
  else if (yr >= 2000) y -= 0.3;
  if (nearestStationM != null) {
    const walkMin = Math.round(nearestStationM * 1.3 / 80);
    if (walkMin <= 5) y -= 0.5;
    else if (walkMin >= 15) y += 0.5;
  }
  // 専有面積による補正（小さいほど利回り高）
  if (areaNum > 0) {
    if (areaNum < 25) y += 2.5;
    else if (areaNum < 35) y += 2.0;
    else if (areaNum < 50) y += 1.0;
    else if (areaNum >= 70) y -= 0.5;
  }
  return Math.round(Math.max(2.5, Math.min(12.0, y)) * 10) / 10;
}

function LoanSimulator({ showMgmt = true, showBuiltYear = true, propertyType = 'condo', condos, houses, homesUrl, googleUrl, onScoreChange = null, onHouseAdjustChange, address = null, nearestStationM = null }) {
  const [price, setPrice] = useState('5000');
  const [down, setDown]   = useState('1000');
  const [area, setArea]   = useState('70');
  const [floor, setFloor] = useState('');
  const [landArea, setLandArea]         = useState('120');
  const [buildingArea, setBuildingArea] = useState('100');
  const [structure, setStructure]       = useState('木造');
  const [landPrice, setLandPrice]       = useState('');
  const [buildingPrice, setBuildingPrice] = useState('');
  const [builtYear, setBuiltYear] = useState('');
  const [landFeatures, setLandFeatures] = useState({});

  const toggleLandFeature = (id) => {
    setLandFeatures(prev => {
      const next = { ...prev, [id]: !prev[id] };
      const rate = LAND_FEATURES.filter(f => next[f.id]).reduce((s, f) => s + f.rate, 0);
      onHouseAdjustChange?.(rate);
      return next;
    });
  };
  const houseAdjustRate = LAND_FEATURES.filter(f => landFeatures[f.id]).reduce((s, f) => s + f.rate, 0);
  const [isNewConstruction, setIsNewConstruction] = useState(false);
  const [varRate, setVarRate] = useState('0.5');
  const [varYears, setVarYears] = useState('35');
  const [fixRate, setFixRate] = useState('3.4');
  const [fixYears, setFixYears] = useState('35');
  const [mgmt, setMgmt]       = useState('');
  const [reserve, setReserve] = useState('');
  const [mgmtManual, setMgmtManual]       = useState(false);
  const [reserveManual, setReserveManual] = useState(false);
  const [rateData, setRateData] = useState(null);

  useEffect(() => {
    fetch('/api/interest-rate')
      .then(r => r.json())
      .then(d => {
        setRateData(d);
        if (d.callRate)   setVarRate(String(Math.round(d.callRate * 100) / 100));
        if (d.flat35Rate) setFixRate(String(d.flat35Rate));
      })
      .catch(() => {});
  }, []);

  // 面積変更時に管理費・修繕積立金のデフォルト値を自動計算（200円/㎡、500円単位）
  // ユーザーが手動入力した場合は上書きしない
  useEffect(() => {
    const a = parseFloat(area) || 0;
    if (a <= 0) return;
    const def = String(Math.round(a * 200 / 500) * 500);
    if (!mgmtManual)    setMgmt(def);
    if (!reserveManual) setReserve(def);
  }, [area]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = parseFloat(price) || 0;
  const d = parseFloat(down) || 0;
  const principal = (p - d) * 10000;
  const calcMonthly = (rateStr, yearsStr) => {
    const r = parseFloat(rateStr) / 100 / 12;
    const n = parseInt(yearsStr) * 12;
    return principal > 0 && r > 0 && n > 0
      ? Math.round(principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1))
      : null;
  };
  const monthlyVar = calcMonthly(varRate, varYears);
  const monthlyFix = calcMonthly(fixRate, fixYears);
  const nVar = parseInt(varYears) * 12;
  const nFix = parseInt(fixYears) * 12;
  const totalPaymentVar  = monthlyVar ? monthlyVar * nVar : null;
  const totalPaymentFix  = monthlyFix ? monthlyFix * nFix : null;
  const totalInterestVar = totalPaymentVar ? totalPaymentVar - principal : null;
  const totalInterestFix = totalPaymentFix ? totalPaymentFix - principal : null;

  // 築年から年代を自動判定
  const autoEra = yearToEra(builtYear);
  const eraKey  = autoEra ?? 'all';
  const eraData = eraKey === 'all' ? condos : (condos?.eraStats?.[eraKey] ?? condos);
  const unitPrice = eraData?.avgUnitPrice ?? null;
  const eraLabel = eraKey === 'all'
    ? '全年代平均'
    : (condos?.eraStats?.[eraKey]?.label ?? '');
  const p25 = eraData?.p25 ?? null;
  const p50 = eraData?.p50 ?? null;
  const p75 = eraData?.p75 ?? null;
  const p90 = eraData?.p90 ?? null;
  const hasPercentiles = p25 != null && p75 != null && (eraData?.count ?? 0) >= 5;

  const areaNum         = parseFloat(area)          || 0;
  const landAreaNum     = parseFloat(landArea)      || 0;
  const buildingAreaNum = parseFloat(buildingArea)  || 0;
  const landPriceNum    = parseFloat(landPrice)     || 0;
  const buildingPriceNum = parseFloat(buildingPrice) || 0;
  const breakdownSum    = landPriceNum + buildingPriceNum;
  const breakdownMismatch = breakdownSum > 0 && p > 0 && Math.abs(breakdownSum - p) > 1;
  const actualUnitPrice = p > 0 && areaNum > 0 ? p / areaNum : null;

  // パーセンタイルが使える場合はパーセンタイルベース、足りない場合は平均比率ベース
  const ratio = !hasPercentiles && actualUnitPrice && unitPrice ? actualUnitPrice / unitPrice : null;
  const feedback = hasPercentiles && actualUnitPrice != null
    ? actualUnitPrice < p25
      ? { label: 'お得！',     sub: '成約の下位25%以内の割安水準', color: 'text-green-700',  bg: 'bg-green-50 border-green-200' }
      : actualUnitPrice <= p75
      ? { label: '適正',       sub: '成約の中央50%の範囲内',       color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200' }
      : actualUnitPrice <= p90
      ? { label: 'やや高め',   sub: '上位25%水準。交渉の余地あり', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' }
      : { label: 'かなり高め', sub: '上位10%水準。価格交渉を',     color: 'text-red-700',    bg: 'bg-red-50 border-red-200' }
    : ratio === null ? null
    : ratio < 0.85 ? { label: 'お得！',   sub: '平均より15%以上割安',   color: 'text-green-700',  bg: 'bg-green-50 border-green-200' }
    : ratio < 0.95 ? { label: '割安な方', sub: '平均より少し安め',       color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' }
    : ratio < 1.05 ? { label: '相場内',   sub: 'エリア平均に近い水準',   color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200' }
    : ratio < 1.20 ? { label: 'やや高め', sub: '交渉する余地があるかも', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' }
    :                { label: 'かなり高め', sub: 'しっかり価格交渉を',   color: 'text-red-700',    bg: 'bg-red-50 border-red-200' };
  // 参照価格: パーセンタイルあり→中央値、なし→平均
  const refPrice = (hasPercentiles ? p50 : unitPrice) ?? null;
  // 所在階による価格補正（文献値ベースの目安）
  const floorNum = parseInt(floor) || 0;
  const floorAdj = floorNum === 0 ? 1.0
    : floorNum === 1 ? 0.88
    : floorNum <= 3  ? 0.94
    : floorNum <= 6  ? 1.00
    : Math.min(1 + (floorNum - 6) * 0.015, 1.20);
  const floorAdjPct = floorNum > 0 ? Math.round((floorAdj - 1) * 100) : 0;
  const estimate = refPrice && areaNum > 0 ? Math.round(refPrice * areaNum * floorAdj) : null;
  const rangeMin = hasPercentiles && p25 && areaNum > 0 ? Math.round(p25 * areaNum * floorAdj) : null;
  const rangeMax = hasPercentiles && p75 && areaNum > 0 ? Math.round(p75 * areaNum * floorAdj) : null;
  const needsBuiltYear = !builtYear && ratio !== null;
  // 想定賃料（P50市場価値ベース・マンションのみ）
  const rentYield = propertyType === 'condo' && builtYear && p50 && areaNum > 0
    ? calcRentYield(address, builtYear, nearestStationM, areaNum)
    : null;
  const marketValueM = p50 && areaNum > 0 ? Math.round(p50 * areaNum * floorAdj) : null;
  const estimatedMonthlyRentM = rentYield && marketValueM
    ? Math.round(marketValueM * rentYield / 100 / 12 * 10) / 10
    : null;

  // 管理費・修繕積立金の相場感
  const reserveMin = areaNum > 0 ? Math.round(areaNum * 200) : null;
  const reserveMax = areaNum > 0 ? Math.round(areaNum * 500) : null;
  const reserveVal = parseInt(reserve) || 0;
  const mgmtVal    = parseInt(mgmt)    || 0;
  const reserveStatus = reserveVal > 0 && reserveMin
    ? reserveVal < 10000
      ? { label: '⚠ 低すぎ',     cls: 'text-red-600 bg-red-50',
          hint: '月1万円以下は危険水域。マンションは築年数とともに外壁・屋上・エレベーターなどの大規模修繕が必要になります。積立不足だと将来、数十〜数百万円の一時金請求や急激な値上げが発生することがあります。' }
      : reserveVal < reserveMin
      ? { label: '△ やや低め',   cls: 'text-orange-600 bg-orange-50',
          hint: `このマンションの適正目安（${reserveMin?.toLocaleString()}〜${reserveMax?.toLocaleString()}円）を下回っています。長期修繕計画を取り寄せ、将来の値上げ予定がないか確認しましょう。` }
      : reserveVal <= reserveMax
      ? { label: '✓ 適正範囲',   cls: 'text-green-700 bg-green-50',
          hint: `国交省ガイドライン（㎡×200〜500円）の範囲内です。大規模修繕に備えた積立ができています。` }
      : { label: '◎ 高めで安心', cls: 'text-blue-600 bg-blue-50',
          hint: '十分な積立水準です。大規模修繕にも余裕を持って対応できます。' }
    : null;
  const mgmtStatus = mgmtVal > 0
    ? mgmtVal < 8000
      ? { label: '△ 低め',   cls: 'text-orange-600 bg-orange-50',
          hint: '管理費が低すぎると清掃・設備管理・管理人などのサービスが手薄になりがちです。将来の値上げリスクもあります。内容をよく確認しましょう。' }
      : mgmtVal <= 25000
      ? { label: '✓ 標準的', cls: 'text-green-700 bg-green-50',
          hint: '全国平均（月1.3〜1.6万円）の範囲内です。一般的な管理サービスが受けられる水準です。出典：国交省「令和3年度マンション総合調査」' }
      : { label: '△ 高め',   cls: 'text-orange-600 bg-orange-50',
          hint: '管理費が高めです。24時間管理人・コンシェルジュ・共用施設の充実など、サービス内容と見合っているか確認しましょう。' }
    : null;
  // 金利の相場比較バッジ（変動・固定それぞれ）
  const varRateNum = parseFloat(varRate) || 0;
  const varRateStatus = rateData && varRateNum > 0
    ? varRateNum <= 0.8
      ? { label: '変動相場内', cls: 'text-green-700 bg-green-50',
          hint: `大手銀行の変動金利は0.3〜0.8%が目安です（現在のコールレート: ${rateData.callRate}%）。` }
      : varRateNum <= 1.5
      ? { label: 'やや高め', cls: 'text-orange-700 bg-orange-50',
          hint: '変動金利の相場（0.3〜0.8%）より高めです。金融機関に優遇幅を確認しましょう。' }
      : { label: '変動として高め', cls: 'text-red-700 bg-red-50',
          hint: '変動金利にしては高い水準です。固定金利も含めて再検討してみましょう。' }
    : null;

  const fixRateNum = parseFloat(fixRate) || 0;
  const fixEst = rateData?.flat35Rate ?? 2.8;
  const jgb = rateData?.jgb10y;
  const fixRateStatus = rateData && fixRateNum > 0
    ? fixRateNum <= fixEst - 0.3
      ? { label: '優遇水準', cls: 'text-blue-700 bg-blue-50',
          hint: `フラット35の現在の最低金利（${fixEst}%）より低い優遇水準です。${jgb != null ? ` 参考: 10年国債利回り ${jgb}%（固定金利の基準となる長期金利）。` : ''}` }
      : fixRateNum <= fixEst + 0.3
      ? { label: 'フラット35相場内', cls: 'text-green-700 bg-green-50',
          hint: `フラット35の現在の最低金利は${fixEst}%（住宅金融支援機構・21〜35年）です。${jgb != null ? ` 参考: 10年国債利回り ${jgb}%（固定金利の基準。国債が上がると固定金利も上がる傾向）。` : ''}` }
      : { label: 'やや高め', cls: 'text-orange-700 bg-orange-50',
          hint: `フラット35の最低金利（${fixEst}%）より高い水準です。複数の金融機関に相談しましょう。${jgb != null ? ` 参考: 10年国債利回り ${jgb}%。` : ''}` }
    : null;

  const brokerage      = p > 0 ? Math.round((p * 0.03 + 6) * 1.1 * 10) / 10 : 0;
  const registration   = p > 0 ? Math.round(p * 0.01 + 20) : 0;
  const loanFee        = p > 0 ? Math.round(p * 0.85 * 0.022) : 0;
  const acquisitionTax = p > 0 ? Math.round(p * 0.005) : 0;
  const fireInsurance  = p > 0 ? (propertyType === 'house' ? 15 : 5) : 0;
  const totalMisc      = brokerage + registration + loanFee + acquisitionTax + fireInsurance;

  const [openHint, setOpenHint] = useState(null);
  const [showMiscBreakdown, setShowMiscBreakdown] = useState(false);

  // 戸建て比較: 土地面積入力済みなら「平米単価×面積」の試算値と比較、未入力ならエリア平均にフォールバック
  // 全件ベースの avgPerSqm を優先（top-10 バイアス排除）
  const houseValidRecords = houses?.records?.filter(r => r.landArea > 0) || [];
  const houseAvgPerSqm = houses?.avgPerSqm ?? (
    houseValidRecords.length > 0
      ? houseValidRecords.reduce((s, r) => s + r.price / r.landArea, 0) / houseValidRecords.length
      : null
  );
  const houseEstimateBase = houseAvgPerSqm && landAreaNum > 0 ? Math.round(houseAvgPerSqm * landAreaNum) : null;
  const houseEstimate = houseEstimateBase ? Math.round(houseEstimateBase * (1 + houseAdjustRate)) : null;
  const houseBase = houseEstimate ?? (houses?.avgPrice > 0 ? Math.round(houses.avgPrice * (1 + houseAdjustRate)) : null);
  const houseRatio = propertyType === 'house' && houseBase && p > 0 ? p / houseBase : null;
  const hFeedback = houseRatio === null ? null
    : houseRatio < 0.80 ? { label: 'お得！',    sub: '目安より20%以上割安',   color: 'text-green-700',  bg: 'bg-green-50 border-green-200' }
    : houseRatio < 0.92 ? { label: '割安な方',  sub: '目安より少し安め',       color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' }
    : houseRatio < 1.08 ? { label: '相場内',    sub: 'エリアの目安に近い水準', color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200' }
    : houseRatio < 1.25 ? { label: 'やや高め',  sub: '交渉する余地があるかも', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' }
    :                     { label: 'かなり高め', sub: 'しっかり価格交渉を',     color: 'text-red-700',    bg: 'bg-red-50 border-red-200' };

  const loanScoreVal = hasPercentiles && actualUnitPrice != null
    ? (actualUnitPrice < p25 ? 10 : actualUnitPrice <= p50 ? 8 : actualUnitPrice <= p75 ? 6 : actualUnitPrice <= p90 ? 4 : 2)
    : ratio != null
    ? (ratio < 0.85 ? 10 : ratio < 0.95 ? 8 : ratio < 1.05 ? 6 : ratio < 1.20 ? 4 : 2)
    : houseRatio != null
    ? (houseRatio < 0.80 ? 10 : houseRatio < 0.92 ? 8 : houseRatio < 1.08 ? 6 : houseRatio < 1.25 ? 4 : 2)
    : null;

  useEffect(() => {
    if (!onScoreChange) return;
    onScoreChange({
      score:         loanScoreVal,
      price:         p > 0 ? p : null,
      area:          areaNum > 0 ? areaNum : null,
      floor:         propertyType === 'condo' && parseInt(floor) > 0 ? parseInt(floor) : null,
      builtYear:     builtYear || null,
      feedbackLabel: (feedback ?? hFeedback)?.label ?? null,
      feedbackSub:   (feedback ?? hFeedback)?.sub   ?? null,
      eraLabel:      (ratio != null || hasPercentiles) ? eraLabel : null,
      estimate,
      rangeMin,
      rangeMax,
      totalMisc:     p > 0 ? totalMisc : null,
      down:          d > 0 ? d : null,
      loanAmount:    p > 0 ? Math.max(0, p - d) : null,
      varRate:       parseFloat(varRate) || null,
      varYears:      parseInt(varYears)  || null,
      monthlyVar,
      fixRate:       parseFloat(fixRate) || null,
      fixYears:      parseInt(fixYears)  || null,
      monthlyFix,
      mgmt:          parseInt(mgmt)    > 0 ? parseInt(mgmt)    : null,
      mgmtLabel:     mgmtStatus?.label    ?? null,
      reserve:       parseInt(reserve) > 0 ? parseInt(reserve) : null,
      reserveLabel:  reserveStatus?.label ?? null,
      landArea:      propertyType === 'house' && landAreaNum > 0      ? landAreaNum     : null,
      buildingArea:  propertyType === 'house' && buildingAreaNum > 0  ? buildingAreaNum  : null,
      structure:     propertyType === 'house' ? structure : null,
      landPrice:     propertyType === 'house' && landPriceNum > 0     ? landPriceNum     : null,
      buildingPrice: propertyType === 'house' && buildingPriceNum > 0 ? buildingPriceNum : null,
      estimatedMonthlyRentM: estimatedMonthlyRentM ?? null,
      rentYield:             rentYield             ?? null,
      marketValueM:          marketValueM          ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanScoreVal, p, d, areaNum, landAreaNum, buildingAreaNum, structure, landPriceNum, buildingPriceNum, builtYear, monthlyVar, monthlyFix, mgmt, reserve, varRate, fixRate, varYears, fixYears]);

  const inputCls = 'w-full px-2 py-1.5 text-base border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400';

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <p className="text-sm font-bold text-gray-700 mb-3">🩺 物件コストシミュレーター</p>

      {/* エリア比較（戸建て） */}
      {propertyType === 'house' && houseBase && (
        <div className="mb-3">
          {hFeedback ? (
            <div className={`rounded-lg px-3 py-2.5 border ${hFeedback.bg}`}>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <p className={`text-base font-bold ${hFeedback.color}`}>{hFeedback.label}</p>
                  {loanScoreVal != null && <Stars score={loanScoreVal} />}
                </div>
                <p className={`text-xs font-medium ${hFeedback.color}`}>{hFeedback.sub}</p>
              </div>
              <div className="flex gap-3 text-xs text-gray-700 font-medium">
                <span>入力: {p.toLocaleString()}万円</span>
                <span>エリアの目安: {houseBase.toLocaleString()}万円</span>
              </div>
              <p className="text-xs text-gray-700 font-medium mt-0.5">
                {houseEstimate
                  ? `※ ${houses?.count ?? houseValidRecords.length}件の成約より算出した平米単価（${Math.round(houseAvgPerSqm * 10) / 10}万円/㎡）× 土地${landAreaNum}㎡で試算${houses?.filtered ? '（直近20年以内築）' : ''}${houseAdjustRate !== 0 ? `・土地条件補正${houseAdjustRate > 0 ? '+' : ''}${Math.round(houseAdjustRate * 100)}%適用` : ''}`
                  : `※ ${houses?.count}件の成約事例の平均（土地・建物込み）との比較。土地面積を入力するとより精度が上がります${houses?.filtered ? '（直近20年以内築）' : ''}${houseAdjustRate !== 0 ? `・土地条件補正${houseAdjustRate > 0 ? '+' : ''}${Math.round(houseAdjustRate * 100)}%適用` : ''}`}
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              <p className="text-xs text-gray-700 font-medium">物件価格を入力するとエリアの目安と比較します</p>
              <p className="text-sm font-bold text-green-700 mt-0.5">
                {houseEstimate
                  ? `エリアの目安: 約${houseBase.toLocaleString()}万円（土地${landAreaNum}㎡で試算）`
                  : `エリア平均: 約${houseBase.toLocaleString()}万円（土地・建物込み）`}
              </p>
              <p className="text-xs text-gray-700 font-medium">
                {houseEstimate
                  ? `平米単価 ${Math.round(houseAvgPerSqm * 10) / 10}万円/㎡ × ${landAreaNum}㎡ ／ ${houseValidRecords.length}件の成約より`
                  : `${houses?.count}件の成約事例より ／ 土地面積を入力するとより精度が上がります`}
              </p>
            </div>
          )}
        </div>
      )}


      {/* エリア比較（マンション：物件価格の上） */}
      {condos?.avgUnitPrice && (
        <div className="mb-3">
          {autoEra && builtYear && (
            <p className="text-xs text-gray-700 font-medium mb-1.5">
              築年 {builtYear} → <span className="font-medium text-blue-600">{eraLabel}</span> の成約分布と比較（{eraData?.count ?? condos?.count}件）
            </p>
          )}
          {!builtYear ? (
            <div className="rounded-lg px-3 py-2.5 border bg-amber-50 border-amber-200">
              <p className="text-sm font-bold text-amber-700">築年を入力してください</p>
              <p className="text-xs text-amber-600 mt-0.5">年代別の正確な相場と比較するために築年（西暦）の入力が必要です。</p>
            </div>
          ) : feedback ? (
            <div className={`rounded-lg px-3 py-2.5 border ${feedback.bg}`}>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <p className={`text-base font-bold ${feedback.color}`}>{feedback.label}</p>
                  {loanScoreVal != null && <Stars score={loanScoreVal} />}
                </div>
                <p className={`text-xs font-medium ${feedback.color}`}>{feedback.sub}</p>
              </div>
              <div className="flex gap-3 text-xs text-gray-700 font-medium">
                <span>入力: {Math.round(actualUnitPrice * 10) / 10}万/㎡</span>
                {hasPercentiles
                  ? <span>中央値(P50): {p50}万/㎡</span>
                  : <span>{eraLabel}: {unitPrice}万/㎡</span>}
              </div>
              {hasPercentiles && rangeMin && rangeMax ? (
                <p className="text-xs text-gray-700 font-medium mt-0.5">適正レンジ（P25〜P75）: 約{rangeMin.toLocaleString()}万〜{rangeMax.toLocaleString()}万円</p>
              ) : estimate ? (
                <p className="text-xs text-gray-700 font-medium mt-0.5">エリア目安（平均）: 約{estimate.toLocaleString()}万円</p>
              ) : null}
              {floorAdjPct !== 0 && (estimate || (rangeMin && rangeMax)) && (
                <p className="text-[10px] text-gray-400 mt-0.5">※ {floorNum}階補正 {floorAdjPct > 0 ? '+' : ''}{floorAdjPct}%を適用（文献値ベースの目安）</p>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              <p className="text-xs text-gray-700 font-medium">物件価格・広さを入力するとエリアの成約分布と比較します</p>
              {hasPercentiles && areaNum > 0 ? (
                <p className="text-sm font-bold text-blue-700 mt-0.5">
                  適正レンジ（P25〜P75）: 約{rangeMin?.toLocaleString()}万〜{rangeMax?.toLocaleString()}万円
                </p>
              ) : estimate ? (
                <p className="text-sm font-bold text-blue-700 mt-0.5">
                  {eraLabel}の目安: 約{estimate.toLocaleString()}万円
                </p>
              ) : null}
              {floorAdjPct !== 0 && (estimate || (rangeMin && rangeMax)) && (
                <p className="text-[10px] text-gray-400 mt-0.5">※ {floorNum}階補正 {floorAdjPct > 0 ? '+' : ''}{floorAdjPct}%を適用（文献値ベースの目安）</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mb-3">
        {showBuiltYear && (
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-gray-700 font-medium">築年（西暦）</p>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isNewConstruction}
                  onChange={e => {
                    setIsNewConstruction(e.target.checked);
                    if (e.target.checked) setBuiltYear(String(new Date().getFullYear()));
                    else setBuiltYear('');
                  }}
                  className="w-3.5 h-3.5 accent-blue-600"
                />
                <span className="text-xs text-blue-600 font-medium">新築</span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input type="text" inputMode="numeric" value={builtYear}
                onChange={e => { setIsNewConstruction(false); setBuiltYear(toHalfInt(e.target.value)); }}
                placeholder="例: 2005"
                className={`w-1/2 px-2 py-1.5 text-base border rounded-lg focus:outline-none focus:border-blue-400 ${isNewConstruction ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200'}`} />
              {homesUrl && (
                <a href={homesUrl} target="_blank" rel="noopener noreferrer"
                  className="text-center text-xs px-2 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg font-medium hover:bg-orange-100 transition-colors whitespace-nowrap">
                  🏠 HOMESで確認
                </a>
              )}
              {googleUrl && (
                <a href={googleUrl} target="_blank" rel="noopener noreferrer"
                  className="text-center text-xs px-2 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-medium hover:bg-blue-100 transition-colors whitespace-nowrap">
                  🔍 Webで検索
                </a>
              )}
            </div>
            {builtYear && (() => {
              const yr = parseInt(builtYear);
              if (!yr) return null;
              if (yr <= 1982) return (
                <p className="text-xs text-red-600 mt-1 leading-snug">⚠ 旧耐震基準の可能性。重要事項説明書の建築確認日を確認してください</p>
              );
              if (yr <= 1985) return (
                <p className="text-xs text-amber-600 mt-1 leading-snug">△ グレーゾーン。確認申請が旧耐震基準の時代に行われた可能性があります。重要事項説明書で確認申請日をご確認ください</p>
              );
              if (yr <= 1999) return (
                <p className="text-xs text-green-600 mt-1 leading-snug">✓ 新耐震基準（1981年以降）。設計段階から新耐震基準が適用された世代です</p>
              );
              if (yr <= 2000) return (
                <p className="text-xs text-blue-600 mt-1 leading-snug">✓ 2000年基準。接合部・基礎の規定が強化された世代です</p>
              );
              return (
                <p className="text-xs text-green-600 mt-1 leading-snug">◎ 2000年基準以降。現行の耐震基準を満たした建物です</p>
              );
            })()}
          </div>
        )}
        {/* 物件価格（1行目・常に全幅） */}
        <div className="mb-2">
          <p className="text-sm text-gray-700 font-medium mb-1">物件価格（万円）</p>
          <input type="text" inputMode="numeric" value={price} onChange={e => setPrice(toHalfInt(e.target.value))} className={inputCls} />
        </div>
        {/* 2行目: マンション→専有面積・所在階、戸建て→建物構造 */}
        {propertyType === 'condo' ? (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <p className="text-sm text-gray-700 font-medium mb-1">専有面積（㎡）</p>
              <input type="text" inputMode="numeric" value={area} onChange={e => setArea(toHalfInt(e.target.value))} className={inputCls} />
            </div>
            <div>
              <p className="text-sm text-gray-700 font-medium mb-1">所在階（任意）</p>
              <input type="text" inputMode="numeric" value={floor} onChange={e => setFloor(toHalfInt(e.target.value))} placeholder="例: 5" className={inputCls} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <p className="text-sm text-gray-700 font-medium mb-1">建物構造</p>
              <select value={structure} onChange={e => setStructure(e.target.value)}
                className="w-full px-2 py-1.5 text-base border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white">
                <option>木造</option>
                <option>軽量鉄骨</option>
                <option>重量鉄骨</option>
                <option>RC（鉄筋コンクリート）</option>
              </select>
            </div>
          </div>
        )}

        {/* 戸建て: 土地・建物価格の内訳（常時表示） */}
        {propertyType === 'house' && (
          <div className="mb-2">
            <div className="grid grid-cols-2 gap-2 mb-1.5">
              <div>
                <p className="text-sm text-gray-700 font-medium mb-1">土地価格（万円）</p>
                <input type="text" inputMode="numeric" value={landPrice} placeholder="任意"
                  onChange={e => setLandPrice(toHalfInt(e.target.value))} className={inputCls} />
              </div>
              <div>
                <p className="text-sm text-gray-700 font-medium mb-1">建物価格（万円）</p>
                <input type="text" inputMode="numeric" value={buildingPrice} placeholder="任意"
                  onChange={e => setBuildingPrice(toHalfInt(e.target.value))} className={inputCls} />
              </div>
            </div>
            {breakdownSum > 0 && (
              <div className={`text-xs rounded-lg px-2 py-1.5 flex justify-between ${breakdownMismatch ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                <span>土地 + 建物の合計</span>
                <span className="font-bold">{breakdownSum.toLocaleString()}万円{breakdownMismatch ? `（物件価格 ${p.toLocaleString()}万円 と不一致）` : ' ✓'}</span>
              </div>
            )}
          </div>
        )}

        {/* 戸建て: 土地面積・建物面積 */}
        {propertyType === 'house' && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <p className="text-sm text-gray-700 font-medium mb-1">土地面積（㎡）</p>
                <input type="text" inputMode="numeric" value={landArea} onChange={e => setLandArea(toHalfInt(e.target.value))} className={inputCls} />
              </div>
              <div>
                <p className="text-sm text-gray-700 font-medium mb-1">建物面積（㎡）</p>
                <input type="text" inputMode="numeric" value={buildingArea} onChange={e => setBuildingArea(toHalfInt(e.target.value))} className={inputCls} />
              </div>
            </div>
            {/* 土地の条件 */}
            <div className="mb-2">
              <p className="text-sm text-gray-700 font-medium mb-1.5">土地の条件（任意）</p>
              <div className="flex flex-wrap gap-1.5">
                {LAND_FEATURES.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleLandFeature(f.id)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      landFeatures[f.id]
                        ? f.minus
                          ? 'bg-red-100 border-red-300 text-red-700 font-medium'
                          : 'bg-blue-100 border-blue-300 text-blue-700 font-medium'
                        : 'bg-gray-50 border-gray-200 text-gray-700 font-medium hover:bg-gray-100'
                    }`}
                  >
                    {landFeatures[f.id] ? (f.minus ? '▼ ' : '▲ ') : ''}{f.label}
                    <span className="ml-1 opacity-60">{f.rate > 0 ? `+${Math.round(f.rate * 100)}%` : `${Math.round(f.rate * 100)}%`}</span>
                  </button>
                ))}
              </div>
              {houseAdjustRate !== 0 && (
                <p className="text-xs mt-1.5 font-medium" style={{ color: houseAdjustRate < 0 ? '#b91c1c' : '#1d4ed8' }}>
                  補正率: {houseAdjustRate > 0 ? '+' : ''}{Math.round(houseAdjustRate * 100)}%（成約価格目安に反映済み）
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* 頭金 + 手元現金サマリー */}
      <div className="flex items-center gap-2 mt-5 mb-3">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-sm font-bold text-gray-600 shrink-0">購入時に必要なコスト</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>
      <div className="mb-3">
        <p className="text-sm text-gray-700 font-medium mb-1">物件の頭金（万円）</p>
        <input type="text" inputMode="numeric" value={down} onChange={e => setDown(toHalfInt(e.target.value))} className={inputCls} />
        {p > 0 && (
          <div className="mt-2 mb-2 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
            <div className="flex justify-between items-baseline mb-1">
              <button
                onClick={() => setShowMiscBreakdown(v => !v)}
                className="flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-gray-800"
              >
                <span>🧾 諸費用の概算（初期費用）</span>
                <span className="text-gray-400">{showMiscBreakdown ? '▲' : '▼'}</span>
              </button>
              <span className="text-base font-bold text-orange-600">約{Math.round(totalMisc).toLocaleString()}万円</span>
            </div>
            {showMiscBreakdown && (
              <>
                <div className="flex flex-col gap-1 text-xs mb-2 mt-2">
                  {[
                    { label: '仲介手数料（上限・税込）',   value: brokerage },
                    { label: '登記・印紙・司法書士',       value: registration },
                    { label: '融資手数料（2.2%目安）',     value: loanFee },
                    { label: '不動産取得税（軽減後目安）', value: acquisitionTax, hintKey: 'acquisitionTax',
                      hint: '購入の翌年に都道府県から納税通知書が届きます（引渡しが年末に近い場合は翌々年になることも）。払い忘れに注意。中古住宅で床面積50㎡以上・1982年以降築などの要件を満たすと税額から最大45万円が控除されます（この概算はその軽減後の値です）。' },
                    { label: `火災保険（5年一括・${propertyType === 'house' ? '木造戸建て' : 'マンション'}目安）`, value: fireInsurance, hintKey: 'fireInsurance',
                      hint: '構造・延床面積・補償内容によって大きく異なります。木造戸建ては保険料が高め（5年で10〜30万円）、マンション（RC・SRC）は安め（5年で3〜8万円）。複数社を一括比較して最安値を探すのがおすすめです。地震保険（任意）を追加する場合はさらに同額程度が目安です。' },
                  ].map(({ label, value, hintKey, hint }) => (
                    <div key={label} className="px-1">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 font-medium">{label}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hintKey && (
                            <button
                              onClick={() => setOpenHint(openHint === hintKey ? null : hintKey)}
                              className="text-blue-400 underline opacity-70"
                            >
                              {openHint === hintKey ? '閉じる' : '解説'}
                            </button>
                          )}
                          <span className="font-medium text-gray-600">約{Math.round(value).toLocaleString()}万円</span>
                        </div>
                      </div>
                      {hintKey && openHint === hintKey && (
                        <p className="text-gray-600 bg-white rounded-lg p-2 mt-1 leading-relaxed border border-gray-100">{hint}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            <p className="text-xs text-gray-700 font-medium mt-1">※ 新築・仲介なし・金融機関によって大きく異なります</p>
          </div>
        )}
        {p > 0 && (
          <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100 text-xs">
            <div className="text-gray-700 font-medium">物件の頭金 ＋ 諸費用（目安）</div>
            <div className="flex justify-between items-baseline pt-1.5 mt-1 border-t border-blue-200">
              <span className="text-sm font-bold text-gray-600">購入時に必要な現金の合計</span>
              <span className="text-base font-bold text-blue-700">約{Math.round(d + totalMisc).toLocaleString()}万円</span>
            </div>
          </div>
        )}
      </div>

      {/* 諸費用の概算（インプット直後） */}
      {(monthlyVar || monthlyFix) && (
        <>
          <div className="flex items-center gap-2 mt-5 mb-3">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-sm font-bold text-gray-600 shrink-0">毎月のコスト</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>
          {showMgmt && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-gray-700 font-medium">管理費（月・円）</p>
                  {mgmtManual && (
                    <button onClick={() => { setMgmtManual(false); const a = parseFloat(area)||0; if(a>0) setMgmt(String(Math.round(a*200/500)*500)); }} className="text-[10px] text-blue-500 hover:underline">↩ 自動</button>
                  )}
                </div>
                <input type="text" inputMode="numeric" value={mgmt} onChange={e => { setMgmt(toHalfInt(e.target.value)); setMgmtManual(true); }} className={inputCls} />
                {mgmtStatus && (
                  <button
                    onClick={() => setOpenHint(openHint === 'mgmt' ? null : 'mgmt')}
                    className={`text-xs mt-1 px-1.5 py-0.5 rounded font-medium ${mgmtStatus.cls} flex items-center gap-2`}
                  >
                    {mgmtStatus.label}
                    <span className="underline opacity-70">{openHint === 'mgmt' ? '閉じる' : '解説'}</span>
                  </button>
                )}
                {openHint === 'mgmt' && mgmtStatus && (
                  <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 mt-1 leading-relaxed">{mgmtStatus.hint}</p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-gray-700 font-medium">修繕積立金（月・円）</p>
                  {reserveManual && (
                    <button onClick={() => { setReserveManual(false); const a = parseFloat(area)||0; if(a>0) setReserve(String(Math.round(a*200/500)*500)); }} className="text-[10px] text-blue-500 hover:underline">↩ 自動</button>
                  )}
                </div>
                <input type="text" inputMode="numeric" value={reserve} onChange={e => { setReserve(toHalfInt(e.target.value)); setReserveManual(true); }} className={inputCls} />
                {reserveStatus && (
                  <button
                    onClick={() => setOpenHint(openHint === 'reserve' ? null : 'reserve')}
                    className={`text-xs mt-1 px-1.5 py-0.5 rounded font-medium ${reserveStatus.cls} flex items-center gap-2`}
                  >
                    {reserveStatus.label}
                    <span className="underline opacity-70">{openHint === 'reserve' ? '閉じる' : '解説'}</span>
                  </button>
                )}
                {openHint === 'reserve' && reserveStatus && (
                  <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 mt-1 leading-relaxed">{reserveStatus.hint}</p>
                )}
              </div>
            </div>
          )}

          {/* 管理費・積立金の相場ヒント（マンション・面積入力済み時） */}
          {showMgmt && areaNum > 0 && (
            <div className="bg-gray-50 rounded-lg px-3 py-2.5 mb-3 border border-gray-100">
              <button
                onClick={() => setOpenHint(openHint === 'mgmtHint' ? null : 'mgmtHint')}
                className="flex items-center justify-between w-full"
              >
                <span className="text-sm font-bold text-gray-700">管理費・修繕積立金の相場感</span>
                <span className="text-gray-400 text-xs">{openHint === 'mgmtHint' ? '▲' : '▼'}</span>
              </button>
              {openHint === 'mgmtHint' && (
                <div className="flex flex-col gap-1 text-xs mt-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-700 font-medium">修繕積立金の適正目安</span>
                    <span className="font-medium text-gray-700">
                      {reserveMin?.toLocaleString()}〜{reserveMax?.toLocaleString()}円/月
                    </span>
                  </div>
                  <p className="text-gray-700 font-medium text-xs leading-tight">㎡ × 200〜500円（国交省長期修繕計画ガイドライン）</p>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-gray-700 font-medium">管理費の全国平均</span>
                    <span className="font-medium text-gray-700">約13,000〜16,000円/月</span>
                  </div>
                  <p className="text-gray-700 font-medium text-xs leading-tight">国交省「令和3年度マンション総合調査」</p>
                </div>
              )}
            </div>
          )}

          {/* 金利・返済期間 — 毎月支払いの直上 */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {/* 1行目: 変動金利 | 固定金利 */}
            <div>
              <p className="text-sm text-gray-700 font-medium mb-1">変動金利（年率%）</p>
              <input type="text" inputMode="decimal" value={varRate} onChange={e => setVarRate(toHalfDec(e.target.value))} className={inputCls} />
              {varRateStatus && (
                <button
                  onClick={() => setOpenHint(openHint === 'varRate' ? null : 'varRate')}
                  className={`text-xs mt-1 px-1.5 py-0.5 rounded font-medium ${varRateStatus.cls} flex items-center gap-2`}
                >
                  {varRateStatus.label}
                  <span className="underline opacity-70">{openHint === 'varRate' ? '閉じる' : '解説'}</span>
                </button>
              )}
              {openHint === 'varRate' && varRateStatus && (
                <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 mt-1 leading-relaxed">{varRateStatus.hint}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-700 font-medium mb-1">固定金利（年率%）</p>
              <input type="text" inputMode="decimal" value={fixRate} onChange={e => setFixRate(toHalfDec(e.target.value))} className={inputCls} />
              {fixRateStatus && (
                <button
                  onClick={() => setOpenHint(openHint === 'fixRate' ? null : 'fixRate')}
                  className={`text-xs mt-1 px-1.5 py-0.5 rounded font-medium ${fixRateStatus.cls} flex items-center gap-2`}
                >
                  {fixRateStatus.label}
                  <span className="underline opacity-70">{openHint === 'fixRate' ? '閉じる' : '解説'}</span>
                </button>
              )}
              {openHint === 'fixRate' && fixRateStatus && (
                <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 mt-1 leading-relaxed">{fixRateStatus.hint}</p>
              )}
            </div>
            {/* 2行目: 変動返済期間 | 固定返済期間 */}
            <div>
              <p className="text-sm text-gray-700 font-medium mb-1">変動・返済期間（年）</p>
              <input type="text" inputMode="numeric" value={varYears} onChange={e => setVarYears(toHalfInt(e.target.value))} className={inputCls} />
            </div>
            <div>
              <p className="text-sm text-gray-700 font-medium mb-1">固定・返済期間（年）</p>
              <input type="text" inputMode="numeric" value={fixYears} onChange={e => setFixYears(toHalfInt(e.target.value))} className={inputCls} />
            </div>
          </div>

          {(() => {
            const mgmtN    = showMgmt ? (parseInt(mgmt)    || 0) : 0;
            const reserveN = showMgmt ? (parseInt(reserve) || 0) : 0;
            const totalVar = (monthlyVar ?? 0) + mgmtN + reserveN;
            const totalFix = (monthlyFix ?? 0) + mgmtN + reserveN;
            const diffMonthly = monthlyVar && monthlyFix ? Math.abs(totalFix - totalVar) : null;
            const diffTotal   = totalPaymentVar && totalPaymentFix ? Math.abs(totalPaymentFix - totalPaymentVar) : null;
            return (
              <>
                <p className="text-xs text-gray-700 font-medium mb-1.5">{showMgmt ? '毎月の支払い合計' : '月々の返済額'}</p>
                <div className="grid grid-cols-2 gap-2 mb-1.5">
                  <div className="bg-blue-50 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-blue-400 mb-0.5">変動 {varRate}% / {varYears}年</p>
                    <p className="text-xl font-bold text-blue-700">{totalVar.toLocaleString()}円</p>
                    {showMgmt && (
                      <div className="flex flex-col gap-0.5 mt-1.5">
                        {[
                          { label: 'ローン返済', value: monthlyVar ?? 0 },
                          { label: '管理費',     value: mgmtN },
                          { label: '修繕積立金', value: reserveN },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex justify-between text-xs">
                            <span className="text-blue-300">{label}</span>
                            <span className="text-blue-500">{value.toLocaleString()}円</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="bg-indigo-50 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-indigo-400 mb-0.5">固定 {fixRate}% / {fixYears}年</p>
                    <p className="text-xl font-bold text-indigo-700">{totalFix.toLocaleString()}円</p>
                    {showMgmt && (
                      <div className="flex flex-col gap-0.5 mt-1.5">
                        {[
                          { label: 'ローン返済', value: monthlyFix ?? 0 },
                          { label: '管理費',     value: mgmtN },
                          { label: '修繕積立金', value: reserveN },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex justify-between text-xs">
                            <span className="text-indigo-300">{label}</span>
                            <span className="text-indigo-500">{value.toLocaleString()}円</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {diffMonthly != null && (
                  <p className="text-sm text-gray-700 font-medium text-center mb-2">
                    差: 月<span className="font-semibold text-gray-600">{diffMonthly.toLocaleString()}円</span>
                  </p>
                )}
              </>
            );
          })()}

          <div className="grid grid-cols-2 gap-1.5 text-sm mb-1.5">
            {[
              { label: `総返済(変動)`, val: totalPaymentVar,  cls: 'text-gray-700'   },
              { label: `総返済(固定)`, val: totalPaymentFix,  cls: 'text-gray-700'   },
              { label: `利息(変動)`,   val: totalInterestVar, cls: 'text-orange-500' },
              { label: `利息(固定)`,   val: totalInterestFix, cls: 'text-orange-600' },
            ].map(({ label, val, cls }) => val ? (
              <div key={label} className="bg-gray-50 rounded-lg px-2.5 py-2">
                <p className="text-gray-700 font-medium">{label}</p>
                <p className={`font-semibold ${cls}`}>{Math.round(val / 10000).toLocaleString()}万円</p>
              </div>
            ) : null)}
          </div>
          {totalPaymentVar && totalPaymentFix && varYears === fixYears && (
            <p className="text-sm text-gray-700 font-medium text-center mb-3">
              差: {varYears}年で約<span className="font-semibold text-gray-600">{Math.round(Math.abs(totalPaymentFix - totalPaymentVar) / 10000).toLocaleString()}万円</span>
            </p>
          )}

          {/* 資産性チェック: 想定賃料 vs ローン返済 */}
          {estimatedMonthlyRentM && (monthlyVar || monthlyFix) && (() => {
            const loanMonthlyM = Math.round((monthlyVar || monthlyFix) / 10000 * 10) / 10;
            const diffM = Math.round((loanMonthlyM - estimatedMonthlyRentM) * 10) / 10;
            return (
              <div className="mb-3 bg-violet-50 rounded-xl px-3 py-2.5 border border-violet-100">
                <p className="text-sm font-bold text-violet-700 mb-2">🏘 資産性チェック（もし貸したら？）</p>
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-gray-700 font-medium">想定月額賃料（P50×利回り{rentYield}%）</span>
                    <span className="font-bold text-sm text-violet-700">約{estimatedMonthlyRentM}万円/月</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-gray-700 font-medium">月額ローン返済{monthlyVar ? '（変動）' : '（固定）'}</span>
                    <span className="font-bold text-sm text-gray-700">{loanMonthlyM}万円/月</span>
                  </div>
                  <div className={`flex justify-between items-baseline pt-1.5 mt-0.5 border-t border-violet-200 ${diffM > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                    <span className="text-sm font-semibold">返済 − 賃料</span>
                    <span className="font-bold text-sm">
                      {diffM > 0 ? `+${diffM}万円/月（賃料を超過）` : `${diffM}万円/月（賃料が上回る）`}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">※ エリアP50（市場中央値）×{areaNum}㎡×利回り{rentYield}%で試算。実際の賃料は個別物件・設備・需要により異なります</p>
              </div>
            );
          })()}

          {/* 必要収入の目安 */}
          {(monthlyVar || monthlyFix) && (() => {
            const mgmtN    = showMgmt ? (parseInt(mgmt)    || 0) : 0;
            const reserveN = showMgmt ? (parseInt(reserve) || 0) : 0;
            const totalVar = (monthlyVar ?? 0) + mgmtN + reserveN;
            const totalFix = (monthlyFix ?? 0) + mgmtN + reserveN;
            const varAnnual35 = totalVar ? Math.ceil(totalVar * 12 / 0.35 / 10000) : null;
            const fixAnnual35 = totalFix ? Math.ceil(totalFix * 12 / 0.35 / 10000) : null;
            // 手取り≒額面×80%として、返済比率25%以内に収まる必要年収
            const varAnnual25 = totalVar ? Math.ceil(totalVar * 12 / (0.8 * 0.25) / 10000) : null;
            const fixAnnual25 = totalFix ? Math.ceil(totalFix * 12 / (0.8 * 0.25) / 10000) : null;
            return (
              <>
                <div className="bg-amber-50 rounded-lg px-3 py-2.5 border border-amber-100 text-xs">
                  <p className="text-sm font-bold text-gray-700 mb-1">銀行審査の目安年収<span className="font-normal opacity-60 ml-1">（年収の35%基準）</span></p>
                  <p className="text-gray-500 mb-2">この年収があれば審査に通る目安です。ただし、審査OKと余裕を持って返せるかは別の話です。</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-center gap-1">
                      <p className="text-blue-500 font-medium mb-0.5">変動</p>
                      <p className="text-sm font-semibold text-gray-700">{varAnnual35 != null ? `約${varAnnual35}万円~` : '―'}</p>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <p className="text-indigo-500 font-medium mb-0.5">固定</p>
                      <p className="text-sm font-semibold text-gray-700">{fixAnnual35 != null ? `約${fixAnnual35}万円~` : '―'}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-red-50 rounded-lg px-3 py-2.5 border border-red-100 text-xs">
                  <p className="text-sm font-bold text-gray-700 mb-1">無理なく返せる目安年収<span className="font-normal opacity-60 ml-1">（手取りの25%基準）</span></p>
                  <p className="text-gray-500 mb-2">審査は通っても、生活に余裕を持つにはこれ以上の年収が必要です。</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-center gap-1">
                      <p className="text-blue-500 font-medium mb-0.5">変動</p>
                      <p className="text-sm font-semibold text-red-700">{varAnnual25 != null ? `約${varAnnual25}万円~` : '―'}</p>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <p className="text-indigo-500 font-medium mb-0.5">固定</p>
                      <p className="text-sm font-semibold text-red-700">{fixAnnual25 != null ? `約${fixAnnual25}万円~` : '―'}</p>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}

function DrawerRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-700 font-medium shrink-0 w-20">{label}</span>
      <span className="text-gray-800 font-medium text-right">{value}</span>
    </div>
  );
}

function HouseRecordList({ records }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState(null);
  return (
    <>
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1 text-xs text-green-600 font-medium mb-2"
      >
        最近の成約事例（戸建て）{expanded ? '▲' : '▼'}
      </button>
      {expanded && (
        <div className="flex flex-col gap-1.5 mb-2">
          {records.map((r, i) => {
            const isOpen = expandedIdx === i;
            const details = [
              { label: '間取り',   value: r.floorPlan },
              { label: '構造',     value: r.structure },
              { label: '土地面積', value: r.landArea ? `${r.landArea}㎡` : null },
              { label: '延床面積', value: r.totalFloorArea ? `${r.totalFloorArea}㎡` : null },
              { label: '改装',     value: r.renovation },
              { label: '最寄り駅', value: r.nearestStation },
              { label: '駅徒歩',   value: r.timeToStation ? `${r.timeToStation}分` : null },
              { label: '都市計画', value: r.cityPlanning },
              { label: '建ぺい率', value: r.coverageRatio ? `${r.coverageRatio}%` : null },
              { label: '容積率',   value: r.floorAreaRatio ? `${r.floorAreaRatio}%` : null },
            ].filter(d => d.value);
            return (
              <div key={i} className="border border-gray-100 rounded-lg text-xs overflow-hidden">
                <button
                  onClick={() => setExpandedIdx(isOpen ? null : i)}
                  className="w-full p-2 text-left hover:bg-green-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 font-medium">{r.district}</span>
                    <span className="text-green-500">{isOpen ? '▲' : '詳細 ▼'}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-bold text-gray-800">{r.price.toLocaleString()}万円</span>
                    {r.landArea && <span className="text-gray-700 font-medium">土地{r.landArea}㎡</span>}
                    {r.totalFloorArea && <span className="text-gray-700 font-medium">延床{r.totalFloorArea}㎡</span>}
                  </div>
                  <p className="text-gray-700 font-medium mt-0.5">{r.buildingYear}年築 {formatPeriod(r.period)}</p>
                </button>
                {isOpen && (
                  <div className="px-2 pb-2 pt-1.5 border-t border-gray-100 bg-gray-50 flex flex-col gap-0.5">
                    {details.map(({ label, value }) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-gray-700 font-medium shrink-0 w-16">{label}</span>
                        <span className="text-gray-600 text-right">{value}</span>
                      </div>
                    ))}
                    {r.remarks && (
                      <p className="text-gray-700 font-medium bg-white rounded p-1.5 mt-1 leading-relaxed border border-gray-100">{r.remarks}</p>
                    )}
                    <p className="text-gray-700 font-medium text-right mt-0.5">出典: 国交省 REINFOLIB</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function CondoCard({ txData, loading, defaultCollapsed = false, syncEra = null, syncArea = null }) {
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState(null);

  useEffect(() => { setCollapsed(defaultCollapsed); }, [defaultCollapsed]);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-dashed border-gray-200 flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🏢</span>
          <span className="text-sm font-medium text-gray-700 font-medium">この地域のマンション成約価格（参考）</span>
        </div>
        <span className="text-xs text-blue-400 font-medium">表示する ▼</span>
      </button>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">🏢</span>
          <span className="text-sm font-semibold text-gray-700">この地域のマンション成約価格（参考）</span>
        </div>
        <p className="text-xs text-gray-700 font-medium text-center py-3">読み込み中…</p>
      </div>
    );
  }

  const hasCondo = txData?.condos?.count > 0;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🏢</span>
        <span className="text-sm font-semibold text-gray-700">この地域のマンション成約価格（参考）</span>
      </div>

      {!hasCondo ? (
        <p className="text-xs text-gray-700 font-medium text-center py-1">データなし</p>
      ) : (
        <>
          <CondoPriceSimulator condos={txData.condos} syncEra={syncEra} syncArea={syncArea} />

          {txData?.records?.length > 0 && (
            <>
              <button
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 text-sm text-blue-500 font-medium mt-3 mb-2"
              >
                最近の成約事例{expanded ? '▲' : '▼'}
              </button>
              {expanded && (
                <div className="flex flex-col gap-1.5 mb-2">
                  {txData.records.map((r, i) => {
                    const isOpen = expandedIdx === i;
                    const details = [
                      { label: '構造',     value: r.structure },
                      { label: '改装',     value: r.renovation },
                      { label: '最寄り駅', value: r.nearestStation },
                      { label: '駅徒歩',   value: r.timeToStation ? `${r.timeToStation}分` : null },
                      { label: '都市計画', value: r.cityPlanning },
                      { label: '建ぺい率', value: r.coverageRatio ? `${r.coverageRatio}%` : null },
                      { label: '容積率',   value: r.floorAreaRatio ? `${r.floorAreaRatio}%` : null },
                    ].filter(d => d.value);
                    return (
                      <div key={i} className="border border-gray-100 rounded-lg text-xs overflow-hidden">
                        <button
                          onClick={() => setExpandedIdx(isOpen ? null : i)}
                          className="w-full p-2 text-left hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 font-medium">{r.district}</span>
                            <span className="text-blue-400">{isOpen ? '▲' : '詳細 ▼'}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-bold text-gray-800">{r.price.toLocaleString()}万円</span>
                            <span className="text-gray-700 font-medium">{r.area}㎡</span>
                            <span className="text-blue-600 font-semibold">{r.unitPrice}万/㎡</span>
                          </div>
                          <p className="text-gray-700 font-medium mt-0.5">{r.buildingYear}年築 {r.floorPlan} {formatPeriod(r.period)}</p>
                        </button>
                        {isOpen && (
                          <div className="px-2 pb-2 pt-1.5 border-t border-gray-100 bg-gray-50 flex flex-col gap-0.5">
                            {details.map(({ label, value }) => (
                              <div key={label} className="flex justify-between">
                                <span className="text-gray-700 font-medium shrink-0 w-16">{label}</span>
                                <span className="text-gray-600 text-right">{value}</span>
                              </div>
                            ))}
                            {r.remarks && (
                              <p className="text-gray-700 font-medium bg-white rounded p-1.5 mt-1 leading-relaxed border border-gray-100">{r.remarks}</p>
                            )}
                            <p className="text-gray-700 font-medium text-right mt-0.5">出典: 国交省 REINFOLIB</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
      <p className="text-xs text-gray-700 font-medium mt-2">出典: 国交省REINFOLIB 成約価格情報</p>
    </div>
  );
}

function HouseCard({ txData, loading, defaultCollapsed = false, landAreaProp, adjustmentRate = 0 }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { setCollapsed(defaultCollapsed); }, [defaultCollapsed]);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-dashed border-gray-200 flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🏡</span>
          <span className="text-sm font-medium text-gray-700 font-medium">この地域の戸建ての成約価格（参考）</span>
        </div>
        <span className="text-xs text-green-400 font-medium">表示する ▼</span>
      </button>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">🏡</span>
          <span className="text-sm font-semibold text-gray-700">この地域の戸建ての成約価格（参考）</span>
        </div>
        <p className="text-xs text-gray-700 font-medium text-center py-3">読み込み中…</p>
      </div>
    );
  }

  const hasHouse = txData?.houses?.count > 0;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏡</span>
          <span className="text-sm font-semibold text-gray-700">この地域の戸建ての成約価格（参考）</span>
        </div>
        {txData?.houses?.filtered && (
          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">直近20年以内築</span>
        )}
      </div>

      {!hasHouse ? (
        <p className="text-xs text-gray-700 font-medium text-center py-1">データなし</p>
      ) : (
        <>
          <HousePriceSimulator records={txData.houses.records} landAreaProp={landAreaProp} avgPerSqmAll={txData.houses.avgPerSqm ?? null} totalCount={txData.houses.count} adjustmentRate={adjustmentRate} />

          <div className="bg-green-50 rounded-lg p-2.5 mb-3">
            <p className="text-xs text-gray-700 font-medium mb-0.5">平均成約価格</p>
            <p className="text-base font-bold text-green-700">{txData.houses.avgPrice?.toLocaleString()}万円</p>
            <p className="text-xs text-gray-700 font-medium">{txData.houses.count}件の成約{txData.houses.filtered ? '（直近20年以内築）' : ''}</p>
          </div>

          {txData?.houses?.records?.length > 0 && (
            <HouseRecordList records={txData.houses.records} />
          )}
        </>
      )}
      <p className="text-xs text-gray-700 font-medium mt-2">国交省REINFOLIB 成約価格情報</p>
    </div>
  );
}

function useContainerWidth(fallback = 300) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) setWidth(w); // display:none 時の width=0 は無視
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function LandPriceChart({ data }) {
  const [containerRef, W] = useContainerWidth();
  if (!data || data.length === 0) return <p className="text-xs text-gray-700 font-medium text-center py-2">データなし</p>;

  const H = 72;
  const PAD = { top: 8, bottom: 18, left: 24, right: 24 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const prices = data.map(d => d.avgPrice);
  const maxP = Math.max(...prices);
  const minP = Math.min(...prices);
  const range = maxP - minP || maxP;

  const pts = data.map((d, i) => ({
    x: PAD.left + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
    y: PAD.top + chartH - ((d.avgPrice - minP) / range) * chartH,
    year: d.year,
    price: d.avgPrice,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const isUp = data.length >= 2 && data[data.length - 1].avgPrice >= data[0].avgPrice;
  const lineColor = isUp ? '#3b82f6' : '#ef4444';

  // 最初・中間・最後だけ年ラベルを表示
  const labelIdxs = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]);
  // 最初・最後だけ数値ラベルを表示
  const valueLabelIdxs = new Set([0, data.length - 1]);

  return (
    <div ref={containerRef}>
    <svg width={W} height={H}>
      <line x1={PAD.left} y1={PAD.top + chartH / 2} x2={W - PAD.right} y2={PAD.top + chartH / 2} stroke="#f3f4f6" strokeWidth="1" />
      {data.length > 1 && (
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill={lineColor} />
          {valueLabelIdxs.has(i) && (() => {
            const ly = Math.max(12, p.y - 12);
            const anchor = i === 0 ? 'start' : 'end';
            const label = `${Math.round(p.price / 10000)}万`;
            return (
              <>
                <text x={p.x} y={ly} textAnchor={anchor} fontSize="12" fontWeight="700"
                  stroke="white" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke">
                  {label}
                </text>
                <text x={p.x} y={ly} textAnchor={anchor} fontSize="12" fontWeight="700" fill={lineColor}>
                  {label}
                </text>
              </>
            );
          })()}
          {labelIdxs.has(i) && (
            <text x={p.x} y={H - 2} textAnchor="middle" fontSize="11" fill="#9ca3af">{p.year}</text>
          )}
        </g>
      ))}
    </svg>
    </div>
  );
}

function PriceTrendChart({ pts, lineColor }) {
  const [containerRef, W] = useContainerWidth();
  if (!pts || pts.length === 0) return <p className="text-xs text-gray-700 font-medium text-center py-2">データなし</p>;
  const H = 80;
  const PAD = { top: 8, bottom: 18, left: 24, right: 24 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const prices = pts.map(p => p.value);
  const maxP = Math.max(...prices);
  const minP = Math.min(...prices);
  const range = maxP - minP || maxP || 1;
  const computed = pts.map((p, i) => ({
    x: PAD.left + (pts.length === 1 ? chartW / 2 : (i / (pts.length - 1)) * chartW),
    y: PAD.top + chartH - ((p.value - minP) / range) * chartH,
    year: p.year, value: p.value,
  }));
  const pathD = computed.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const labelIdxs = new Set([0, Math.floor((computed.length - 1) / 2), computed.length - 1]);
  const valueLabelIdxs = new Set([0, computed.length - 1]);
  return (
    <div ref={containerRef}>
    <svg width={W} height={H}>
      <line x1={PAD.left} y1={PAD.top + chartH / 2} x2={W - PAD.right} y2={PAD.top + chartH / 2} stroke="#f3f4f6" strokeWidth="1" />
      {computed.length > 1 && <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
      {computed.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill={lineColor} />
          {valueLabelIdxs.has(i) && (() => {
            const ly = Math.max(12, p.y - 10);
            const anchor = i === 0 ? 'start' : 'end';
            const label = `${p.value}万`;
            return (
              <>
                <text x={p.x} y={ly} textAnchor={anchor} fontSize="12" fontWeight="700" stroke="white" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke">{label}</text>
                <text x={p.x} y={ly} textAnchor={anchor} fontSize="12" fontWeight="700" fill={lineColor}>{label}</text>
              </>
            );
          })()}
          {labelIdxs.has(i) && <text x={p.x} y={H - 2} textAnchor="middle" fontSize="11" fill="#9ca3af">{p.year}</text>}
        </g>
      ))}
    </svg>
    </div>
  );
}

function PriceTrendCard({ trendData, loading, propertyType }) {
  if (loading) return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <p className="text-sm text-gray-700 font-medium">読み込み中…</p>
    </div>
  );
  if (!trendData) return null;

  const years = Object.keys(trendData).map(Number).sort();
  const condoPts = years
    .map(y => ({ year: y, value: trendData[y]?.condoAvgUnitPrice }))
    .filter(p => p.value != null);
  const housePts = years
    .map(y => ({ year: y, value: trendData[y]?.houseAvgPrice }))
    .filter(p => p.value != null);

  const pts = propertyType === 'house' ? housePts : condoPts;
  const unit = propertyType === 'house' ? '成約価格' : '㎡単価';
  const unitSuffix = propertyType === 'house' ? '万円' : '万円/㎡';

  // 全期間変化率（最初→最後）
  const overallPct = pts.length >= 2
    ? Math.round(((pts[pts.length - 1].value - pts[0].value) / pts[0].value) * 100)
    : null;

  // 直近変化率（最後の2点）
  const recentPct = pts.length >= 2
    ? Math.round(((pts[pts.length - 1].value - pts[pts.length - 2].value) / pts[pts.length - 2].value) * 100)
    : null;

  // ピーク分析
  const peakValue = pts.length > 0 ? Math.max(...pts.map(p => p.value)) : 0;
  const peakIdx   = pts.findIndex(p => p.value === peakValue);
  const fromPeakPct = peakValue > 0
    ? Math.round(((pts[pts.length - 1].value - peakValue) / peakValue) * 100)
    : 0;
  // ピークが途中にあり、そこから3%以上下落している
  const hasPeakedAndDeclined = pts.length >= 3 && peakIdx > 0 && peakIdx < pts.length - 1 && fromPeakPct <= -3;

  // トレンドパターン判定
  const trendPattern = (() => {
    if (overallPct === null) return 'unknown';
    if (hasPeakedAndDeclined)                          return 'peaked';   // ピーク後下落
    if (overallPct >= 3 && recentPct >= 0)             return 'rising';   // 継続上昇
    if (overallPct < -3 && recentPct >= 3)             return 'recovering'; // 下落から回復
    if (overallPct < -3)                               return 'falling';  // 下落傾向
    if (overallPct >= 3 && recentPct < -3)             return 'peaked';   // 全体は上だが直近下落
    if (Math.abs(overallPct) <= 3 && Math.abs(recentPct ?? 0) <= 3) return 'stable'; // 横ばい
    return overallPct >= 0 ? 'slight_up' : 'slight_down';
  })();

  const PATTERN_STYLE = {
    rising:     { color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-100',   line: '#3b82f6', label: '継続上昇',       text: 'このエリアの成約価格は継続的に上昇しています。資産価値が維持・上昇している可能性が高いです。' },
    peaked:     { color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-100', line: '#f59e0b', label: 'ピーク後・下落局面', text: '価格は一時期上昇しましたが、最近は下落に転じています。市況の変化が起きている可能性があります。購入価格の妥当性を慎重に確認してください。' },
    falling:    { color: 'text-red-700',    bg: 'bg-red-50 border-red-100',     line: '#ef4444', label: '下落傾向',        text: 'このエリアの成約価格は下落傾向にあります。購入価格の妥当性を慎重に検討してください。' },
    recovering: { color: 'text-green-700',  bg: 'bg-green-50 border-green-100', line: '#22c55e', label: '回復傾向',         text: '一時的に価格が下落しましたが、直近では回復傾向にあります。今後の推移も引き続き確認することをおすすめします。' },
    stable:     { color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200',   line: '#6b7280', label: '横ばい',          text: '成約価格はほぼ横ばいで推移しています。急激な変動はなく安定していますが、周辺の人口動態・開発計画もあわせて確認するとよいでしょう。' },
    slight_up:  { color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-100',   line: '#3b82f6', label: '緩やかな上昇',    text: 'このエリアの成約価格はやや上昇傾向にあります。' },
    slight_down:{ color: 'text-red-600',    bg: 'bg-red-50 border-red-100',     line: '#ef4444', label: '緩やかな下落',    text: 'このエリアの成約価格はやや下落傾向にあります。購入価格の妥当性を確認してください。' },
    unknown:    { color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200',   line: '#9ca3af', label: '',              text: '' },
  };
  const style = PATTERN_STYLE[trendPattern];

  const trendScore = overallPct == null ? null : calcTrendScore(trendData, propertyType);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xl">📉</span>
          <span className="text-sm font-semibold text-gray-700">中古成約価格のトレンド</span>
        </div>
        {trendScore != null && <Stars score={trendScore} />}
      </div>
      <p className="text-xs text-gray-700 font-medium mb-2">
        {propertyType === 'house' ? '宅地（土地＋建物）' : '中古マンション'} {unit}（{unitSuffix}）の推移
      </p>
      {pts.length === 0 ? (
        <p className="text-xs text-gray-700 font-medium">このエリアの成約データが不足しています</p>
      ) : (
        <>
          <PriceTrendChart pts={pts} lineColor={style.line} />
          {overallPct !== null && style.label && (
            <div className={`mt-2 rounded-lg px-3 py-2 border text-xs ${style.bg}`}>
              <p className={`font-semibold ${style.color}`}>
                {pts[0].year}→{pts[pts.length - 1].year}：{overallPct > 0 ? `+${overallPct}%` : `${overallPct}%`}
                {hasPeakedAndDeclined && <span className="ml-1 font-normal text-amber-600">（直近{Math.abs(recentPct ?? 0)}%下落）</span>}
                　{style.label}
              </p>
              <p className="text-gray-600 mt-0.5 leading-relaxed">{style.text}</p>
            </div>
          )}
        </>
      )}
      <p className="text-xs text-gray-700 font-medium mt-2">出典: 国交省 不動産情報ライブラリ（3件未満の年は除外）</p>
    </div>
  );
}

function getLandPriceDiagnosis(trend) {
  if (trend === null || trend === undefined) return null;
  if (trend >= 10) return {
    icon: '📈',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-100',
    title: '地価が大きく上昇中',
    text: `直近5年で${trend}%上昇しています。再開発や交通利便性の向上などが背景にあることが多く、エリアの需要が高まっているサインです。購入後も資産価値が維持・上昇しやすいと考えられます。`,
  };
  if (trend >= 3) return {
    icon: '📈',
    color: 'text-green-700',
    bg: 'bg-green-50 border-green-100',
    title: '地価が緩やかに上昇',
    text: `直近5年で${trend}%上昇しています。安定した需要があるエリアです。急騰はないものの大幅な下落リスクは低く、長期保有にも向いています。`,
  };
  if (trend >= -2) return {
    icon: '➡️',
    color: 'text-gray-600',
    bg: 'bg-gray-50 border-gray-200',
    title: '地価はほぼ横ばい',
    text: `直近5年でほぼ横ばい（${trend >= 0 ? '+' : ''}${trend}%）です。急激な変動はなく安定していますが、今後の人口動態や周辺の開発計画もあわせて確認するとよいでしょう。`,
  };
  if (trend >= -10) return {
    icon: '⚠️',
    color: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
    title: '地価がやや下落傾向',
    text: `直近5年で${Math.abs(trend)}%下落しています。購入後に資産価値がさらに下落するリスクがあります。駅距離・人口動向・再開発計画などを確認しながら、購入価格の妥当性を慎重に検討してください。`,
  };
  return {
    icon: '⚠️',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    title: '地価が大きく下落中',
    text: `直近5年で${Math.abs(trend)}%下落しています。地価の下落が継続しているエリアです。自己居住目的なら購入価格次第ですが、資産形成目的では特に慎重な検討が必要です。`,
  };
}

function LandPriceCard({ data, loading, muniCode }) {
  const prefCode = muniCode?.slice(0, 2);
  const chikamapUrl = `https://www.chikamap.jp/chikamap/Portal?cd=${prefCode}`;

  const latestPrice = data?.latestPrice;
  const latestManEn = latestPrice ? Math.round(latestPrice / 10000) : null;
  const latestRosenka = data?.latestRosenka;
  const rosenkaManEn = latestRosenka ? Math.round(latestRosenka / 10000) : null;
  const estimatedRosenka = latestPrice ? Math.round(latestPrice * 0.8 / 10000) : null;
  const trend = data?.trend;
  const isUp = trend !== null && trend >= 0;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏡</span>
          <span className="text-sm font-semibold text-gray-700">公示地価・路線価</span>
        </div>
        {!loading && <Stars score={calcLandPriceScore(trend)} />}
      </div>

      {loading ? (
        <p className="text-xs text-gray-700 font-medium text-center py-3">読み込み中…</p>
      ) : !data?.years?.length ? (
        <p className="text-xs text-gray-700 font-medium text-center py-3">データなし</p>
      ) : (
        <>
          <LandPriceChart data={data.years} />

          {latestManEn && (
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-700 font-medium">公示地価（住宅地・㎡単価）</span>
                <span className="font-bold text-gray-800">{latestManEn}万円</span>
              </div>
              {rosenkaManEn ? (
                <div className="flex justify-between items-center text-xs bg-amber-50 rounded-lg px-2 py-1.5">
                  <span className="text-amber-700">相続税路線価（実値・㎡単価）</span>
                  <span className="font-bold text-amber-800">{rosenkaManEn}万円</span>
                </div>
              ) : estimatedRosenka ? (
                <div className="flex justify-between items-center text-xs bg-amber-50 rounded-lg px-2 py-1.5">
                  <span className="text-amber-700">路線価の目安（公示地価×0.8）</span>
                  <span className="font-bold text-amber-800">約 {estimatedRosenka}万円</span>
                </div>
              ) : null}
            </div>
          )}

          {(() => {
            const diag = getLandPriceDiagnosis(trend);
            if (!diag) return null;
            return (
              <div className={`mt-3 rounded-lg px-3 py-2.5 border text-xs ${diag.bg}`}>
                <p className={`font-bold mb-1 ${diag.color}`}>{diag.icon} {diag.title}</p>
                <p className={`leading-relaxed ${diag.color} opacity-90`}>{diag.text}</p>
              </div>
            );
          })()}

          <a
            href={chikamapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium"
          >
            詳細な路線価は 全国地価マップ で確認 →
          </a>
          <p className="text-xs text-gray-700 font-medium mt-1.5">出典: 国交省REINFOLIB 地価公示（直近5年・住宅地平均）</p>
        </>
      )}
    </div>
  );
}

const USEFUL_LIFE = { '木造': 22, '軽量鉄骨': 19, '重量鉄骨': 34, 'RC（鉄筋コンクリート）': 47 };

function CondoFutureCard({ condos, price }) {
  const currentUP    = condos?.avgUnitPrice  ?? null;
  const hist         = condos?.historical10y ?? null;
  const historicalUP = hist?.avgUnitPrice    ?? null;
  const histCount    = hist?.count           ?? 0;
  const currentCount = condos?.count         ?? 0;

  if (!currentUP || !historicalUP) return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">📊</span>
        <span className="text-sm font-semibold text-gray-700">マンションの将来売却価格の目安</span>
      </div>
      <p className="text-xs text-gray-700 font-medium">このエリアの5年前（2019-2021年）の成約データが不足しているため試算できません。</p>
    </div>
  );

  // 5年間の変化率 → 年率換算
  const rate5y     = currentUP / historicalUP;          // 5年間の倍率
  const pct5y      = Math.round((rate5y - 1) * 100);
  const annualRate = Math.pow(rate5y, 1 / 5) - 1;       // 年率
  const future5y   = price ? Math.round(price * rate5y) : null;
  const future10y  = price ? Math.round(price * Math.pow(1 + annualRate, 10)) : null;
  const isLow      = histCount < 5 || currentCount < 5;

  const rateColor = pct5y >= 15 ? 'text-blue-700 bg-blue-50 border-blue-100'
    : pct5y >= 0   ? 'text-green-700 bg-green-50 border-green-100'
    : 'text-red-700 bg-red-50 border-red-100';

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📊</span>
        <span className="text-sm font-semibold text-gray-700">マンションの将来売却価格の目安</span>
      </div>

      {isLow && (
        <div className="mb-3 rounded-lg px-3 py-2 bg-amber-50 border border-amber-200 text-xs text-amber-700">
          ⚠️ データ件数が少ないため（5年前: {histCount}件 / 直近: {currentCount}件）、精度は低くなります。
        </div>
      )}

      <p className="text-xs font-bold text-gray-700 mb-1.5">過去5年のエリア㎡単価の変化</p>
      <div className="flex flex-col gap-1.5 text-xs mb-3">
        <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
          <span className="text-gray-700 font-medium">5年前の㎡単価（{hist.years}年平均・{histCount}件）</span>
          <span className="font-bold text-gray-600 shrink-0 ml-2">{historicalUP.toLocaleString()}万円/㎡</span>
        </div>
        <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
          <span className="text-gray-700 font-medium">現在の㎡単価（直近3年平均・{currentCount}件）</span>
          <span className="font-bold text-gray-600 shrink-0 ml-2">{currentUP.toLocaleString()}万円/㎡</span>
        </div>
        <div className={`flex justify-between items-center px-2 py-1.5 rounded-lg border ${rateColor}`}>
          <span className="font-bold">5年間の変化率 / 年率</span>
          <span className="font-bold text-sm shrink-0 ml-2">
            {pct5y >= 0 ? '+' : ''}{pct5y}% ／ 年{(annualRate * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {future5y != null ? (
        <>
          <div className="border-t border-gray-100 my-2" />
          <p className="text-xs font-bold text-gray-700 mb-1.5">入力価格ベースの将来試算</p>
          <div className="flex flex-col gap-1.5 text-xs mb-3">
            <div className="flex justify-between items-center bg-indigo-50 rounded-lg px-2 py-1.5 border border-indigo-100">
              <span className="text-indigo-700 font-bold">5年後の売却価格の目安</span>
              <span className="font-bold text-indigo-800 text-sm shrink-0 ml-2">約{future5y.toLocaleString()}万円</span>
            </div>
            <div className="flex justify-between items-center bg-purple-50 rounded-lg px-2 py-1.5 border border-purple-100">
              <span className="text-purple-700 font-bold">10年後の売却価格の目安</span>
              <span className="font-bold text-purple-800 text-sm shrink-0 ml-2">約{future10y.toLocaleString()}万円</span>
            </div>
            <p className="text-xs text-gray-700 font-medium px-1">10年後は過去5年の年率（{(annualRate * 100).toFixed(1)}%）を複利で延長した試算。</p>
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-700 font-medium px-1 mb-2">物件価格を入力すると将来の目安価格を試算します。</p>
      )}

      <p className="text-xs text-gray-700 font-medium leading-relaxed">
        ※ 過去5年のエリア㎡単価の変化率を将来に延長した試算です。金利・人口動向・建物老朽化・マンション固有の管理状態は反映されません。将来の売却価格を保証するものではありません。
      </p>
      <p className="text-xs text-gray-700 font-medium mt-1">出典: 国交省REINFOLIB 不動産取引価格情報</p>
    </div>
  );
}

function LandValueCard({ landPriceData, landArea, price, landPriceInput, buildingPriceInput, structure, builtYear }) {
  const latestPrice       = landPriceData?.latestPrice;
  const hasInputBreakdown = landPriceInput > 0;

  // ── 土地資産価値 ──────────────────────────────────
  const kojiValue  = latestPrice && landArea ? Math.round(latestPrice * landArea / 10000) : null;
  const jisseiLow  = kojiValue ? Math.round(kojiValue * 1.1) : null;
  const jisseiHigh = kojiValue ? Math.round(kojiValue * 1.3) : null;

  // ── 10年後の土地価値 ──────────────────────────────
  const trend5y = landPriceData?.trend ?? null; // 過去5年の公示地価変化率(%)
  // 基準価格: 入力値 > 実勢推計中央値(公示地価×1.2) の順で採用
  const landBase = landPriceInput > 0 ? landPriceInput
    : kojiValue != null ? Math.round(kojiValue * 1.2)
    : null;
  const landBaseLabel = landPriceInput > 0 ? '入力した土地価格' : '実勢推計（公示地価×1.2）';
  // 過去5年の年率トレンドを10年後に複利延長
  const annualRate = trend5y != null ? trend5y / 5 / 100 : 0;
  const landValue10y = landBase != null
    ? Math.round(landBase * Math.pow(1 + annualRate, 10))
    : null;

  if (!hasInputBreakdown && !kojiValue) return null;

  const comparison = hasInputBreakdown && kojiValue ? (() => {
    const r = landPriceInput / kojiValue;
    if (r < 1.0)  return { label: '公示地価を下回る水準',     sub: '立地・形状などに課題がある可能性。または特に割安な物件。',                    cls: 'text-blue-700 bg-blue-50 border-blue-200' };
    if (r < 1.1)  return { label: '実勢目安よりやや割安',     sub: '公示地価は超えており、まずまずの水準です。',                                   cls: 'text-green-700 bg-green-50 border-green-200' };
    if (r <= 1.3) return { label: '実勢価格の目安の範囲内 ✓', sub: `公示地価の${Math.round(r * 10) / 10}倍。一般的な市場水準です。`,               cls: 'text-green-700 bg-green-50 border-green-200' };
    if (r <= 1.5) return { label: '実勢目安よりやや高め',     sub: `公示地価の${Math.round(r * 10) / 10}倍。人気エリアでは許容範囲内のこともあります。`, cls: 'text-amber-700 bg-amber-50 border-amber-200' };
    return           { label: '実勢目安を大きく上回る',       sub: `公示地価の${Math.round(r * 10) / 10}倍。価格交渉の余地を確認しましょう。`,       cls: 'text-red-700 bg-red-50 border-red-200' };
  })() : null;

  // ── 建物の10年後価値 ──────────────────────────────
  const usefulLife    = structure ? (USEFUL_LIFE[structure] ?? null) : null;
  const age           = builtYear ? new Date().getFullYear() - parseInt(builtYear) : null;
  const remainingLife = usefulLife != null && age != null ? usefulLife - age : null;
  // 建物価格: 内訳入力値 → 物件価格-土地入力値 → 物件価格-公示地価推計 の順で採用
  const buildingBase = buildingPriceInput > 0 ? buildingPriceInput
    : hasInputBreakdown && price > 0 ? price - landPriceInput
    : kojiValue && price > 0 ? price - kojiValue
    : null;
  const buildingBaseLabel = buildingPriceInput > 0 ? '建物価格（入力値）'
    : hasInputBreakdown ? '物件価格 − 土地入力値'
    : kojiValue ? '物件価格 − 公示地価推計'
    : null;
  // 10年後の建物価値: 購入価格 × (残り耐用年数-10) / 残り耐用年数
  const value10y = buildingBase != null && remainingLife != null && remainingLife > 0
    ? Math.max(0, Math.round(buildingBase * (remainingLife - 10) / remainingLife))
    : null;
  const depreciation10y = buildingBase != null && value10y != null
    ? buildingBase - value10y : null;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🏷</span>
        <span className="text-sm font-semibold text-gray-700">土地・建物の資産価値試算</span>
      </div>

      {/* ── 土地 ─────────────────────────────── */}
      <p className="text-xs font-bold text-gray-700 font-medium mb-1.5">🌏 土地の価値</p>
      <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2 border border-gray-100 text-xs text-gray-700 font-medium leading-relaxed">
        <span className="font-medium text-gray-600">公示地価とは？</span>　国が毎年公表する参考値（税・補償の基準）。実際の取引価格（実勢価格）より低く、<span className="font-medium text-gray-700">実勢価格は公示地価の1.1〜1.3倍程度</span>が目安です（都市部ではさらに高い場合があります）。
      </div>
      <div className="flex flex-col gap-1.5 text-xs mb-4">
        {kojiValue && (
          <div className="flex justify-between items-center px-2 py-1.5 border border-gray-100 rounded-lg">
            <span className="text-gray-400">公示地価ベース〈参考下限〉<br />{Math.round(latestPrice / 10000)}万円/㎡ × {landArea}㎡</span>
            <span className="font-bold text-gray-700 font-medium text-sm shrink-0 ml-2">{kojiValue.toLocaleString()}万円</span>
          </div>
        )}
        {jisseiLow && jisseiHigh && (
          <div className="flex justify-between items-center bg-blue-50 rounded-lg px-2 py-1.5 border border-blue-100">
            <span className="text-blue-700">実勢価格の目安（×1.1〜1.3）</span>
            <span className="font-bold text-blue-800 text-sm shrink-0 ml-2">{jisseiLow.toLocaleString()}〜{jisseiHigh.toLocaleString()}万円</span>
          </div>
        )}
        {hasInputBreakdown && (
          <>
            <div className="flex justify-between items-center bg-indigo-50 rounded-lg px-2 py-1.5 border border-indigo-100">
              <span className="text-indigo-700">入力した土地価格</span>
              <span className="font-bold text-indigo-800 text-sm">{landPriceInput.toLocaleString()}万円</span>
            </div>
            {comparison && (
              <div className={`rounded-lg px-2 py-2 border ${comparison.cls}`}>
                <p className="font-bold mb-0.5">{comparison.label}</p>
                <p className="opacity-80">{comparison.sub}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 建物 ─────────────────────────────── */}
      {usefulLife && age != null && (
        <>
          <p className="text-xs font-bold text-gray-700 font-medium mb-1.5">🏠 建物の10年後価値</p>
          <div className="flex flex-col gap-1.5 text-xs mb-3">
            <div className="flex gap-3 flex-wrap px-2 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-gray-700 font-medium">構造: <span className="font-medium text-gray-700">{structure}</span></span>
              <span className="text-gray-700 font-medium">法定耐用年数: <span className="font-medium text-gray-700">{usefulLife}年</span></span>
              <span className="text-gray-700 font-medium">築: <span className="font-medium text-gray-700">{age}年</span></span>
              <span className="text-gray-700 font-medium">残り: <span className={`font-medium ${remainingLife <= 10 ? 'text-red-600' : 'text-gray-700'}`}>{remainingLife != null ? `${Math.max(0, remainingLife)}年` : '—'}</span></span>
            </div>

            {remainingLife != null && remainingLife <= 0 ? (
              <div className="rounded-lg px-2 py-2 border bg-red-50 border-red-200 text-red-700">
                <p className="font-bold mb-0.5">法定耐用年数を超過</p>
                <p className="opacity-80">融資評価上の建物価値はゼロとして扱われます。住宅ローン審査や売却価格に影響します。</p>
              </div>
            ) : remainingLife != null && remainingLife <= 10 ? (
              <div className="rounded-lg px-2 py-2 border bg-amber-50 border-amber-200 text-amber-700">
                <p className="font-bold mb-0.5">10年以内に法定耐用年数に達します</p>
                <p className="opacity-80">あと{remainingLife}年で融資評価上の建物価値はゼロになります。売却・住み替えのタイミングに注意が必要です。</p>
              </div>
            ) : buildingBase != null ? (
              <>
                <div className="px-2 py-1.5 border border-gray-100 rounded-lg">
                  <p className="text-xs text-gray-700 font-medium mb-0.5">10年間の減価（{buildingBaseLabel}）</p>
                  <p className="text-sm font-medium text-gray-600">
                    {buildingBase.toLocaleString()}万円 ÷ {remainingLife}年 × 10年
                    <span className="ml-1 font-bold text-gray-700">＝ {depreciation10y?.toLocaleString()}万円</span>
                  </p>
                </div>
                <div className="flex justify-between items-center bg-orange-50 rounded-lg px-2 py-1.5 border border-orange-100">
                  <span className="text-orange-700">10年後の建物価値（目安）</span>
                  <span className="font-bold text-orange-800 text-sm shrink-0 ml-2">約{value10y?.toLocaleString()}万円</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-400 px-1">建物価格を入力すると10年後の価値を試算します（「土地・建物を分けて入力」から）</p>
            )}
          </div>
        </>
      )}

      {/* ── 10年後の売却価格試算 ─────────────────────── */}
      {landValue10y != null && (
        <>
          <div className="border-t border-gray-100 my-2" />
          <p className="text-xs font-bold text-gray-700 font-medium mb-1.5">📊 10年後の売却価格の目安</p>
          <div className="flex flex-col gap-1.5 text-xs mb-3">
            <div className="flex justify-between items-center px-2 py-1.5 border border-gray-100 rounded-lg">
              <span className="text-gray-400">
                土地（{landBaseLabel}）
                {trend5y != null && (
                  <span className="ml-1">
                    過去5年{trend5y >= 0 ? '+' : ''}{trend5y}%を年率延長
                  </span>
                )}
              </span>
              <span className="font-bold text-gray-600 text-sm shrink-0 ml-2">約{landValue10y.toLocaleString()}万円</span>
            </div>
            {value10y != null && (
              <div className="flex justify-between items-center px-2 py-1.5 border border-gray-100 rounded-lg">
                <span className="text-gray-400">建物（残存価値）</span>
                <span className="font-bold text-gray-600 text-sm shrink-0 ml-2">約{value10y.toLocaleString()}万円</span>
              </div>
            )}
            <div className="flex justify-between items-center bg-purple-50 rounded-lg px-2 py-1.5 border border-purple-100">
              <span className="text-purple-700 font-bold">
                {value10y != null ? '土地＋建物の合計（目安）' : '土地のみの目安'}
              </span>
              <span className="font-bold text-purple-800 text-sm shrink-0 ml-2">
                約{(value10y != null ? landValue10y + value10y : landValue10y).toLocaleString()}万円
              </span>
            </div>
            {value10y == null && (
              <p className="text-gray-400 px-1">建物価格と築年を入力すると建物残存価値も合算されます</p>
            )}
            <p className="text-gray-400 px-1 leading-relaxed">
              ※ 土地は過去5年の公示地価トレンドを単純延長した試算。将来の地価は保証されません。
            </p>
          </div>
        </>
      )}

      <p className="text-xs text-gray-400">出典: 国交省REINFOLIB 地価公示（直近値） ／ 建物残存価値は法定耐用年数による定額法の目安。市場価値とは異なる場合があります</p>
    </div>
  );
}

function PopulationChart({ data, muniName, loading }) {
  const [containerRef, W] = useContainerWidth();

  if (loading) {
    return <p className="text-xs text-gray-700 font-medium text-center py-3">読み込み中…</p>;
  }
  if (!data || data.length === 0) {
    return <p className="text-xs text-gray-700 font-medium text-center py-3">データなし</p>;
  }

  const H = 72;
  const PAD = { top: 8, bottom: 18, left: 24, right: 24 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const popValues = data.map(d => d.population);
  const maxP = Math.max(...popValues);
  const minP = Math.min(...popValues);
  const range = maxP - minP || maxP;

  const pts = data.map((d, i) => ({
    x: PAD.left + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
    y: PAD.top + chartH - ((d.population - minP) / range) * chartH,
    year: d.year,
    pop: d.population,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const trend = data.length >= 2
    ? ((data[data.length - 1].population - data[0].population) / data[0].population * 100).toFixed(1)
    : null;
  const isUp = trend !== null && parseFloat(trend) >= 0;
  const lineColor = isUp ? '#3b82f6' : '#ef4444';

  const valueLabelIdxs = new Set([0, data.length - 1]);
  const fmtPop = (v) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toLocaleString();

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-700 font-medium">{muniName}の人口推移</p>
        {trend !== null && (
          <p className={`text-xs font-bold ${isUp ? 'text-blue-500' : 'text-red-500'}`}>
            {isUp ? '▲' : '▼'} {Math.abs(trend)}%
            <span className="text-gray-700 font-medium font-normal"> ({data[0].year}→{data[data.length - 1].year})</span>
          </p>
        )}
      </div>
      <div ref={containerRef} style={{ width: '100%' }}>
        <svg width={W} height={H}>
          <line
            x1={PAD.left} y1={PAD.top + chartH / 2}
            x2={W - PAD.right} y2={PAD.top + chartH / 2}
            stroke="#f3f4f6" strokeWidth="1"
          />
          {data.length > 1 && (
            <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round" />
          )}
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="3.5" fill={lineColor} />
              {valueLabelIdxs.has(i) && (() => {
                const ly = Math.max(12, p.y - 12);
                const anchor = i === 0 ? 'start' : 'end';
                const label = fmtPop(p.pop);
                return (
                  <>
                    <text x={p.x} y={ly} textAnchor={anchor} fontSize="12" fontWeight="700"
                      stroke="white" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke">
                      {label}
                    </text>
                    <text x={p.x} y={ly} textAnchor={anchor} fontSize="12" fontWeight="700" fill={lineColor}>
                      {label}
                    </text>
                  </>
                );
              })()}
              <text x={p.x} y={H - 2} textAnchor="middle" fontSize="11" fill="#9ca3af">{p.year}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function getPopDiagnosis(popData) {
  if (!popData?.data || popData.data.length < 2) return null;
  const first = popData.data[0];
  const last  = popData.data[popData.data.length - 1];
  const pct   = parseFloat(((last.population - first.population) / first.population * 100).toFixed(1));
  if (pct > 10) return {
    icon: '📈', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100',
    title: `人口が大きく増加（${first.year}→${last.year}で+${pct}%）`,
    text: '人口流入が続くエリアです。住宅需要が高く、地価・マンション価格の下支えになりやすいため、資産価値が維持されやすい傾向があります。',
  };
  if (pct > 3) return {
    icon: '📈', color: 'text-green-700', bg: 'bg-green-50 border-green-100',
    title: `人口が緩やかに増加（+${pct}%）`,
    text: '安定した住宅需要があるエリアです。大幅な人口流出リスクは低く、長期的な資産価値の維持が期待できます。',
  };
  if (pct > -3) return {
    icon: '➡️', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200',
    title: `人口はほぼ横ばい（${pct >= 0 ? '+' : ''}${pct}%）`,
    text: '大きな人口変動はなく安定しています。今後は近隣の開発動向や少子高齢化の影響も注視するとよいでしょう。',
  };
  if (pct > -10) return {
    icon: '⚠️', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200',
    title: `人口がやや減少（${pct}%）`,
    text: '人口流出が続いており、住宅需要が弱まりつつあります。将来の売却時に買い手が付きにくくなるリスクも考慮し、購入価格の妥当性を慎重に検討してください。',
  };
  return {
    icon: '⚠️', color: 'text-red-700', bg: 'bg-red-50 border-red-200',
    title: `人口が大幅に減少（${pct}%）`,
    text: '急速な人口減少が進むエリアです。空き家増加・地価下落のリスクが高く、自己居住目的以外での購入には特に慎重な検討が必要です。',
  };
}

function PopulationScoreCard({ popData, loading }) {
  const diag = !loading ? getPopDiagnosis(popData) : null;
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">👥</span>
          <span className="text-sm font-semibold text-gray-700">人口動向</span>
        </div>
        <Stars score={calcPopScore(popData)} />
      </div>
      <PopulationChart
        data={popData?.data}
        muniName={popData?.muniName}
        loading={loading}
      />
      {diag && (
        <div className={`mt-3 rounded-lg px-3 py-2.5 border text-xs ${diag.bg}`}>
          <p className={`font-bold mb-1 ${diag.color}`}>{diag.icon} {diag.title}</p>
          <p className={`leading-relaxed ${diag.color} opacity-90`}>{diag.text}</p>
        </div>
      )}
    </div>
  );
}

function getConvHint(mapLayer, convData) {
  if (!convData) return null;
  const walkMin = convData.nearestStationM ? Math.round(convData.nearestStationM * 1.3 / 80) : null;
  switch (mapLayer) {
    case 'station': {
      const nearby = convData.stations?.length ? convData.stations : (convData.nearestStation && walkMin != null ? [{ name: convData.nearestStation, walkMin }] : []);
      if (!nearby.length) return null;
      const best = nearby[0].walkMin;
      const lines = nearby.map(s => {
        const label = operatorLabel(s.operator);
        return `${s.name}${label ? `（${label}）` : ''} 徒歩${s.walkMin}分`;
      }).join(' / ');
      return {
        mark: best <= 10 ? '◎' : best <= 15 ? '○' : '△',
        text: lines,
        good: best <= 15,
      };
    }
    case 'busstop':
      if (convData.busStops == null) return null;
      return {
        mark: convData.busStops >= 5 ? '◎' : convData.busStops >= 1 ? '○' : '✕',
        text: `バス停 200m圏${convData.busStops200 ?? 0}件 / 500m圏${convData.busStops}件`,
        good: convData.busStops >= 1,
      };
    case 'supermarket':
      if (convData.supermarkets == null) return null;
      return {
        mark: convData.supermarkets >= 3 ? '◎' : convData.supermarkets >= 1 ? '○' : '✕',
        text: `スーパー ${convData.supermarkets500}件（500m圏） / ${convData.supermarkets}件（1km圏）`,
        good: convData.supermarkets >= 1,
      };
    case 'medical':
      if (convData.hospitals == null) return null;
      return {
        mark: convData.hospitals >= 5 ? '◎' : convData.hospitals >= 2 ? '○' : convData.hospitals >= 1 ? '△' : '✕',
        text: `病院・クリニック ${convData.hospitals500 ?? 0}件（500m圏） / ${convData.hospitals}件（1km圏）`,
        good: convData.hospitals >= 1,
      };
    case 'kindergarten':
      if (convData.kindergartens == null) return null;
      return {
        mark: convData.kindergartens >= 3 ? '◎' : convData.kindergartens >= 1 ? '○' : '✕',
        text: `保育園・幼稚園 ${convData.kindergartens500 ?? 0}件（500m圏） / ${convData.kindergartens}件（1km圏）`,
        good: convData.kindergartens >= 1,
      };
    case 'school':
      if (convData.schools == null) return null;
      return {
        mark: convData.schools >= 2 ? '◎' : convData.schools >= 1 ? '○' : '✕',
        text: `小中学校${convData.schools}件（1.5km圏）`,
        good: convData.schools >= 1,
      };
    default:
      return null;
  }
}

function getChecklistUrl(linkType, name, buildingAddress) {
  const stripped = buildingAddress
    ? buildingAddress.replace(/^.+?[都道府県]/, '').replace(/[0-9０-９一二三四五六七八九十百千]+丁目.*/, '')
    : '';
  const kw = name || '';
  const kwAddr = stripped ? `${kw} ${stripped}` : kw;
  if (linkType === 'homes')     return `https://www.homes.co.jp/archive/list/search/?keyword=${encodeURIComponent(kw)}`;

  if (linkType === 'mogecheck')   return 'https://mogecheck.jp/';
  if (linkType === 'sakura')      return 'https://www.sakurajimusyo.com/inspect/';
  if (linkType === 'kazukuri')    return 'https://px.a8.net/svt/ejp?a8mat=4B3IIK+FG2VSI+5OGA+5YRHE';
  if (linkType === 'kufuieta')      return 'https://px.a8.net/svt/ejp?a8mat=4B3IIL+S2+5NVG+5YJRM';
  if (linkType === 'solarpartners') return 'https://px.a8.net/svt/ejp?a8mat=4B3NYV+5SZ642+3LME+656YP';
  if (linkType === 'nurikae')     return 'https://px.a8.net/svt/ejp?a8mat=4B3IIL+LGDU+410U+5YJRM';
  if (linkType === 'reform_pro')  return 'https://px.a8.net/svt/ejp?a8mat=4B3IIL+1SBLE+46CI+5YRHE';
  if (linkType === 'takara')      return 'https://px.a8.net/svt/ejp?a8mat=4B3IIL+16VZM+4S2Q+60H7L';
  if (linkType === 'insuweb')     return 'https://px.a8.net/svt/ejp?a8mat=4B3IIK+FFHG6Q+2PS+2BFWFM';
  if (linkType === 'takuhai')     return 'https://px.a8.net/svt/ejp?a8mat=4B3NYV+679KMQ+5TXI+5Z6WX';
  if (linkType === 'nomcom')      return 'https://px.a8.net/svt/ejp?a8mat=4B3NYW+N7XDE+5M76+BXB8X';
  if (linkType === 'gmohikari')   return 'https://px.a8.net/svt/ejp?a8mat=4B3NYW+NTCZ6+50+6MDJ6P';
  if (linkType === 'nurokari')    return 'https://px.a8.net/svt/ejp?a8mat=4B3NYW+YJ5V6+2VMU+5YJRM';
  if (linkType === 'renoveru')    return 'https://px.a8.net/svt/ejp?a8mat=4B3NYW+XCANM+303O+5YJRM';
  return null;
}

const CHECKLIST = [
  {
    category: '建物・権利',
    icon: '🏡',
    tag: '戸建て向け',
    items: [
      { id: 'boundary',    label: '土地の境界が確定している',            note: '未確定なら売主負担での確定を交渉' },
      { id: 'private_road',label: '私道負担・通行権を確認した',          note: '私道に面する場合は持分・掘削権に注意' },
      { id: 'floor_area',  label: '建ぺい率・容積率を確認した',          note: '将来の増改築の可能性に影響する' },
      { id: 'inspection',  label: 'インスペクション（建物診断）を依頼した', note: '専門家による建物状況調査。特に中古戸建ては必須。さくら事務所が業界最大手', linkType: 'sakura', linkLabel: 'さくら事務所', linkCls: 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100' },
    ],
  },
  {
    category: 'マンション管理',
    icon: '🏗️',
    tag: 'マンション向け',
    items: [
      { id: 'condition',   label: '外壁・共用部の管理状態を確認した',   note: '管理組合の議事録・修繕履歴も確認。→ 不動産仲介会社に依頼' },
      { id: 'repair_plan', label: '長期修繕計画を取り寄せた',           note: '大規模修繕の予定時期・費用の見通しを確認。→ 不動産仲介会社に取り寄せ依頼' },
      { id: 'vacancy',     label: '賃貸化率・空室数を確認した',         note: '賃貸が多すぎると管理が荒れやすい傾向がある。→ 不動産仲介会社に確認' },
    ],
  },
  {
    category: '周辺環境（現地確認）',
    icon: '🌆',
    items: [
      { id: 'night_visit', label: '夜間・週末の環境を現地確認した',           note: '昼間は静かでも夜は繁華街になる・騒音源があるケースがある' },
      { id: 'adult_biz',   label: '周辺に風俗店・パチンコ店がないか確認した', note: '用途地域が「商業」「準工業」では出店が合法。Googleマップで「風俗」「パチンコ」を検索して確認' },
    ],
  },
  {
    category: '火災保険を比較する',
    icon: '🔥',
    items: [
      { id: 'check_insuweb', label: 'インズウェブで火災保険を一括見積もりした', note: '最大10社から一括見積もり。無料・最短3分。SBIホールディングス運営', linkType: 'insuweb', linkLabel: 'インズウェブ', linkCls: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
    ],
  },
  {
    category: '建築会社・HMを選ぶ',
    icon: '🏗',
    tag: '戸建て向け',
    items: [
      { id: 'kazukuri', label: '家づくり相談所でハウスメーカー・工務店を相談した', note: '全国1,000社以上から無料でコーディネート。注文住宅・建売・土地探しに', linkType: 'kazukuri', linkLabel: '家づくり相談所', linkCls: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
      { id: 'kufuieta', label: 'くふうイエタテカウンターで家づくりを無料相談した', note: '注文住宅・リフォーム・リノベを一括相談。専任アドバイザーが無料サポート', linkType: 'kufuieta', linkLabel: 'くふうイエタテ', linkCls: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100' },
      { id: 'solarpartners', label: 'ソーラーパートナーズで太陽光発電の見積もりをした', note: '地元の評判の良い業者に無料一括見積もり。太陽光・蓄電池の見積サイトNo.1', linkType: 'solarpartners', linkLabel: 'ソーラーパートナーズ', linkCls: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100', houseOnly: true },
    ],
  },
  {
    category: '宅配ボックスを設置する',
    icon: '📦',
    tag: '戸建て向け',
    items: [
      { id: 'takuhai', label: '宅配ボックスを設置した（再配達ゼロ・防犯対策）', note: '工事不要・防水・防錆。玄関をすっきり保ちながら再配達をゼロに', linkType: 'takuhai', linkLabel: '宅配ボックス名品館', linkCls: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100' },
    ],
  },
  {
    category: '外壁・屋根塗装を比較する',
    icon: '🏚️',
    tag: '戸建て向け',
    items: [
      { id: 'nurikae', label: 'ヌリカエで外壁塗装・屋根塗装の相場を確認した', note: '優良業者を無料紹介。外壁・屋根の塗装相場をまとめて比較できる', linkType: 'nurikae', linkLabel: 'ヌリカエ', linkCls: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' },
    ],
  },
  {
    category: 'リフォームを検討する',
    icon: '🔨',
    items: [
      { id: 'reform_pro', label: 'リフォーム比較プロで見積もりを比較した', note: '全国の優良リフォーム会社に無料一括見積もり。老舗の比較サイト', linkType: 'reform_pro', linkLabel: 'リフォーム比較プロ', linkCls: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' },
      { id: 'renoveru', label: 'リノベる。で中古マンション＋リノベーションを検討した', note: '物件探しからローン・設計までワンストップ。中古＋リノベの専門サービス', linkType: 'renoveru', linkLabel: 'リノベる。', linkCls: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100', condoOnly: true },
    ],
  },
  {
    category: '住み替えを検討する',
    icon: '🏠',
    items: [
      { id: 'nomcom', label: 'ノムコムで不動産の売却査定を依頼した', note: '野村不動産グループ運営。マンション・戸建て・土地の無料査定依頼ができる', linkType: 'nomcom', linkLabel: 'ノムコム', linkCls: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' },
    ],
  },
  {
    category: 'インターネット回線を見直す',
    icon: '📡',
    items: [
      { id: 'gmohikari', label: 'GMO光アクセスの料金プランを確認した', note: '全国対応の高速光回線。工事費実質無料・最大2ヶ月無料キャンペーンあり', linkType: 'gmohikari', linkLabel: 'GMO光アクセス', linkCls: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
      { id: 'nurokari', label: 'NURO 光の料金プランを確認した', note: '最大75,000円キャッシュバック！オプション不要。ソニーグループの高速光回線', linkType: 'nurokari', linkLabel: 'NURO 光', linkCls: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
    ],
  },
];

const ALL_ITEMS = CHECKLIST.flatMap(c => c.items);

function getVisibleItems(propertyType, excludeIds = []) {
  return CHECKLIST.flatMap(c => {
    if (propertyType === 'condo' && c.tag === '戸建て向け') return [];
    if (propertyType === 'house' && c.tag === 'マンション向け') return [];
    return c.items.filter(item => !excludeIds.includes(item.id) && !(propertyType === 'house' && item.condoOnly) && !(propertyType === 'condo' && item.houseOnly));
  });
}

function calcScore(checkedItems, activeLayers, propertyType, excludeIds = []) {
  const visible = getVisibleItems(propertyType, excludeIds);
  const total = visible.length;
  const checked = visible.filter(item =>
    item.mapLayer ? !!activeLayers[item.mapLayer] : !!checkedItems[item.id]
  ).length;
  return { checked, total, stars: total > 0 ? Math.round((checked / total) * 10) : 0 };
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
      <div className="p-4 text-center text-sm text-gray-700 font-medium mt-8">
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
      <p className="text-xs text-gray-700 font-medium">最大3件まで比較できます</p>
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
                <span className="text-xs text-gray-700 font-medium">{prop.checked}/{prop.total ?? ALL_ITEMS.length}項目チェック済み</span>
              </div>
              <p className="text-xs text-gray-700 font-medium mt-0.5">{new Date(prop.savedAt).toLocaleDateString('ja-JP')}</p>
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
                className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-700 font-medium hover:text-red-400"
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
  const SCORE_ROWS = [
    { key: 'areaScore',    label: '総合スコア',         icon: '⭐', isSummary: true },
    { key: 'landPrice',    label: '公示地価・路線価',   icon: '📈' },
    { key: 'flood',        label: '洪水浸水リスク',     icon: '🌊' },
    { key: 'landslide',    label: '土砂災害リスク',     icon: '⛰️' },
    { key: 'ground',       label: '地盤リスク',           icon: '🪨' },
    { key: 'zoning',       label: '用途地域',           icon: '🏙️' },
    { key: 'nuisance',     label: '施設リスク',           icon: '🏭' },
    { key: 'station',      label: '駅',                 icon: '🚉' },
    { key: 'bus',          label: 'バス停',             icon: '🚌' },
    { key: 'supermarket',  label: 'スーパー',           icon: '🛒' },
    { key: 'hospital',     label: '医療機関',           icon: '🏥' },
    { key: 'kindergarten', label: '保育園・幼稚園',     icon: '🎒' },
    { key: 'school',       label: '小中学校',           icon: '🏫' },
    { key: 'pop',          label: '人口動向',           icon: '👥' },
    { key: 'loanPrice',   label: '物件価格',            icon: '💰', isRawPrice: true },
    { key: 'loan',        label: 'コスト診断',          icon: '🩺' },
  ];

  const getVal = (p, key) =>
    key === 'areaScore' ? (p.areaScore ?? null)
    : key === 'loanPrice' ? (p.loanPrice ?? null)
    : (p.scores?.[key] ?? null);

  const scoreColor = (v) => {
    if (v == null) return 'text-gray-300';
    if (v >= 8)   return 'text-emerald-600';
    if (v >= 5)   return 'text-amber-500';
    return 'text-red-500';
  };

  const bestKeys = SCORE_ROWS.map(row => {
    if (row.isRawPrice) return null;
    const vals = properties.map(p => getVal(p, row.key)).filter(v => v != null);
    return vals.length > 1 ? Math.max(...vals) : null;
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-gray-900">イエカルテ比較</h2>
          <button onClick={onClose} className="text-gray-700 font-medium hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-3 text-gray-700 font-medium font-medium w-32">項目</th>
                {properties.map(p => (
                  <th key={p.id} className="p-3 text-center">
                    <p className="font-semibold text-gray-800 text-xs leading-tight">{p.name}</p>
                    <p className="text-xs text-gray-700 font-medium mt-0.5">{new Date(p.savedAt).toLocaleDateString('ja-JP')}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCORE_ROWS.map((row, ri) => {
                const best = bestKeys[ri];
                return (
                  <tr key={row.key} className={`border-b border-gray-50 ${row.isSummary ? 'bg-gray-50' : ''}`}>
                    <td className="p-3 text-xs text-gray-700 font-medium">
                      <span className="mr-1">{row.icon}</span>{row.label}
                    </td>
                    {properties.map(p => {
                      const v = getVal(p, row.key);
                      const isBest = best != null && v === best;
                      return (
                        <td key={p.id} className="p-3 text-center">
                          {v != null ? (
                            row.isRawPrice ? (
                              <span className="font-bold text-gray-700 text-sm">
                                {v.toLocaleString()}<span className="text-xs font-normal text-gray-400">万円</span>
                              </span>
                            ) : (
                              <span className={`font-bold ${scoreColor(v)} ${row.isSummary ? 'text-base' : 'text-sm'}`}>
                                {v}
                                <span className="text-xs font-normal text-gray-300">/10</span>
                                {isBest && <span className="ml-1 text-xs text-amber-400">▲</span>}
                              </span>
                            )
                          ) : (
                            <span className="text-gray-200 text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-700 font-medium text-center p-3">▲ は比較中で最も高いスコア</p>
      </div>
    </div>
  );
}

// ===== レポート出力 =====

function scoreToRiskLabel(score) {
  if (score == null) return null;
  if (score >= 9) return 'リスクほぼなし';
  if (score >= 7) return 'リスク低め';
  if (score >= 5) return '一部リスクあり';
  if (score >= 3) return '注意エリア';
  return '高リスクエリア';
}

function loanScoreToLabel(score) {
  if (score == null) return '';
  if (score >= 10) return 'お得！（平均より大幅割安）';
  if (score >= 8)  return '割安（平均より安め）';
  if (score >= 6)  return '相場内（エリア平均水準）';
  if (score >= 4)  return 'やや高め';
  return 'かなり高め（価格交渉を）';
}

function ReportRow({ icon, label, score, detail }) {
  const colorHex = score == null ? '#d1d5db'
    : score >= 8 ? '#059669'
    : score >= 5 ? '#d97706'
    : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ width: '20px', flexShrink: 0, fontSize: '14px' }}>{icon}</span>
      <span style={{ width: '130px', flexShrink: 0, fontSize: '11px', color: '#4b5563' }}>{label}</span>
      <span style={{ width: '44px', flexShrink: 0, fontSize: '13px', fontWeight: 700, color: colorHex }}>
        {score != null ? `${score}/10` : '―'}
      </span>
      {detail && <span style={{ fontSize: '11px', color: '#6b7280', flex: 1 }}>{detail}</span>}
    </div>
  );
}

function ReportModal({ onClose, location, propertyType, buildingAddress,
  convData, hazardData, groundData, landPriceData, zoningData, nuisanceData,
  popData, loanData, checkedItems, activeLayers }) {

  const loanScore = loanData?.score ?? null;
  const loanPrice = loanData?.price ?? null;

  const s = {
    station:      calcStationScore(convData),
    bus:          convData != null ? calcBusStopScore(convData.busStops)                                   : null,
    supermarket:  convData != null ? calcSupermarketScore(convData.supermarkets500, convData.supermarkets) : null,
    hospital:     convData != null ? calcMedicalScore(convData.hospitals)                                  : null,
    kindergarten: convData != null ? calcKindergartenScore(convData.kindergartens)                         : null,
    school:       convData != null ? calcSchoolScore(convData.schools)                                     : null,
    landPrice:    calcLandPriceScore(landPriceData?.trend),
    flood:        hazardData?.floodScore     ?? null,
    landslide:    hazardData?.landslideScore ?? null,
    hightide:     hazardData?.hightideScore  ?? null,
    tsunami:      hazardData?.tsunamiScore   ?? null,
    ground:       groundData?.score          ?? null,
    zoning:       calcZoningScore(zoningData),
    nuisance:     calcNuisanceScore(nuisanceData),
    pop:          calcPopScore(popData),
  };

  const areaVals = [s.landPrice, s.flood, s.landslide, s.hightide, s.tsunami, s.ground, s.zoning, s.nuisance, s.station, s.pop].filter(v => v != null);
  const areaScore = areaVals.length ? Math.round(areaVals.reduce((a, v) => a + v, 0) / areaVals.length) : null;

  const areaColor = areaScore == null ? '#9ca3af' : areaScore >= 8 ? '#059669' : areaScore >= 5 ? '#d97706' : '#dc2626';

  const stationDetail = convData?.stations?.length
    ? convData.stations.slice(0, 3).map(st => `${st.name}駅 徒歩${st.walkMin}分`).join('、')
    : convData?.nearestStation
    ? `${convData.nearestStation}駅 徒歩${Math.round(convData.nearestStationM * 1.3 / 80)}分`
    : '2km圏内に駅なし';

  const groundDetail = groundData
    ? [groundData.jname, groundData.arv ? `揺れ${groundData.arv}倍` : null].filter(Boolean).join('・')
    : null;

  const nuisanceDetail = nuisanceData?.facilities?.length
    ? nuisanceData.facilities.slice(0, 2).map(f => `${f.label}(${f.distanceM}m)`).join('、')
    : '500m圏内に検出なし';

  const trendDetail = landPriceData?.trend != null
    ? `トレンド: ${landPriceData.trend > 2 ? `上昇（+${landPriceData.trend}%）` : landPriceData.trend < -2 ? `下落（${landPriceData.trend}%）` : '横ばい'}`
    : null;

  const reportCheckExclude = zoningData?.risk === 'low' ? ['adult_biz'] : [];
  const visibleItems = getVisibleItems(propertyType, reportCheckExclude);
  const checkedCount = visibleItems.filter(item =>
    item.mapLayer ? !!activeLayers[item.mapLayer] : !!checkedItems[item.id]
  ).length;

  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
      {/* 操作バー */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3 bg-gray-50 border-b border-gray-200">
        <button onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
          ✕ 閉じる
        </button>
        <button onClick={() => {
          const el = document.getElementById('iescore-report-content');
          if (!el) return;
          const w = window.open('', '_blank');
          w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>イエカルテ レポート</title><style>@page{margin:15mm;size:A4}body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${el.outerHTML}</body></html>`);
          w.document.close();
          w.focus();
          setTimeout(() => { w.print(); w.close(); }, 400);
        }}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          🖨 印刷・PDF保存
        </button>
        <p className="text-xs text-gray-400">印刷ダイアログで「PDFに保存」を選ぶとPDFで保存できます</p>
      </div>

      {/* ===== レポート本体（印刷対象） ===== */}
      <div id="iescore-report-content" style={{ maxWidth: '680px', margin: '0 auto', padding: '40px 48px', fontFamily: 'Arial, sans-serif' }}>

        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '16px', borderBottom: '2px solid #1f2937', marginBottom: '24px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', marginBottom: '4px' }}>IESCORE REPORT</p>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.3 }}>{location.name}</h1>
            {buildingAddress && <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{buildingAddress}</p>}
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px' }}>{propertyType === 'condo' ? '🏢 マンション' : '🏡 戸建て'}</p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '16px' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>出力日</p>
            <p style={{ fontSize: '12px', color: '#4b5563' }}>{today}</p>
            {areaScore != null && (
              <div style={{ marginTop: '8px' }}>
                <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>総合スコア</p>
                <p style={{ fontSize: '36px', fontWeight: 700, color: areaColor, lineHeight: 1 }}>
                  {areaScore}<span style={{ fontSize: '16px', fontWeight: 400, color: '#9ca3af' }}>/10</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* コスト診断 */}
        {loanData && (loanPrice || loanScore != null) && (
          <section style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', letterSpacing: '2px', borderBottom: '1px solid #e5e7eb', paddingBottom: '6px', marginBottom: '8px' }}>マイホーム購入コスト診断</h2>
            {loanPrice && (
              <ReportRow icon="💰" label="物件価格" score={null}
                detail={`${loanPrice.toLocaleString()}万円${
                  loanData.area ? ` ／ 専有${loanData.area}㎡`
                  : loanData.landArea ? ` ／ 土地${loanData.landArea}㎡${loanData.buildingArea ? `・建物${loanData.buildingArea}㎡` : ''}${loanData.structure ? `（${loanData.structure}）` : ''}`
                  : ''
                }${loanData.builtYear ? ` ／ 築${loanData.builtYear}年` : ''}`} />
            )}
            {loanScore != null && (
              <ReportRow icon="🩺" label="コスト診断スコア" score={loanScore} detail={loanScoreToLabel(loanScore)} />
            )}
            {loanData.feedbackLabel && (
              <ReportRow icon="📊" label="エリア相場比較" score={null}
                detail={`${loanData.feedbackLabel}（${loanData.feedbackSub ?? ''}）${loanData.eraLabel ? ` ／ 比較: ${loanData.eraLabel}` : ''}${loanData.estimate ? ` ／ エリア目安 約${loanData.estimate.toLocaleString()}万円` : ''}`} />
            )}
            {loanData.totalMisc > 0 && (
              <ReportRow icon="🧾" label="諸費用の概算" score={null} detail={`約${loanData.totalMisc.toLocaleString()}万円（仲介手数料・登記・融資手数料・取得税・火災保険）`} />
            )}
            {loanData.down > 0 && loanPrice && (
              <ReportRow icon="🏦" label="頭金 → ローン借入" score={null}
                detail={`頭金 ${loanData.down.toLocaleString()}万円 ／ 借入 ${loanData.loanAmount?.toLocaleString()}万円 ／ 手元現金目安 約${Math.round((loanData.down ?? 0) + (loanData.totalMisc ?? 0)).toLocaleString()}万円`} />
            )}
            {loanData.monthlyVar && (
              <ReportRow icon="📅" label={`月返済（変動${loanData.varRate}%／${loanData.varYears}年）`} score={null}
                detail={`${loanData.monthlyVar.toLocaleString()}円/月${loanData.mgmt || loanData.reserve ? ` ＋ 管理費等 → 合計 ${(loanData.monthlyVar + (loanData.mgmt ?? 0) + (loanData.reserve ?? 0)).toLocaleString()}円/月` : ''}`} />
            )}
            {loanData.monthlyFix && (
              <ReportRow icon="📅" label={`月返済（固定${loanData.fixRate}%／${loanData.fixYears}年）`} score={null}
                detail={`${loanData.monthlyFix.toLocaleString()}円/月${loanData.mgmt || loanData.reserve ? ` ＋ 管理費等 → 合計 ${(loanData.monthlyFix + (loanData.mgmt ?? 0) + (loanData.reserve ?? 0)).toLocaleString()}円/月` : ''}`} />
            )}
            {loanData.mgmt > 0 && (
              <ReportRow icon="🏗" label="管理費" score={null} detail={`${loanData.mgmt.toLocaleString()}円/月${loanData.mgmtLabel ? ` ／ ${loanData.mgmtLabel}` : ''}`} />
            )}
            {loanData.reserve > 0 && (
              <ReportRow icon="🔧" label="修繕積立金" score={null} detail={`${loanData.reserve.toLocaleString()}円/月${loanData.reserveLabel ? ` ／ ${loanData.reserveLabel}` : ''}`} />
            )}
          </section>
        )}

        {/* 利便性 */}
        <section style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', letterSpacing: '2px', borderBottom: '1px solid #e5e7eb', paddingBottom: '6px', marginBottom: '8px' }}>利便性</h2>
          <ReportRow icon="🚉" label="駅"             score={s.station}      detail={stationDetail} />
          <ReportRow icon="🚌" label="バス停"         score={s.bus}          detail={convData ? `200m圏 ${convData.busStops200 ?? 0}件 ／ 500m圏 ${convData.busStops ?? 0}件` : '取得中'} />
          <ReportRow icon="🛒" label="スーパー"       score={s.supermarket}  detail={convData ? `500m圏 ${convData.supermarkets500 ?? 0}件 ／ 1km圏 ${convData.supermarkets ?? 0}件` : '取得中'} />
          <ReportRow icon="🏥" label="医療機関"       score={s.hospital}     detail={convData ? `500m圏 ${convData.hospitals500 ?? 0}件 ／ 1km圏 ${convData.hospitals ?? 0}件` : '取得中'} />
          <ReportRow icon="🎒" label="保育園・幼稚園" score={s.kindergarten} detail={convData ? `500m圏 ${convData.kindergartens500 ?? 0}件 ／ 1km圏 ${convData.kindergartens ?? 0}件` : '取得中'} />
          <ReportRow icon="🏫" label="小中学校"       score={s.school}       detail={convData ? `${convData.schools ?? 0}件（1.5km圏）` : '取得中'} />
        </section>

        {/* エリアリスク */}
        <section style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', letterSpacing: '2px', borderBottom: '1px solid #e5e7eb', paddingBottom: '6px', marginBottom: '8px' }}>エリアリスク・環境</h2>
          <ReportRow icon="📈" label="公示地価・路線価" score={s.landPrice}  detail={trendDetail} />
          <ReportRow icon="🌊" label="洪水浸水リスク"   score={s.flood}      detail={scoreToRiskLabel(s.flood)} />
          <ReportRow icon="⛰️" label="土砂災害リスク"   score={s.landslide}  detail={scoreToRiskLabel(s.landslide)} />
          <ReportRow icon="🪨" label="地盤リスク"         score={s.ground}     detail={groundDetail} />
          <ReportRow icon="🏙️" label="用途地域"         score={s.zoning}     detail={zoningData?.useDistrict ?? null} />
          <ReportRow icon="🏭" label="施設リスク"         score={s.nuisance}   detail={nuisanceDetail} />
          <ReportRow icon="👥" label="人口動向"         score={s.pop}        detail={scoreToRiskLabel(s.pop) ? (s.pop >= 5 ? '増加・横ばい傾向' : '減少傾向') : null} />
        </section>

        {/* 確認チェックリスト */}
        <section style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', letterSpacing: '2px', borderBottom: '1px solid #e5e7eb', paddingBottom: '6px', marginBottom: '4px' }}>確認チェックリスト</h2>
          <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '12px' }}>
            {checkedCount} / {visibleItems.length} 完了（{visibleItems.length > 0 ? Math.round(checkedCount / visibleItems.length * 100) : 0}%）
          </p>
          {CHECKLIST.map(({ category, icon, tag, items }) => {
            const isHidden = (propertyType === 'condo' && tag === '戸建て向け')
              || (propertyType === 'house' && tag === 'マンション向け');
            if (isHidden) return null;
            return (
              <div key={category} style={{ marginBottom: '14px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>{icon} {category}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {items.filter(item => !reportCheckExclude.includes(item.id)).map(item => {
                    const isChecked = item.mapLayer ? !!activeLayers[item.mapLayer] : !!checkedItems[item.id];
                    return (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '4px' }}>
                        <span style={{ fontSize: '12px', color: isChecked ? '#059669' : '#d1d5db', flexShrink: 0, marginTop: '1px', fontWeight: 700 }}>
                          {isChecked ? '✓' : '□'}
                        </span>
                        <div>
                          <p style={{ fontSize: '11px', color: isChecked ? '#111827' : '#6b7280', lineHeight: 1.4, margin: 0 }}>{item.label}</p>
                          {item.note && <p style={{ fontSize: '10px', color: '#9ca3af', lineHeight: 1.4, margin: '1px 0 0 0' }}>{item.note}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        {/* フッター */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', textAlign: 'center' }}>
          <p style={{ fontSize: '10px', color: '#9ca3af' }}>このレポートは iescore.com で生成されました</p>
          <p style={{ fontSize: '10px', color: '#d1d5db', marginTop: '2px' }}>データは各公的機関・API より取得。参考情報としてご活用ください。</p>
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
        <p className="text-xs text-gray-700 font-medium mb-4">わかりやすい名前をつけておくと比較しやすくなります</p>
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
          <button onClick={onCancel} className="flex-1 py-2 text-sm text-gray-700 font-medium border border-gray-200 rounded-xl hover:bg-gray-50">
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

export default function ScorePanel({ location, activeLayers, onToggleLayer, onFlyTo, buildingAddress, propertyType = 'condo', onTotalChange, buildingsLoading, mapConvData, onHighlightPOI, noiseData }) {
  const [activeTab, setActiveTab] = useState('main');
  const [checkedItems, setCheckedItems] = useState({});
  const [saved, setSaved] = useState([]);
  const [compareProps, setCompareProps] = useState(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [popData, setPopData] = useState(null);
  const [popLoading, setPopLoading] = useState(false);
  const [txData, setTxData] = useState(null);
  const [txLoading, setTxLoading] = useState(false);
  const [hazardData, setHazardData] = useState(null);
  const [hazardLoading, setHazardLoading] = useState(false);
  const [groundData, setGroundData] = useState(null);
  const [groundLoading, setGroundLoading] = useState(false);
  const [convData, setConvData] = useState(null);
  const [convLoading, setConvLoading] = useState(false);
  const [poiLoading, setPoiLoading] = useState(false);
  const mapConvDataRef = useRef(null);
  const [fbName, setFbName] = useState('');
  const [fbEmail, setFbEmail] = useState('');
  const [fbMessage, setFbMessage] = useState('');
  const [fbStatus, setFbStatus] = useState('idle'); // idle | sending | sent | error
  const [landPriceData, setLandPriceData] = useState(null);
  const [landPriceLoading, setLandPriceLoading] = useState(false);
  const [buildingName, setBuildingName] = useState(null);
  const [zoningData, setZoningData] = useState(null);
  const [zoningLoading, setZoningLoading] = useState(false);
  const [urbanData, setUrbanData] = useState(null);
  const [urbanLoading, setUrbanLoading] = useState(false);
  const [passengerData, setPassengerData] = useState(null);
  const [passengerLoading, setPassengerLoading] = useState(false);
  const [nuisanceData, setNuisanceData] = useState(null);
  const [nuisanceLoading, setNuisanceLoading] = useState(false);
  const [loanScore, setLoanScore] = useState(null);
  const [loanPrice, setLoanPrice] = useState(null);
  const [loanData, setLoanData] = useState(null);
  const [stationHighlightIdx, setStationHighlightIdx] = useState(null);
  const [houseAdjustRate, setHouseAdjustRate] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [trendData, setTrendData] = useState(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiPromptText, setAiPromptText] = useState('');
  const [aiUserNote, setAiUserNote] = useState('');
  const [aiCopied, setAiCopied] = useState(false);

  const buildAIPrompt = () => {
    const name = buildingName || location.name;
    const addr = buildingAddress || '';
    const typeLabel = propertyType === 'condo' ? 'マンション' : '戸建て';
    const currentYear = new Date().getFullYear();
    const lines = [];
    lines.push('あなたは、データに基づき客観的なアドバイスを行う不動産コンサルタントです。');
    lines.push('');
    lines.push(`以下は【${name}${addr ? '（' + addr + '）' : ''}】の不動産データです（イエスコア調べ）。`);
    lines.push(`物件種別: ${typeLabel} ／ 総合スコア: ${total}/10`);

    // 物件詳細（イエカルテ入力値）
    const hasDetail = loanData && (loanData.price || loanData.area || loanData.builtYear || loanData.mgmt || loanData.reserve);
    if (hasDetail) {
      lines.push('');
      lines.push('■ 物件詳細（イエカルテ入力値）');
      if (loanData.price)      lines.push(`  物件価格: ${loanData.price.toLocaleString()}万円`);
      if (loanData.area)       lines.push(`  専有面積: ${loanData.area}㎡`);
      if (loanData.floor)      lines.push(`  所在階: ${loanData.floor}階`);
      if (loanData.builtYear)  lines.push(`  築年数: ${loanData.builtYear}年竣工（築${currentYear - parseInt(loanData.builtYear)}年）`);
      if (loanData.mgmt)       lines.push(`  管理費: 月${loanData.mgmt.toLocaleString()}円${loanData.mgmtLabel ? `（${loanData.mgmtLabel}）` : ''}`);
      if (loanData.reserve)    lines.push(`  修繕積立金: 月${loanData.reserve.toLocaleString()}円${loanData.reserveLabel ? `（${loanData.reserveLabel}）` : ''}`);
      if (loanData.mgmt && loanData.reserve) lines.push(`  管理費＋修繕積立金: 月${(loanData.mgmt + loanData.reserve).toLocaleString()}円`);
      if (loanData.monthlyVar) lines.push(`  月返済額（変動 ${loanData.varRate}%・${loanData.varYears}年）: 月${Math.round(loanData.monthlyVar).toLocaleString()}円`);
      if (loanData.monthlyFix) lines.push(`  月返済額（固定 ${loanData.fixRate}%・${loanData.fixYears}年）: 月${Math.round(loanData.monthlyFix).toLocaleString()}円`);
      if (loanData.estimatedMonthlyRentM) {
        lines.push(`  想定月額賃料（P50市場価値${loanData.marketValueM?.toLocaleString()}万円×利回り${loanData.rentYield}%試算）: 約${loanData.estimatedMonthlyRentM}万円/月`);
        const loanM = loanData.monthlyVar || loanData.monthlyFix;
        if (loanM) {
          const loanMonthlyM = Math.round(loanM / 10000 * 10) / 10;
          const diffM = Math.round((loanMonthlyM - loanData.estimatedMonthlyRentM) * 10) / 10;
          lines.push(`  返済vs賃料の差: ${diffM > 0 ? '+' : ''}${diffM}万円/月（${diffM > 0 ? 'ローン返済が賃料を超過' : '賃料がローン返済を上回る'}）`);
        }
      }
      if (propertyType === 'house') {
        if (loanData.landArea)     lines.push(`  土地面積: ${loanData.landArea}㎡`);
        if (loanData.buildingArea) lines.push(`  建物面積: ${loanData.buildingArea}㎡`);
        if (loanData.structure)    lines.push(`  構造: ${loanData.structure}`);
      }
    }

    lines.push('');
    lines.push('■ 地盤・ハザード（防災科研J-SHIS・国土地理院データ）');
    if (groundData?.jname) lines.push(`  地形分類: ${groundData.jname}`);
    if (groundData?.arv)   lines.push(`  表層地盤増幅率: ${groundData.arv}倍（1.0が基準。大きいほど地震時に揺れやすい）`);
    lines.push(`  洪水浸水想定: ${hazardData?.floodLabel ? `想定浸水深 ${hazardData.floodLabel}` : '浸水なし（区域外）'}`);
    lines.push(`  土砂災害リスク: ${hazardData?.landslideLabel ?? '区域外'}`);
    lines.push(`  津波浸水想定: ${hazardData?.tsunamiLabel ? `想定浸水深 ${hazardData.tsunamiLabel}` : '区域外'}`);
    lines.push(`  高潮浸水想定: ${hazardData?.hightideLabel ? `想定浸水深 ${hazardData.hightideLabel}` : '区域外'}`);

    lines.push('');
    lines.push('■ 利便性（OpenStreetMapデータ）');
    if (convData?.nearestStation) lines.push(`  最寄り駅: ${convData.nearestStation} 徒歩約${convData.nearestStationM ? Math.round(convData.nearestStationM * 1.3 / 80) : '?'}分`);
    if (convData?.busStops != null)      lines.push(`  バス停: 200m圏${convData.busStops200 ?? 0}箇所 / 500m圏${convData.busStops}箇所`);
    if (convData?.supermarkets != null)  lines.push(`  スーパー: 500m圏${convData.supermarkets500 ?? 0}軒 / 1km圏${convData.supermarkets}軒`);
    if (convData?.hospitals != null)     lines.push(`  病院・クリニック: 500m圏${convData.hospitals500 ?? 0}軒 / 1km圏${convData.hospitals}軒`);
    if (convData?.kindergartens != null) lines.push(`  保育園・幼稚園: 500m圏${convData.kindergartens500 ?? 0}軒 / 1km圏${convData.kindergartens}軒`);
    if (convData?.schools != null)       lines.push(`  小学校(1km圏): ${convData.schools}校`);

    lines.push('');
    lines.push('■ 周辺相場・資産性（国土交通省REINFOLIB成約データ）');
    if (propertyType === 'condo' && txData?.condos?.length > 0) {
      const prices = txData.condos.map(c => c.unitPrice).filter(Boolean);
      if (prices.length) {
        const avg = Math.round(prices.reduce((s, v) => s + v, 0) / prices.length);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        lines.push(`  周辺マンション㎡単価: 平均 約${avg}万円（最安 ${min}万円〜最高 ${max}万円、直近${prices.length}件）`);
      }
    }
    if (propertyType === 'house' && txData?.houses?.length > 0) {
      const prices = txData.houses.map(h => h.price).filter(Boolean);
      if (prices.length) {
        const avg = Math.round(prices.reduce((s, v) => s + v, 0) / prices.length);
        lines.push(`  周辺戸建て成約価格（直近平均）: 約${avg}万円（${prices.length}件）`);
      }
    }
    if (loanData?.area && loanData?.price) {
      const unitPrice = Math.round(loanData.price / loanData.area * 10) / 10;
      lines.push(`  この物件の㎡単価: 約${unitPrice}万円/㎡（${loanData.price}万円 ÷ ${loanData.area}㎡）`);
    }
    if (zoningData?.useDistrict) lines.push(`  用途地域: ${zoningData.useDistrict}`);
    if (landPriceData?.latestPrice) lines.push(`  公示地価: 約${Math.round(landPriceData.latestPrice / 10000)}万円/㎡`);
    if (landPriceData?.trend != null) lines.push(`  公示地価トレンド（直近5年）: ${landPriceData.trend > 0 ? '+' : ''}${landPriceData.trend}%`);

    // 人口動向
    if (popData?.data?.length >= 2) {
      const first = popData.data[0];
      const last  = popData.data[popData.data.length - 1];
      const pct   = Math.round((last.population - first.population) / first.population * 1000) / 10;
      lines.push('');
      lines.push('■ 人口動向');
      lines.push(`  ${popData.muniName ?? ''}の人口: ${last.population.toLocaleString()}人（${last.year}年）`);
      lines.push(`  ${first.year}〜${last.year}年の変化: ${pct > 0 ? '+' : ''}${pct}%`);
    }

    // 施設リスク
    const facilities = nuisanceData?.facilities || [];
    lines.push('');
    lines.push('■ 施設リスク（周辺500m以内）');
    if (facilities.length === 0) {
      lines.push('  該当施設なし');
    } else {
      facilities.forEach(f => lines.push(`  ${f.label}: ${f.distanceM}m`));
    }

    if (noiseData) {
      const ROAD_LABEL = { motorway: '高速道路', trunk: '幹線道路', primary: '主要道路', secondary: '主要道路' };
      lines.push('■ 騒音リスク（地図タイルデータから算出）');
      if (noiseData.railM != null) lines.push(`  最寄り線路${noiseData.railName ? `（${noiseData.railName}）` : ''}: ${noiseData.railM}m`);
      if (noiseData.roadM != null) lines.push(`  最寄り${ROAD_LABEL[noiseData.roadClass] ?? '幹線道路'}: ${noiseData.roadM}m`);
      const noiseDiag = getNoiseDiagnosis(noiseData);
      if (noiseDiag) lines.push(`  評価: ${noiseDiag.title}`);
    }

    lines.push('');
    lines.push('このエリアでのマイホーム購入を検討しています。上記データを踏まえてアドバイスをください。');
    lines.push('（データ出典: イエスコア https://www.iescore.com ）');
    return lines.join('\n');
  };

  const handleOpenAIModal = () => {
    setAiPromptText(buildAIPrompt());
    setAiUserNote('');
    setAiPromptOpen(true);
    setAiCopied(false);
  };

  const buildFinalPrompt = () =>
    aiUserNote.trim() ? `${aiPromptText}\n\n【質問】${aiUserNote.trim()}` : aiPromptText;

  const handleLoanScoreChange = useCallback((data) => {
    setLoanScore(data.score);
    setLoanPrice(data.price);
    setLoanData(data);
  }, []);

  useEffect(() => {
    const data = localStorage.getItem('iescore_saved');
    if (data) setSaved(JSON.parse(data));
  }, []);

  useEffect(() => {
    if (!location) return;
    setPopLoading(true);
    setPopData(null);
    fetch(`/api/population?lng=${location.lng}&lat=${location.lat}`)
      .then(r => r.json())
      .then(d => setPopData(d))
      .catch(() => {})
      .finally(() => setPopLoading(false));
  }, [location]);

  // location が変わったら全データをリセット
  useEffect(() => {
    if (!location) return;
    setTxData(null);
    setTxLoading(true);

    setHazardData(null);
    setHazardLoading(true);
    mapConvDataRef.current = null;
    setConvData(null);
    setConvLoading(true);
    setLandPriceData(null);
    setLandPriceLoading(true);
    setBuildingName(null);
    setZoningData(null);
    setZoningLoading(true);
    setUrbanData(null);
    setUrbanLoading(true);
    setPassengerData(null);
    setPassengerLoading(true);
    setNuisanceData(null);
    setNuisanceLoading(true);
    setCheckedItems({});
    setTrendData(null);

    // 駅乗降客数は lat/lng だけで取得できるので location 変化直後にフェッチ
    if (location?.lat && location?.lng) {
      fetch(`/api/station-passengers?lat=${location.lat}&lng=${location.lng}`)
        .then(r => r.json())
        .then(d => setPassengerData(d))
        .catch(() => setPassengerData(null))
        .finally(() => setPassengerLoading(false));
    }
  }, [location]);

  // muniCode が取れたらバックグラウンドでトレンド取得（総合スコアに反映するため常時フェッチ）
  useEffect(() => {
    if (!popData?.muniCode || trendData || trendLoading) return;
    setTrendLoading(true);
    fetch(`/api/transactions/trend?muniCode=${popData.muniCode}&lng=${location.lng}&lat=${location.lat}`)
      .then(r => r.json())
      .then(d => setTrendData(d.yearlyStats || null))
      .catch(() => {})
      .finally(() => setTrendLoading(false));
  }, [popData?.muniCode]);

  // 建物名（住所レベル検索時のみ OSM から取得）
  // ②で明示的に選択した場合は skipBuildingSearch=true が付くため、その名前を優先する
  useEffect(() => {
    if (!location || location.featureType !== 'address') return;
    if (location.skipBuildingSearch) {
      setBuildingName(location.name);
      return;
    }
    fetch(`/api/buildings?lng=${location.lng}&lat=${location.lat}`)
      .then(r => r.json())
      .then(d => {
        const hit = d.name && (d.distanceM ?? 999) <= 20;
        setBuildingName(hit ? d.name : null);
      })
      .catch(() => {});
  }, [location]);


  // ハザード（国土地理院標高API）: population と並行して取得
  useEffect(() => {
    if (!location) return;
    fetch(`/api/hazard?lng=${location.lng}&lat=${location.lat}`)
      .then(r => r.json())
      .then(d => setHazardData(d))
      .catch(() => setHazardData(null))
      .finally(() => setHazardLoading(false));
  }, [location]);

  // 施設リスク（Overpass）
  useEffect(() => {
    if (!location) return;
    fetch(`/api/nuisance?lat=${location.lat}&lng=${location.lng}`)
      .then(r => r.json())
      .then(d => setNuisanceData(d))
      .catch(() => setNuisanceData(null))
      .finally(() => setNuisanceLoading(false));
  }, [location]);

  // 地盤情報（J-SHIS 防災科研）
  useEffect(() => {
    if (!location) return;
    setGroundLoading(true);
    setGroundData(null);
    fetch(`/api/ground?lat=${location.lat}&lng=${location.lng}`)
      .then(r => r.json())
      .then(d => setGroundData(d))
      .catch(() => setGroundData(null))
      .finally(() => setGroundLoading(false));
  }, [location]);

  // 場所が変わったら POI ローディングをリセット
  useEffect(() => {
    if (!location) return;
    setPoiLoading(true);
  }, [location]);

  // 地図タイルから届いた POI カウント（mapConvData）を convData にマージ
  useEffect(() => {
    mapConvDataRef.current = mapConvData;
    if (!mapConvData) return;
    setConvData(prev => ({ ...(prev || {}), ...mapConvData }));
    if (mapConvData.overpassDone) setPoiLoading(false);
  }, [mapConvData]);

  // 利便性（HeartRails 駅データ）: 場所確定から1秒後に取得
  useEffect(() => {
    if (!location) return;
    const timer = setTimeout(() => {
      fetch(`/api/convenience?lng=${location.lng}&lat=${location.lat}`)
        .then(r => r.json())
        .then(d => {
          // API は駅情報のみ返す。POIデータは Overpass から mapConvData 経由で来る
          setConvData(prev => ({ ...(prev || {}), ...d }));
        })
        .catch(() => {})
        .finally(() => setConvLoading(false));
    }, 1000);
    return () => clearTimeout(timer);
  }, [location]);

  // 成約価格タイムアウト: muniCodeが15秒以内に来なければローディングを解除
  useEffect(() => {
    if (!location) return;
    const timer = setTimeout(() => setTxLoading(false), 15000);
    return () => clearTimeout(timer);
  }, [location]);

  // population の muniCode が取れたらそれを使って transactions と公示地価を取得
  useEffect(() => {
    if (!popData?.muniCode) return;
    setTxLoading(true);
    const params = new URLSearchParams({
      muniCode: popData.muniCode,
      muniName: popData.muniName || '',
      ...(location?.lng && { lng: location.lng, lat: location.lat }),
    });
    fetch(`/api/transactions?${params}`)
      .then(r => r.json())
      .then(d => setTxData(d))
      .catch(() => setTxData(null))
      .finally(() => setTxLoading(false));

    fetch(`/api/landprice?muniCode=${popData.muniCode}`)
      .then(r => r.json())
      .then(d => setLandPriceData(d))
      .catch(() => setLandPriceData(null))
      .finally(() => setLandPriceLoading(false));

    fetch(`/api/zoning?muniCode=${popData.muniCode}&lat=${location.lat}&lng=${location.lng}`)
      .then(r => r.json())
      .then(d => setZoningData(d))
      .catch(() => setZoningData(null))
      .finally(() => setZoningLoading(false));

    fetch(`/api/urban?lat=${location.lat}&lng=${location.lng}`)
      .then(r => r.json())
      .then(d => setUrbanData(d))
      .catch(() => setUrbanData(null))
      .finally(() => setUrbanLoading(false));

  }, [popData?.muniCode]);

  const toggleCheck = (id) => setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));

  const checkExclude = zoningData?.risk === 'low' ? ['adult_biz'] : [];
  const { checked, total: checkTotal, stars } = calcScore(checkedItems, activeLayers, propertyType, checkExclude);

  const handleSave = () => {
    if (!location) return;
    setSaveModalOpen(true);
  };

  const handleSaveConfirm = (name) => {
    setSaveModalOpen(false);
    const scores = {
      landPrice:   calcLandPriceScore(landPriceData?.trend),
      flood:       hazardData?.floodScore     ?? null,
      landslide:   hazardData?.landslideScore ?? null,
      hightide:    hazardData?.hightideScore  ?? null,
      tsunami:     hazardData?.tsunamiScore   ?? null,
      ground:      groundData?.score          ?? null,
      zoning:      calcZoningScore(zoningData),
      nuisance:    calcNuisanceScore(nuisanceData),
      station:     calcStationScore(convData),
      bus:         convData != null ? calcBusStopScore(convData.busStops)                                    : null,
      supermarket: convData != null ? calcSupermarketScore(convData.supermarkets500, convData.supermarkets)  : null,
      hospital:    convData != null ? calcMedicalScore(convData.hospitals)                                   : null,
      kindergarten:convData != null ? calcKindergartenScore(convData.kindergartens)                         : null,
      school:      convData != null ? calcSchoolScore(convData.schools)                                      : null,
      pop:         calcPopScore(popData),
      loan:        loanScore,
    };
    const areaScoreVals = [scores.landPrice, scores.flood, scores.landslide, scores.ground,
      scores.zoning, scores.nuisance, scores.station, scores.pop].filter(v => v != null);
    const areaScore = areaScoreVals.length
      ? Math.round(areaScoreVals.reduce((s, v) => s + v, 0) / areaScoreVals.length) : null;
    const newProp = {
      id: `prop_${Date.now()}`,
      name,
      lat: location.lat,
      lng: location.lng,
      checkedItems,
      activeLayers,
      checked,
      total: checkTotal,
      stars,
      scores,
      areaScore,
      loanPrice,
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
    setActiveTab('main');
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!fbMessage.trim()) return;
    setFbStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fbName,
          email: fbEmail,
          message: fbMessage,
          location: location?.name || location?.address || '',
          buildingName: buildingName || '',
          loanData: loanData ? {
            price:      loanData.price,
            area:       loanData.area,
            builtYear:  loanData.builtYear,
            down:       loanData.down,
            loanAmount: loanData.loanAmount,
            totalMisc:  loanData.totalMisc,
            varRate:    loanData.varRate,
            varYears:   loanData.varYears,
            monthlyVar: loanData.monthlyVar,
            fixRate:    loanData.fixRate,
            fixYears:   loanData.fixYears,
            monthlyFix: loanData.monthlyFix,
            mgmt:       loanData.mgmt,
            reserve:    loanData.reserve,
          } : null,
        }),
      });
      if (!res.ok) throw new Error();
      setFbStatus('sent');
      setFbName(''); setFbEmail(''); setFbMessage('');
    } catch {
      setFbStatus('error');
    }
  };

  useEffect(() => {
    if (!location) { onTotalChange?.(null); return; }
    const t = Math.round(
      [calcPriceScore(txData), calcHazardScore(hazardData), groundData?.score ?? 5,
       calcConvScore(convData), calcPopScore(popData), calcLandPriceScore(landPriceData?.trend),
       calcZoningScore(zoningData), calcNuisanceScore(nuisanceData),
       calcTrendScore(trendData, propertyType), calcFutureScore(zoningData, urbanData, passengerData),
      ].reduce((a, b) => a + b, 0) / 10
    );
    onTotalChange?.(t);
  }, [location, txData, hazardData, groundData, convData, popData, landPriceData, zoningData, nuisanceData, trendData, urbanData, passengerData, propertyType]);

  if (!location) {
    if (activeTab === 'saved') {
      return (
        <div className="flex-1 bg-gray-50 border-l border-gray-200 flex flex-col overflow-hidden">
          <div className="flex border-b border-gray-200 bg-white shrink-0">
            <button
              onClick={() => setActiveTab('main')}
              className="flex-1 py-2.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
            >
              イエカルテ
            </button>
            <button
              className="flex-1 py-2.5 text-xs font-semibold text-blue-600 border-b-2 border-blue-600"
            >
              保存済み ({saved.length})
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SavedList
              saved={saved}
              onSelect={handleSelectSaved}
              onDelete={handleDelete}
              onCompare={setCompareProps}
            />
          </div>
        </div>
      );
    }
    return (
      <div className="flex-1 bg-gray-50 border-l border-gray-200 flex flex-col items-center justify-center p-6 text-center">
        <span className="text-4xl mb-3">🏠</span>
        <p className="text-sm font-semibold text-gray-600">① 住所・駅名・エリアで検索</p>
        <p className="text-xs text-gray-700 font-medium mt-2">
          ② マンションを選択（任意）<br />③ イエカルテで詳細を入力しよう
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

  const hazardScore    = calcHazardScore(hazardData);
  const convScore      = calcConvScore(convData);
  const groundScore    = groundData?.score ?? 5;
  const landPriceScore = calcLandPriceScore(landPriceData?.trend);
  const total = Math.round(
    [calcPriceScore(txData), hazardScore, groundScore, convScore, calcPopScore(popData), landPriceScore,
     calcZoningScore(zoningData), calcNuisanceScore(nuisanceData),
     calcTrendScore(trendData, propertyType),
    ].reduce((s, v) => s + v, 0) / 9
  );
  const areaScoreVals = [hazardScore, groundScore, landPriceScore,
    calcZoningScore(zoningData), calcNuisanceScore(nuisanceData),
    calcStationScore(convData), calcPopScore(popData)].filter(v => v != null);
  const areaScore = areaScoreVals.length
    ? Math.round(areaScoreVals.reduce((s, v) => s + v, 0) / areaScoreVals.length) : null;

  return (
    <>
      {aiPromptOpen && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/50 p-4" onClick={() => setAiPromptOpen(false)}>
          <div className="bg-white rounded-2xl w-full md:max-w-lg shadow-2xl flex flex-col gap-3 p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between shrink-0">
              <h3 className="font-bold text-gray-900 text-sm">🤖<br />以下のプロンプトをコピーして使ってください</h3>
              <button onClick={() => setAiPromptOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <textarea
              readOnly
              value={aiPromptText}
              className="w-full h-64 text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 resize-none text-gray-700 font-medium"
              onFocus={e => e.target.select()}
            />
            <div className="shrink-0">
              <label className="text-xs font-medium text-gray-700 block mb-1">💬 気になることを追記（任意）</label>
              <textarea
                value={aiUserNote}
                onChange={e => { setAiUserNote(e.target.value); setAiCopied(false); }}
                placeholder="例：この物件は高すぎますか？他に注意点はありますか？"
                className="w-full h-32 text-sm border border-blue-200 rounded-lg p-3 resize-none focus:outline-none focus:border-blue-400"
              />
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(buildFinalPrompt()).catch(() => {}); setAiCopied(true); setTimeout(() => setAiCopied(false), 2000); }}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors shrink-0 ${aiCopied ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {aiCopied ? '✓ コピーしました！' : '📋 プロンプトをコピー'}
            </button>
            <p className="text-xs text-center text-gray-400 shrink-0">またはそのまま開く（ChatGPTは自動入力対応）</p>
            <div className="flex gap-2 shrink-0">
              {[
                { label: 'ChatGPT', color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100', getUrl: () => `https://chatgpt.com/?q=${encodeURIComponent(buildFinalPrompt())}` },
                { label: 'Claude',  color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100', getUrl: () => 'https://claude.ai/new' },
                { label: 'Gemini',  color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',  getUrl: () => `https://gemini.google.com/app?q=${encodeURIComponent(buildFinalPrompt())}` },
              ].map(({ label, color, getUrl }) => (
                <a
                  key={label}
                  href={getUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => navigator.clipboard.writeText(buildFinalPrompt()).catch(() => {})}
                  className={`flex-1 text-xs font-medium px-2 py-2 rounded-lg border text-center transition-colors ${color}`}
                >
                  {label} ↗
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
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
      {showReport && (
        <ReportModal
          onClose={() => setShowReport(false)}
          location={location}
          propertyType={propertyType}
          buildingAddress={buildingAddress}
          convData={convData}
          hazardData={hazardData}
          groundData={groundData}
          landPriceData={landPriceData}
          zoningData={zoningData}
          nuisanceData={nuisanceData}
          popData={popData}
          loanData={loanData}
          checkedItems={checkedItems}
          activeLayers={activeLayers}
        />
      )}
      <div className="flex-1 bg-gray-50 border-l border-gray-200 flex flex-col overflow-hidden">
        {/* タブ */}
        <div className="flex border-b border-gray-200 bg-white shrink-0 items-stretch">
          {/* イエカルテタブ（広め） */}
          <button
            onClick={() => setActiveTab('main')}
            className={`flex-[2] py-1 px-3 transition-colors ${
              activeTab === 'main'
                ? 'border-b-2 border-blue-600'
                : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className={`text-xs font-bold shrink-0 ${activeTab === 'main' ? 'text-blue-600' : 'text-gray-600'}`}>イエカルテ</span>
              <span className="text-xs font-bold text-gray-700 shrink-0">エリア</span>
              {areaScore != null ? <Stars score={areaScore} /> : <span className="text-xs text-gray-400">--</span>}
              <span className="text-xs font-bold text-gray-700 shrink-0">コスト</span>
              {loanScore != null ? <Stars score={loanScore} /> : <span className="text-xs text-gray-400">--</span>}
            </div>
          </button>
          {/* 保存済みタブ（小さめ） */}
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 py-1 text-xs font-semibold transition-colors border-l border-gray-100 ${
              activeTab === 'saved'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }`}
          >
            保存済み{saved.length > 0 && <span className="ml-0.5">({saved.length})</span>}
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto">
          <div className={`flex flex-col gap-3 p-4 ${activeTab !== 'main' ? 'hidden' : ''}`}>
              {/* キャッチコピー */}
              <div className="px-1 pt-1 pb-0">
                <p className="text-sm font-bold text-gray-800 leading-relaxed">「ここに住んで、本当に大丈夫？」</p>
                <p className="text-sm text-gray-600 leading-relaxed">—— その不安、イエスコアが答えます。</p>
              </div>
              {/* 物件名・住所 */}
              <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-900 text-sm leading-snug truncate flex-1">
                    {buildingName || location.name}
                  </p>
                  {location.featureType === 'address' && (
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent((buildingName || location.name) + (buildingAddress ? ' ' + buildingAddress : ''))}/@${location.lat},${location.lng},17z`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Googleマップで開く"
                      className="shrink-0 text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 whitespace-nowrap"
                    >
                      🗺 gmap
                    </a>
                  )}
                </div>
                {buildingAddress && (
                  <p className="text-xs text-gray-700 font-medium mt-0.5">{buildingAddress}</p>
                )}
                {buildingsLoading && (
                  <div className="flex items-center gap-1.5 text-xs text-indigo-500 mt-1.5">
                    <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    マンション検索中...
                  </div>
                )}
              </div>
              {/* エリア診断セクションタイトル */}
              <div className="flex items-center gap-2 mt-4 mb-2">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-sm text-gray-800 font-bold shrink-0">マイホーム購入エリア診断</span>
                {areaScore != null && <Stars score={areaScore} />}
                <div className="flex-1 border-t border-gray-200" />
              </div>
              <p className="text-xs text-gray-700 font-medium leading-relaxed px-1">住宅の購入を検討しているエリアの利便性、浸水/土砂などの災害・地盤・騒音などのリスクから、エリアの良し悪しを10点満点で評価します。</p>

              {/* 徒歩圏シミュレーター */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🗺</span>
                  <span className="text-sm font-semibold text-gray-700">徒歩圏シミュレーター</span>
                </div>
                <p className="text-xs text-gray-700 font-medium mb-3">このエリアから徒歩5・10・15分で到達できる範囲を地図に表示します</p>
                <button
                  onClick={() => onToggleLayer('isochrone')}
                  className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeLayers.isochrone
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  🗺 地図に徒歩圏を表示
                </button>
              </div>

              <ConvSubCard icon="🚉" label="駅" layerId="station"
                score={calcConvScore(convData)} loading={convLoading}
                activeLayers={activeLayers} onToggleLayer={onToggleLayer}
              >
                {convData?.stations?.length ? (
                  <div className="space-y-1.5">
                    {convData.stations.slice(0, 4).map((s, i) => {
                      const label = operatorLabel(s.operator);
                      const clickable = !!(s.lat && s.lng && onHighlightPOI);
                      const isActive = stationHighlightIdx === i;
                      return (
                        <div key={i}>
                          <p
                            className={`text-sm rounded px-1 -mx-1 transition-colors ${clickable ? 'cursor-pointer hover:bg-blue-50' : ''} ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600'}`}
                            onClick={() => {
                              if (!clickable) return;
                              if (!activeLayers.station) onToggleLayer('station');
                              if (isActive) {
                                setStationHighlightIdx(null);
                                onHighlightPOI(null, null, null);
                              } else {
                                setStationHighlightIdx(i);
                                onHighlightPOI(s.lat, s.lng, 'station');
                              }
                            }}
                          >
                            {clickable && <span className="mr-1 opacity-40">📍</span>}
                            {s.name}駅まで徒歩{s.walkMin}分
                            {label && <span className="ml-1 text-xs text-gray-400">（{label}）</span>}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : convData?.nearestStation ? (
                  <p className="text-sm text-gray-600">{convData.nearestStation}駅まで徒歩{Math.round(convData.nearestStationM * 1.3 / 80)}分</p>
                ) : (
                  <p className="text-sm text-gray-700 font-medium">2km圏内に駅なし</p>
                )}
              </ConvSubCard>

              <ConvSubCard icon="🚌" label="バス停" layerId="busstop"
                score={calcBusStopScore(convData?.busStops)} loading={poiLoading}
                activeLayers={activeLayers} onToggleLayer={onToggleLayer}
                list={convData?.busStopList} onHighlightItem={onHighlightPOI}
              >
                <p className="text-sm text-gray-600">200m圏 {convData?.busStops200 ?? 0}件　／　500m圏 {convData?.busStops ?? 0}件</p>
              </ConvSubCard>

              <ConvSubCard icon="🛒" label="スーパー" layerId="supermarket"
                score={calcSupermarketScore(convData?.supermarkets500, convData?.supermarkets)} loading={poiLoading}
                activeLayers={activeLayers} onToggleLayer={onToggleLayer}
                list={convData?.supermarketList} onHighlightItem={onHighlightPOI}
              >
                <p className="text-sm text-gray-600">
                  500m圏 {convData?.supermarkets500 ?? 0}件　／　1km圏 {convData?.supermarkets ?? 0}件
                </p>
              </ConvSubCard>

              <ConvSubCard icon="🏪" label="コンビニ" layerId="konbini"
                score={calcKonbiniScore(convData?.konbinis500, convData?.konbinis)} loading={poiLoading}
                activeLayers={activeLayers} onToggleLayer={onToggleLayer}
                list={convData?.konbiniList} onHighlightItem={onHighlightPOI}
              >
                <p className="text-sm text-gray-600">
                  500m圏 {convData?.konbinis500 ?? 0}件　／　1km圏 {convData?.konbinis ?? 0}件
                </p>
              </ConvSubCard>

              <ConvSubCard icon="🏥" label="医療機関" layerId="medical"
                score={calcMedicalScore(convData?.hospitals)} loading={convLoading}
                activeLayers={activeLayers} onToggleLayer={onToggleLayer}
                list={convData?.hospitalList} onHighlightItem={onHighlightPOI}
              >
                <p className="text-sm text-gray-600">500m圏 {convData?.hospitals500 ?? 0}件　／　1km圏 {convData?.hospitals ?? 0}件</p>
              </ConvSubCard>

              <ConvSubCard icon="🎒" label="保育園・幼稚園" layerId="kindergarten"
                score={calcKindergartenScore(convData?.kindergartens)} loading={convLoading}
                activeLayers={activeLayers} onToggleLayer={onToggleLayer}
                list={convData?.kindergartenList} onHighlightItem={onHighlightPOI}
              >
                <p className="text-sm text-gray-600">500m圏 {convData?.kindergartens500 ?? 0}件　／　1km圏 {convData?.kindergartens ?? 0}件</p>
              </ConvSubCard>

              <ConvSubCard icon="🏫" label="小中学校" layerId="school"
                score={calcSchoolScore(convData?.schools)} loading={convLoading}
                activeLayers={activeLayers} onToggleLayer={onToggleLayer}
                list={convData?.schoolList} onHighlightItem={onHighlightPOI}
              >
                <p className="text-sm text-gray-600">{convData?.schools ?? 0}件（1.5km圏）</p>
              </ConvSubCard>

              <ZoningCard zoningData={zoningData} zoningLoading={zoningLoading} />

              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-xs text-gray-600 font-bold shrink-0">（リスク関連）</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              <FloodScoreCard
                hazardData={hazardData}
                hazardLoading={hazardLoading}
                activeLayers={activeLayers}
                onToggleLayer={onToggleLayer}
              />
              <LandslideScoreCard
                hazardData={hazardData}
                hazardLoading={hazardLoading}
                activeLayers={activeLayers}
                onToggleLayer={onToggleLayer}
              />
              <TsunamiScoreCard
                hazardData={hazardData}
                hazardLoading={hazardLoading}
                activeLayers={activeLayers}
                onToggleLayer={onToggleLayer}
              />
              <HightideScoreCard
                hazardData={hazardData}
                hazardLoading={hazardLoading}
                activeLayers={activeLayers}
                onToggleLayer={onToggleLayer}
                location={location}
              />
              <GroundScoreCard groundData={groundData} groundLoading={groundLoading} />
              <NoiseScoreCard noiseData={noiseData} activeLayers={activeLayers} onToggleLayer={onToggleLayer} />
              <NuisanceCard nuisanceData={nuisanceData} nuisanceLoading={nuisanceLoading} />

              {/* マイホーム購入コスト診断セクションタイトル */}
              <div className="flex items-center gap-2 mt-4 mb-2">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-sm text-gray-800 font-bold shrink-0">マイホーム購入コスト診断</span>
                {loanScore != null && <Stars score={loanScore} />}
                <div className="flex-1 border-t border-gray-200" />
              </div>
              <p className="text-xs text-gray-700 font-medium leading-relaxed px-1">購入を予定している住宅の築年数、価格、面積を入力することで、エリア相場との比較やコストの適正度を診断します。</p>

              <LoanSimulator
                propertyType={propertyType}
                showMgmt={propertyType === 'condo'}
                showBuiltYear={true}
                condos={propertyType === 'condo' ? txData?.condos : null}
                houses={propertyType === 'house' ? txData?.houses : null}
                onHouseAdjustChange={propertyType === 'house' ? setHouseAdjustRate : undefined}
                homesUrl={location.featureType === 'address' ? (() => {
                  const nameKw = buildingName || location.name;
                  const cityWard = buildingAddress
                    ? (() => {
                        const noKen = buildingAddress.replace(/^.+?[都道府県]/, '');
                        const m = noKen.match(/^.+?区/);
                        if (m) return m[0];
                        const m2 = noKen.match(/^.+?[市町村]/);
                        return m2 ? m2[0] : noKen;
                      })()
                    : '';
                  const kw = cityWard ? `${nameKw} ${cityWard}` : nameKw;
                  return `https://www.homes.co.jp/archive/list/search/?keyword=${encodeURIComponent(kw)}`;
                })() : null}
                googleUrl={location.featureType === 'address' ? (() => {
                  const nameKw = buildingName || location.name;
                  const stripped = buildingAddress
                    ? buildingAddress
                        .replace(/^.+?[都道府県]/, '')
                        .replace(/[0-9０-９一二三四五六七八九十百千]+丁目.*/, '')
                    : '';
                  const kw = stripped ? `${nameKw} ${stripped}` : nameKw;
                  return `https://www.google.com/search?q=${encodeURIComponent(kw + ' 築年月')}`;
                })() : null}
                onScoreChange={handleLoanScoreChange}
                address={buildingAddress || location.name}
                nearestStationM={convData?.nearestStationM ?? null}
              />

              {/* イエスコアカード — 選択タイプのみ表示 */}
              {propertyType === 'condo' && (
                <CondoCard txData={txData} loading={txLoading}
                  syncEra={loanData?.builtYear ? yearToEra(loanData.builtYear) : null}
                  syncArea={loanData?.area ?? null}
                />
              )}
              {propertyType === 'house' && (
                <HouseCard txData={txData} loading={txLoading} landAreaProp={loanData?.landArea ?? null} adjustmentRate={houseAdjustRate} />
              )}

              {/* アドバンスドセクション */}
              <div className="rounded-xl border border-indigo-100 overflow-hidden">
                <button
                  onClick={() => setShowAdvanced(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">📈</span>
                    <span className="text-sm font-semibold text-indigo-800">アドバンスド（資産価値分析）</span>
                  </div>
                  <span className={`text-indigo-500 text-xs font-medium ${!showAdvanced ? 'advanced-hint' : ''}`}>
                    {showAdvanced ? '▲ 閉じる' : '▼ 開く'}
                  </span>
                </button>
                {showAdvanced && (
                  <div className="flex flex-col gap-3 p-3 bg-white">
                    <p className="text-xs text-gray-700 font-medium px-1">資産価値を重視する方向けの詳細分析です。</p>
                    <PriceTrendCard trendData={trendData} loading={trendLoading} propertyType={propertyType} />
                    <LandPriceCard data={landPriceData} loading={landPriceLoading} muniCode={popData?.muniCode} />
                    {propertyType === 'house' && (
                      <LandValueCard
                        landPriceData={landPriceData}
                        landArea={loanData?.landArea ?? null}
                        price={loanData?.price ?? null}
                        landPriceInput={loanData?.landPrice ?? null}
                        buildingPriceInput={loanData?.buildingPrice ?? null}
                        structure={loanData?.structure ?? null}
                        builtYear={loanData?.builtYear ?? null}
                      />
                    )}
                    {propertyType === 'condo' && (
                      <CondoFutureCard
                        condos={txData?.condos ?? null}
                        price={loanData?.price ?? null}
                        area={loanData?.area ?? null}
                      />
                    )}
                    <PopulationScoreCard popData={popData} loading={popLoading} />
                    <FutureScoreCard zoningData={zoningData} urbanData={urbanData} passengerData={passengerData} zoningLoading={zoningLoading} urbanLoading={urbanLoading} />
                    <StationPassengerCard passengerData={passengerData} passengerLoading={passengerLoading} convStations={convData?.stations ?? []} />
                  </div>
                )}
              </div>

              {/* AIに質問ボタン（チェックリスト直上） */}
              <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
                <button
                  onClick={handleOpenAIModal}
                  className="w-full py-2 text-sm font-medium bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 border border-blue-200 rounded-lg hover:from-blue-100 hover:to-purple-100 transition-colors"
                >
                  🤖 この物件を自分のAIに質問する
                </button>
              </div>

              {/* セパレーター */}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-xs text-gray-700 font-medium font-medium shrink-0">確認チェックリスト</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              {/* プログレスバー */}
              <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                <div className="flex justify-between text-xs text-gray-700 font-medium mb-1.5">
                  <span>確認済み</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const all = getVisibleItems(propertyType, checkExclude);
                        const updates = {};
                        all.filter(item => !item.mapLayer).forEach(item => { updates[item.id] = true; });
                        setCheckedItems(prev => ({ ...prev, ...updates }));
                      }}
                      className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                    >
                      全てチェック
                    </button>
                    <span className="font-semibold">{checked} / {checkTotal}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(checked / checkTotal) * 100}%` }}
                  />
                </div>
                <div className="flex justify-center mt-2">
                  <span className="text-xs font-semibold text-blue-500">
                    {checkTotal > 0 ? Math.round((checked / checkTotal) * 100) : 0}% 完了
                  </span>
                </div>
              </div>

              {/* チェックリスト */}
              {CHECKLIST.map(({ category, icon, tag, items }) => {
                const isHidden = (propertyType === 'condo' && tag === '戸建て向け')
                  || (propertyType === 'house' && tag === 'マンション向け');
                if (isHidden) return null;
                return (<div key={category}>
                  <div className="flex items-center gap-1.5 mb-2 px-1">
                    <span>{icon}</span>
                    <span className="text-xs font-bold text-gray-700 font-medium">{category}</span>
                    {tag && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        tag === 'マンション向け' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                      }`}>{tag}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.filter(item => !(propertyType === 'house' && item.condoOnly) && !(propertyType === 'condo' && item.houseOnly)).map((item) => {
                      const isChecked = item.mapLayer ? !!activeLayers[item.mapLayer] : !!checkedItems[item.id];
                      const convHint = isChecked && item.mapLayer ? getConvHint(item.mapLayer, convData) : null;

                      const zoningRisk = zoningData?.risk;
                      const isDimmed  = item.id === 'adult_biz' && zoningRisk === 'low';
                      const isWarning = item.id === 'adult_biz' && (zoningRisk === 'high' || zoningRisk === 'mid');
                      const dynamicNote = item.id === 'adult_biz'
                        ? zoningRisk === 'low'
                          ? '住居系地域のため風俗営業の出店は原則禁止。リスクは低めです'
                          : zoningRisk === 'mid'
                          ? '近隣商業地域のためパチンコ等の出店が許可されています。Googleマップで確認推奨'
                          : zoningRisk === 'high'
                          ? '商業・準工業地域のため風俗店・パチンコの出店が法的に許可。必ず現地/Googleマップで確認を'
                          : item.note
                        : item.note;

                      const baseCls = isChecked ? 'bg-blue-50 border-blue-200' : isDimmed ? 'bg-gray-50 border-gray-100 opacity-60' : isWarning ? 'bg-orange-50 border-orange-200 hover:border-orange-300' : 'bg-white border-gray-100 hover:border-gray-200';
                      const labelCls = isChecked ? 'text-blue-800' : isDimmed ? 'text-gray-700 font-medium' : isWarning ? 'text-orange-800' : 'text-gray-800';
                      const checkboxCls = `mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold transition-colors ${isChecked ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'}`;

                      // linkType アイテム: カード全体がリンク
                      if (item.linkType) {
                        const linkUrl = getChecklistUrl(item.linkType, location?.name, buildingAddress);
                        const linkCard = (
                          <a href={linkUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="block w-full text-left bg-white border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors shadow-sm">
                            <p className="text-sm font-medium text-gray-800 leading-snug">{item.label}</p>
                            <p className="text-xs text-gray-700 font-medium mt-0.5 leading-snug">{item.note}</p>
                            <span className={`inline-block mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${item.linkCls}`}>{item.linkLabel} →</span>
                          </a>
                        );
                        if (item.id === 'kazukuri') return (
                          <div key={item.id} className="flex flex-col gap-2">
                            {linkCard}
                            <div className="flex items-center justify-center gap-1">
                                                            <a href="https://px.a8.net/svt/ejp?a8mat=4B3IIK+FG2VSI+5OGA+5YZ75" rel="nofollow noopener noreferrer" target="_blank">
                                <img width={300} height={250} alt="家づくり相談所" src="https://www24.a8.net/svt/bgt?aid=260504444934&wid=001&eno=01&mid=s00000026497001003000&mc=1" style={{ maxWidth: '100%', height: 'auto' }} />
                              </a>
                              <img width={1} height={1} src="https://www12.a8.net/0.gif?a8mat=4B3IIK+FG2VSI+5OGA+5YZ75" alt="" style={{ display: 'none' }} /><span className="text-[10px] text-gray-400 self-stretch flex items-center" style={{ writingMode: 'vertical-rl' }}>PR</span>
                            </div>
                          </div>
                        );
                        if (item.id === 'kufuieta') return (
                          <div key={item.id} className="flex flex-col gap-2">
                            {linkCard}
                            <div className="flex items-center justify-center gap-1">
                                                            <a href="https://px.a8.net/svt/ejp?a8mat=4B3IIL+S2+5NVG+5Z6WX" rel="nofollow noopener noreferrer" target="_blank">
                                <img width={300} height={250} alt="くふうイエタテカウンター" src="https://www29.a8.net/svt/bgt?aid=260504445000&wid=001&eno=01&mid=s00000026422001004000&mc=1" style={{ maxWidth: '100%', height: 'auto' }} />
                              </a>
                              <img width={1} height={1} src="https://www18.a8.net/0.gif?a8mat=4B3IIL+S2+5NVG+5Z6WX" alt="" style={{ display: 'none' }} /><span className="text-[10px] text-gray-400 self-stretch flex items-center" style={{ writingMode: 'vertical-rl' }}>PR</span>
                            </div>
                          </div>
                        );
                        if (item.id === 'solarpartners') return (
                          <div key={item.id} className="flex flex-col gap-2">
                            {linkCard}
                            <div className="flex items-center justify-center gap-1">
                                                            <a href="https://px.a8.net/svt/ejp?a8mat=4B3NYV+5SZ642+3LME+656YP" rel="nofollow noopener noreferrer" target="_blank">
                                <img width={300} height={250} alt="ソーラーパートナーズ 太陽光発電と蓄電池の見積サイト" src="https://www24.a8.net/svt/bgt?aid=260511511351&wid=001&eno=01&mid=s00000016799001032000&mc=1" style={{ maxWidth: '100%', height: 'auto' }} />
                              </a>
                              <img width={1} height={1} src="https://www12.a8.net/0.gif?a8mat=4B3NYV+5SZ642+3LME+656YP" alt="" style={{ display: 'none' }} /><span className="text-[10px] text-gray-400 self-stretch flex items-center" style={{ writingMode: 'vertical-rl' }}>PR</span>
                            </div>
                          </div>
                        );
                        if (item.id === 'gmohikari') return (
                          <div key={item.id} className="flex flex-col gap-2">
                            {linkCard}
                            <div className="flex items-center justify-center gap-1">
                                                            <a href="https://px.a8.net/svt/ejp?a8mat=4B3NYW+NTCZ6+50+6MDJ6P" rel="nofollow noopener noreferrer" target="_blank">
                                <img width={300} height={250} alt="GMO光アクセス 光回線" src="https://www28.a8.net/svt/bgt?aid=260511512040&wid=001&eno=01&mid=s00000000018040038000&mc=1" style={{ maxWidth: '100%', height: 'auto' }} />
                              </a>
                              <img width={1} height={1} src="https://www11.a8.net/0.gif?a8mat=4B3NYW+NTCZ6+50+6MDJ6P" alt="" style={{ display: 'none' }} /><span className="text-[10px] text-gray-400 self-stretch flex items-center" style={{ writingMode: 'vertical-rl' }}>PR</span>
                            </div>
                          </div>
                        );
                        if (item.id === 'nurokari') return (
                          <div key={item.id} className="flex flex-col gap-2">
                            {linkCard}
                            <div className="flex items-center justify-center gap-1">
                                                            <a href="https://px.a8.net/svt/ejp?a8mat=4B3NYW+YJ5V6+2VMU+656YP" rel="nofollow noopener noreferrer" target="_blank">
                                <img width={300} height={250} alt="NURO光 最大75,000円キャッシュバック" src="https://www26.a8.net/svt/bgt?aid=260511512058&wid=001&eno=01&mid=s00000013431001032000&mc=1" style={{ maxWidth: '100%', height: 'auto' }} />
                              </a>
                              <img width={1} height={1} src="https://www16.a8.net/0.gif?a8mat=4B3NYW+YJ5V6+2VMU+656YP" alt="" style={{ display: 'none' }} /><span className="text-[10px] text-gray-400 self-stretch flex items-center" style={{ writingMode: 'vertical-rl' }}>PR</span>
                            </div>
                          </div>
                        );
                        if (item.id === 'reform_pro') return (
                          <div key={item.id} className="flex flex-col gap-2">
                            {linkCard}
                            <div className="flex items-center justify-center gap-1">
                                                            <a href="https://px.a8.net/svt/ejp?a8mat=4B3IIL+1SBLE+46CI+609HT" rel="nofollow noopener noreferrer" target="_blank">
                                <img width={350} height={160} alt="リフォーム比較プロ" src="https://www20.a8.net/svt/bgt?aid=260504445003&wid=001&eno=01&mid=s00000019485001009000&mc=1" style={{ maxWidth: '100%', height: 'auto' }} />
                              </a>
                              <img width={1} height={1} src="https://www13.a8.net/0.gif?a8mat=4B3IIL+1SBLE+46CI+609HT" alt="" style={{ display: 'none' }} /><span className="text-[10px] text-gray-400 self-stretch flex items-center" style={{ writingMode: 'vertical-rl' }}>PR</span>
                            </div>
                          </div>
                        );
                        if (item.id === 'renoveru') return (
                          <div key={item.id} className="flex flex-col gap-2">
                            {linkCard}
                            <div className="flex items-center justify-center gap-1">
                                                            <a href="https://px.a8.net/svt/ejp?a8mat=4B3NYW+XCANM+303O+60WN5" rel="nofollow noopener noreferrer" target="_blank">
                                <img width={300} height={250} alt="リノベる。中古マンション＋リノベーション" src="https://www20.a8.net/svt/bgt?aid=260511512056&wid=001&eno=01&mid=s00000014010001012000&mc=1" style={{ maxWidth: '100%', height: 'auto' }} />
                              </a>
                              <img width={1} height={1} src="https://www19.a8.net/0.gif?a8mat=4B3NYW+XCANM+303O+60WN5" alt="" style={{ display: 'none' }} /><span className="text-[10px] text-gray-400 self-stretch flex items-center" style={{ writingMode: 'vertical-rl' }}>PR</span>
                            </div>
                          </div>
                        );
                        return (
                          <a key={item.id} href={linkUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="block w-full text-left bg-white border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors shadow-sm">
                            <p className="text-sm font-medium text-gray-800 leading-snug">{item.label}</p>
                            <p className="text-xs text-gray-700 font-medium mt-0.5 leading-snug">{item.note}</p>
                            <span className={`inline-block mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${item.linkCls}`}>{item.linkLabel} →</span>
                          </a>
                        );
                      }

                      return (
                        <button
                          key={item.id}
                          onClick={() => item.mapLayer ? onToggleLayer(item.mapLayer) : toggleCheck(item.id)}
                          className={`text-left w-full rounded-xl p-3 border shadow-sm transition-all ${baseCls}`}
                        >
                          <div className="flex items-start gap-2">
                            <div className={checkboxCls}>{isChecked && '✓'}</div>
                            <div>
                              <p className={`text-sm font-medium leading-snug ${labelCls}`}>{item.label}</p>
                              <p className="text-xs text-gray-700 font-medium mt-0.5 leading-tight">{dynamicNote}</p>
                              {convHint && (
                                <p className={`text-xs mt-1.5 font-semibold ${convHint.good ? 'text-blue-700' : 'text-red-500'}`}>
                                  {convHint.mark} {convHint.text}
                                </p>
                              )}
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

                  {/* インズウェブ アフィリエイト */}
                  {category === '火災保険を比較する' && (
                    <div className="mt-3 flex items-center justify-center gap-1">
                                            <a href="https://px.a8.net/svt/ejp?a8mat=4B3IIK+FFHG6Q+2PS+2BDJK1" rel="nofollow noopener noreferrer" target="_blank">
                        <img width={300} height={250} alt="インズウェブ 火災保険一括見積もり" src="https://www20.a8.net/svt/bgt?aid=260504444933&wid=001&eno=01&mid=s00000000352014004000&mc=1" style={{ maxWidth: '100%', height: 'auto' }} />
                      </a>
                      <img width={1} height={1} src="https://www10.a8.net/0.gif?a8mat=4B3IIK+FFHG6Q+2PS+2BDJK1" alt="" style={{ display: 'none' }} /><span className="text-[10px] text-gray-400 self-stretch flex items-center" style={{ writingMode: 'vertical-rl' }}>PR</span>
                    </div>
                  )}


                  {/* 宅配ボックス名品館 アフィリエイト */}
                  {category === '宅配ボックスを設置する' && (
                    <div className="mt-3 flex items-center justify-center gap-1">
                                            <a href="https://px.a8.net/svt/ejp?a8mat=4B3NYV+679KMQ+5TXI+5Z6WX" rel="nofollow noopener noreferrer" target="_blank">
                        <img width={300} height={250} alt="宅配ボックス名品館" src="https://www29.a8.net/svt/bgt?aid=260511511375&wid=001&eno=01&mid=s00000027207001004000&mc=1" style={{ maxWidth: '100%', height: 'auto' }} />
                      </a>
                      <img width={1} height={1} src="https://www15.a8.net/0.gif?a8mat=4B3NYV+679KMQ+5TXI+5Z6WX" alt="" style={{ display: 'none' }} /><span className="text-[10px] text-gray-400 self-stretch flex items-center" style={{ writingMode: 'vertical-rl' }}>PR</span>
                    </div>
                  )}

                  {/* ヌリカエ アフィリエイト */}
                  {category === '外壁・屋根塗装を比較する' && (
                    <div className="mt-3 flex items-center justify-center gap-1">
                                            <a href="https://px.a8.net/svt/ejp?a8mat=4B3IIL+LGDU+410U+5ZMCH" rel="nofollow noopener noreferrer" target="_blank">
                        <img width={300} height={250} alt="ヌリカエ 外壁塗装" src="https://www27.a8.net/svt/bgt?aid=260504445001&wid=001&eno=01&mid=s00000018795001006000&mc=1" style={{ maxWidth: '100%', height: 'auto' }} />
                      </a>
                      <img width={1} height={1} src="https://www19.a8.net/0.gif?a8mat=4B3IIL+LGDU+410U+5ZMCH" alt="" style={{ display: 'none' }} /><span className="text-[10px] text-gray-400 self-stretch flex items-center" style={{ writingMode: 'vertical-rl' }}>PR</span>
                    </div>
                  )}

                  {/* タカラスタンダード アフィリエイト（リフォームカテゴリ） */}
                  {category === 'リフォームを検討する' && (
                    <div className="mt-3 space-y-3">
                      {/* タカラスタンダード チェック項目風カード */}
                      <a href="https://px.a8.net/svt/ejp?a8mat=4B3IIL+16VZM+4S2Q+60H7L" rel="nofollow noopener noreferrer" target="_blank" className="block w-full text-left bg-white border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors shadow-sm">
                        <p className="text-sm font-medium text-gray-800 leading-snug">タカラスタンダードのショールームで実物を確認した</p>
                        <p className="text-xs text-gray-700 font-medium mt-0.5 leading-snug">ホーローキッチン・浴室を実際に見て触れて比較。全国200ヵ所以上のショールームで無料体験</p>
                        <span className="inline-block mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">タカラスタンダード →</span>
                      </a>
                      {/* タカラスタンダード バナー */}
                      <div className="flex items-center justify-center gap-1">
                                                <a href="https://px.a8.net/svt/ejp?a8mat=4B3IIL+16VZM+4S2Q+60H7L" rel="nofollow noopener noreferrer" target="_blank">
                          <img width={300} height={250} alt="タカラスタンダード ホーローキッチン" src="https://www20.a8.net/svt/bgt?aid=260504445002&wid=001&eno=01&mid=s00000022301001010000&mc=1" style={{ maxWidth: '100%', height: 'auto' }} />
                        </a>
                        <img width={1} height={1} src="https://www14.a8.net/0.gif?a8mat=4B3IIL+16VZM+4S2Q+60H7L" alt="" style={{ display: 'none' }} /><span className="text-[10px] text-gray-400 self-stretch flex items-center" style={{ writingMode: 'vertical-rl' }}>PR</span>
                      </div>
                    </div>
                  )}

                  {/* ノムコム アフィリエイト */}
                  {category === '住み替えを検討する' && (
                    <div className="mt-3 flex items-center justify-center gap-1">
                                            <a href="https://px.a8.net/svt/ejp?a8mat=4B3NYW+N7XDE+5M76+BXB8X" rel="nofollow noopener noreferrer" target="_blank">
                        <img width={300} height={250} alt="ノムコム 不動産売却査定" src="https://www28.a8.net/svt/bgt?aid=260511512039&wid=001&eno=01&mid=s00000026205002003000&mc=1" style={{ maxWidth: '100%', height: 'auto' }} />
                      </a>
                      <img width={1} height={1} src="https://www19.a8.net/0.gif?a8mat=4B3NYW+N7XDE+5M76+BXB8X" alt="" style={{ display: 'none' }} /><span className="text-[10px] text-gray-400 self-stretch flex items-center" style={{ writingMode: 'vertical-rl' }}>PR</span>
                    </div>
                  )}


                </div>
                );
              })}

              <button
                onClick={handleSave}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700"
              >
                この物件を保存
              </button>
              <button
                onClick={() => setShowReport(true)}
                className="w-full py-2.5 bg-white border border-gray-400 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50"
              >
                📄 PDFレポートとして出力
              </button>
              <p className="text-xs text-gray-700 font-medium text-center">
                ※ 価格は国交省REINFOLIB。人口は国勢調査（e-Stat）。チェックはページを閉じるとリセットされます
              </p>
              <a
                href="https://note.com/iescore"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 mb-4 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#41C9B4' }}
              >
                <Image src="https://note.com/favicon.ico" alt="note" width={16} height={16} className="rounded-sm" />
                <span>マイホーム購入の基礎知識をnoteで読む</span>
              </a>

              {/* コメント・フィードバックフォーム */}
              <div className="mt-4 mb-2">
                <p className="text-sm font-semibold text-gray-700 mb-2">ご意見・ご要望</p>
                {fbStatus === 'sent' ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 text-sm text-green-700 text-center">
                    送信しました。ありがとうございます！
                  </div>
                ) : (
                  <form onSubmit={handleFeedbackSubmit} className="flex flex-col gap-2">
                    <input
                      type="text"
                      placeholder="お名前（任意）"
                      value={fbName}
                      onChange={e => setFbName(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-teal-400"
                    />
                    <input
                      type="email"
                      placeholder="メールアドレス（返信希望の場合）"
                      value={fbEmail}
                      onChange={e => setFbEmail(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-teal-400"
                    />
                    <textarea
                      placeholder="ご意見・ご要望・お気づきの点など"
                      value={fbMessage}
                      onChange={e => setFbMessage(e.target.value)}
                      rows={4}
                      required
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-teal-400 resize-none"
                    />
                    {fbStatus === 'error' && (
                      <p className="text-xs text-red-500">送信に失敗しました。時間をおいて再度お試しください。</p>
                    )}
                    <button
                      type="submit"
                      disabled={fbStatus === 'sending' || !fbMessage.trim()}
                      className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-50 transition-colors"
                    >
                      {fbStatus === 'sending' ? '送信中…' : '送信する'}
                    </button>
                  </form>
                )}
              </div>
          </div>

          <div className={activeTab !== 'saved' ? 'hidden' : ''}>
            <SavedList
              saved={saved}
              onSelect={handleSelectSaved}
              onDelete={handleDelete}
              onCompare={setCompareProps}
            />
          </div>

          {/* データソースフッター */}
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 mt-2">
            <p className="text-[10px] text-gray-400 leading-relaxed">
              データソース：国土数値情報（医療機関・学校）国土交通省 /
              不動産情報ライブラリ（REINFOLIB）国土交通省 /
              国土地理院 / 防災科研J-SHIS /
              <a href="https://express.heartrails.com/" target="_blank" rel="noopener" className="underline">HeartRails Express</a> /
              © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" className="underline">OpenStreetMap</a> contributors
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
