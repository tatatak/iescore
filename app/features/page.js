import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: '機能一覧 | イエスコア',
  description: 'イエスコアの全機能をご紹介。成約価格スコア・地盤スコア・ハザードリスク・利便性スコア・住宅ローンシミュレーター・資産価値試算・AI診断など、マイホーム購入に必要な情報がすべて無料で揃います。',
  alternates: {
    canonical: 'https://www.iescore.com/features',
  },
  openGraph: {
    title: '機能一覧 | イエスコア',
    description: 'マイホーム購入に必要な情報がすべて無料で揃う、イエスコアの全機能をご紹介。',
    url: 'https://www.iescore.com/features',
  },
};

const features = [
  {
    icon: '📊',
    title: '成約価格スコア',
    badge: 'マンション・戸建て',
    description: '国土交通省が公開する実際の取引データ（REINFOLIB）をもとに、エリアの成約価格水準を10点満点でスコア表示します。',
    details: [
      'マンションは築年代別（旧耐震・新耐震・2000年代・2011年以降）に分類',
      '戸建ては直近20年以内築の成約価格・坪単価を集計',
      'P25・P50（中央値）・P75の価格帯を表示',
      '直近3年分の実取引データを使用',
    ],
  },
  {
    icon: '🌏',
    title: '地盤スコア',
    badge: 'マンション・戸建て',
    description: '防災科学技術研究所（J-SHIS）の地盤データをもとに、地震時の揺れやすさ・地盤の硬さをスコア化します。',
    details: [
      'AVS30（平均せん断波速度）とARV（増幅率）を組み合わせて算出',
      '地盤の種類（火山灰台地・沖積低地・洪積台地など）も表示',
      '液状化リスクも参照可能',
    ],
  },
  {
    icon: '🌊',
    title: 'ハザードリスクスコア',
    badge: 'マンション・戸建て',
    description: '洪水・土砂崩れ・津波・高潮の4種類のリスクを個別にスコア化。地図上でリスクエリアを視覚的に確認することもできます。',
    details: [
      '洪水浸水深・土砂災害警戒区域・津波浸水想定・高潮浸水想定に対応',
      '地図レイヤーをON/OFFして視覚的にリスクエリアを確認',
      '国土地理院・各市区町村の公式ハザードマップデータを使用',
    ],
  },
  {
    icon: '🚉',
    title: '利便性スコア',
    badge: 'マンション・戸建て',
    description: '最寄り駅・スーパー・病院・コンビニなどの生活施設までの距離と充実度を総合的にスコア化します。',
    details: [
      '最寄り駅の徒歩分数を算出（徒歩5分以内で高スコア）',
      'スーパー・コンビニ・病院・薬局・公園の分布を確認',
      '地図上にPOI（施設）をピンで表示し、クリックで詳細確認',
      '複数路線への乗り換え利便性も考慮',
    ],
  },
  {
    icon: '🏦',
    title: '住宅ローンシミュレーター',
    badge: 'マンション・戸建て',
    description: '物件価格・頭金・金利・返済期間を入力して、毎月の返済額・総返済額・総支払利息を瞬時に計算します。',
    details: [
      '変動金利（コールレートベース）・固定金利（フラット35）の最新金利を自動取得',
      '変動・固定を並べて比較表示',
      'エリアの成約相場と購入価格を比較してコスト診断',
      '「お得」「適正」「割高」の3段階で評価',
    ],
  },
  {
    icon: '🏡',
    title: '戸建て 資産価値試算',
    badge: '戸建て専用',
    description: '10年後の戸建て売却価格の目安を土地・建物それぞれで試算します。エリアの地価トレンドと建物の減価を組み合わせた実態に近い推計です。',
    details: [
      '土地価格：国土交通省 公示地価データ（直近5年の変動率）で複利計算',
      '建物価格：構造別法定耐用年数（木造22年・軽量鉄骨19年・RC47年）で定額法減価',
      '旗竿地・角地・日当たりなど土地条件を補正して計算',
      '10年後の推定売却価格と利益・損失を表示',
    ],
  },
  {
    icon: '📍',
    title: '騒音リスク診断',
    badge: 'マンション・戸建て',
    description: '最寄りの線路・主要道路との距離を算出し、騒音リスクをスコア化。地図上に線路・道路のハイライト表示もできます。',
    details: [
      '最寄り線路・高速道路・幹線道路・主要道路の距離を算出',
      '線路まで50m未満は騒音リスク大として評価',
      '地図レイヤーで線路・道路をグロー表示',
    ],
  },
  {
    icon: '🤖',
    title: 'AI診断プロンプト生成',
    badge: 'マンション・戸建て',
    description: 'スコアデータをまとめたプロンプトをワンクリックで生成。ChatGPT・Claudeなどに貼り付けるだけで、AIによる詳細な不動産アドバイスが受けられます。',
    details: [
      '成約価格・地盤・ハザード・利便性・騒音リスクをひとつのプロンプトに集約',
      '「不動産コンサルタント」役割付きプロンプトで精度の高い回答を誘導',
      'コピーボタンひとつでクリップボードにコピー',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="イエスコア" width={1396} height={684} className="h-10 w-auto" priority />
          </Link>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← エリア診断を使う
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">機能一覧</h1>
        <p className="text-gray-500 text-sm mb-8">
          イエスコアで使えるすべての機能を紹介します。すべて<strong className="text-gray-700">完全無料・登録不要</strong>でご利用いただけます。
        </p>

        <div className="space-y-5">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl shrink-0">{f.icon}</span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-gray-900 text-lg">{f.title}</h2>
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{f.badge}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{f.description}</p>
                </div>
              </div>
              <ul className="space-y-1.5 pl-2">
                {f.details.map((d) => (
                  <li key={d} className="text-sm text-gray-500 flex items-start gap-2">
                    <span className="text-blue-400 shrink-0 mt-0.5">✓</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-blue-50 rounded-2xl p-6 text-center">
          <p className="text-blue-800 font-bold text-lg mb-1">実際に診断してみましょう</p>
          <p className="text-blue-600 text-sm mb-4">住所・駅名を入力するだけ。完全無料・登録不要です。</p>
          <Link
            href="/"
            className="inline-block bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
          >
            無料エリア診断を使う →
          </Link>
        </div>
      </main>

      <footer className="text-center text-xs text-gray-400 py-8 space-y-1">
        <div>
          <Link href="/faq" className="hover:underline">よくある質問</Link>
          {' '}|{' '}
          <Link href="/about" className="hover:underline">サービスについて</Link>
        </div>
        <div>© {new Date().getFullYear()} アクアオーブ株式会社</div>
      </footer>
    </div>
  );
}
