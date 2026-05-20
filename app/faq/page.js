import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'よくある質問（FAQ）| イエスコア',
  description: 'イエスコアに関するよくある質問をまとめています。サービスの使い方・データソース・スコアの計算方法・料金など、疑問点をまとめて解決できます。',
  alternates: {
    canonical: 'https://www.iescore.com/faq',
  },
  openGraph: {
    title: 'よくある質問（FAQ）| イエスコア',
    description: 'イエスコアに関するよくある質問をまとめています。',
    url: 'https://www.iescore.com/faq',
  },
};

const faqs = [
  {
    q: 'イエスコアとはどんなサービスですか？',
    a: 'イエスコアは、マイホーム購入を検討している方向けの無料エリア診断サービスです。住所・駅名・エリア名を入力するだけで、不動産の成約価格水準・地盤の強さ・ハザードリスク・駅や商業施設などの利便性を10点満点でスコア表示します。会員登録不要で、スマートフォン・PCを問わず無料でご利用いただけます。',
  },
  {
    q: 'マンションと戸建てで使い方は違いますか？',
    a: 'はい、それぞれに最適化された診断を行います。マンションモードでは築年代別の成約単価（万円/㎡）・管理費・修繕積立金の妥当性診断・住宅ローンシミュレーターを提供します。戸建てモードでは直近20年以内築の成約価格・土地面積あたりの平米単価・旗竿地や角地などの土地条件補正・10年後の資産価値試算を提供します。',
  },
  {
    q: '地盤スコアはどのように計算されていますか？',
    a: '防災科学技術研究所（防災科研）のJ-SHISが提供する表層地盤データを使用しています。地盤の硬さを示すAVS30（平均せん断波速度）と揺れやすさを示すARV（増幅率）を組み合わせてスコアを算出します。住宅が建てられる現実的な地盤範囲（70〜400m/s）を基準に設計しており、火山灰台地・沖積低地・洪積台地など地盤の種類も参考表示します。',
  },
  {
    q: '成約価格のデータはどこから取得していますか？',
    a: '国土交通省が提供する不動産情報ライブラリ（REINFOLIB）の成約価格データを使用しています。直近3年分の実際の取引データを市区町村単位で取得します。マンションは築年代別（旧耐震・新耐震・2000年代・2011年以降）に分類し、戸建ては直近20年以内築に絞り込んで統計を算出します。',
  },
  {
    q: 'ハザードリスクは何のデータを使っていますか？',
    a: '国土地理院および各市区町村が公表するハザードマップポータルサイトのデータを使用しています。洪水・土砂災害・津波・高潮の各リスクレベルを地点ごとに確認できます。地盤液状化リスクについても防災科研のデータを参照しています。',
  },
  {
    q: '住宅ローンシミュレーターで何がわかりますか？',
    a: '物件価格・頭金・金利・返済期間を入力すると、毎月の返済額（変動・固定）と総返済額・総支払利息を計算できます。変動金利はコールレート、固定金利はフラット35の最新金利を自動取得して初期表示します。エリアの成約相場と入力価格を比較して「お得」「割高」などのコスト診断も行います。',
  },
  {
    q: '戸建ての10年後の資産価値試算はどう計算していますか？',
    a: '土地価格は国土交通省の公示地価データ（直近5年間の変動率）をもとに複利計算で10年後の価格を推計します。建物価格は構造別の法定耐用年数（木造22年・軽量鉄骨19年・RC47年など）を用いた定額法で減価計算し、法定耐用年数超えの建物は0円として計算します。土地と建物の合計が10年後の売却価格の目安です。',
  },
  {
    q: '旗竿地や角地など土地の形状は価格に影響しますか？',
    a: 'はい、土地の条件は取引価格に大きく影響します。イエスコアでは戸建ての価格シミュレーターに土地条件の補正機能を搭載しています。旗竿地（−25%）・角地（+8%）・日当たり良好（+4%）・傾斜地・高低差あり（−12%）・前面道路4m未満（−10%）を選択すると、エリアの目安価格がリアルタイムで補正されます。',
  },
  {
    q: 'イエスコアは無料で使えますか？',
    a: 'はい、すべての機能を完全無料でご利用いただけます。会員登録・ログインも不要です。スマートフォン・タブレット・PCのどのデバイスからもご利用いただけます。',
  },
  {
    q: 'スコアの精度はどの程度ですか？',
    a: '成約価格スコアは国交省の公的取引データを使用しており、市区町村単位の信頼性の高いデータです。地盤・ハザードスコアも国の機関が公表している公的データを使用しています。ただし、スコアはあくまでエリア単位の目安であり、個別物件の評価を保証するものではありません。物件購入の最終判断は必ず専門家にご相談ください。',
  },
];

export default function FaqPage() {
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">よくある質問（FAQ）</h1>
        <p className="text-gray-500 text-sm mb-8">イエスコアの使い方・データ・スコアに関するご質問にお答えします。</p>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <details key={i} className="bg-white rounded-xl border border-gray-200 group">
              <summary className="flex items-start justify-between gap-4 px-5 py-4 cursor-pointer list-none">
                <span className="font-medium text-gray-800 leading-snug">
                  <span className="text-blue-600 font-bold mr-2">Q{i + 1}.</span>
                  {faq.q}
                </span>
                <span className="text-gray-400 shrink-0 mt-0.5 group-open:rotate-180 transition-transform text-lg leading-none">▾</span>
              </summary>
              <div className="px-5 pb-5 pt-1 text-gray-600 text-sm leading-relaxed border-t border-gray-100 mt-0">
                {faq.a}
              </div>
            </details>
          ))}
        </div>

        <div className="mt-12 bg-blue-50 rounded-2xl p-6 text-center">
          <p className="text-blue-800 font-bold text-lg mb-1">実際に診断してみましょう</p>
          <p className="text-blue-600 text-sm mb-4">住所・駅名を入力するだけ。完全無料・登録不要です。</p>
          <Link
            href="/map"
            className="inline-block bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
          >
            無料エリア診断を使う →
          </Link>
        </div>
      </main>

      <footer className="text-center text-xs text-gray-400 py-8 space-y-1">
        <div>
          <Link href="/about" className="hover:underline">サービスについて</Link>
          {' '}|{' '}
          <Link href="/features" className="hover:underline">機能一覧</Link>
        </div>
        <div>© {new Date().getFullYear()} アクアオーブ株式会社</div>
      </footer>
    </div>
  );
}
