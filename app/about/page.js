import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'イエスコアについて | マイホーム購入前の無料エリア診断',
  description: 'イエスコアは、国土交通省・防災科研などの公的データを使い、マイホーム購入前のエリアリスクを10点満点でスコア表示する無料サービスです。完全無料・登録不要でご利用いただけます。',
  alternates: {
    canonical: 'https://www.iescore.com/about',
  },
  openGraph: {
    title: 'イエスコアについて | マイホーム購入前の無料エリア診断',
    description: 'イエスコアは、公的データを使ったマイホーム購入前の無料エリア診断サービスです。',
    url: 'https://www.iescore.com/about',
  },
};

const dataSources = [
  {
    name: '不動産情報ライブラリ（REINFOLIB）',
    org: '国土交通省',
    use: '成約価格スコア・購入コスト診断',
    detail: '直近3年分の実際の不動産取引価格データ。マンションは築年代別、戸建ては直近20年以内築に絞り込んで使用。',
  },
  {
    name: 'J-SHIS（地震ハザードステーション）',
    org: '防災科学技術研究所',
    use: '地盤スコア',
    detail: '表層地盤の硬さ（AVS30）と揺れやすさ（ARV）のデータ。住宅地として現実的な地盤範囲を基準にスコア算出。',
  },
  {
    name: 'ハザードマップポータルサイト',
    org: '国土地理院・各市区町村',
    use: 'ハザードリスクスコア（洪水・土砂・津波・高潮）',
    detail: '全国の洪水浸水想定区域、土砂災害警戒区域、津波浸水想定エリアのデータ。',
  },
  {
    name: '公示地価データ',
    org: '国土交通省',
    use: '地価トレンド・10年後資産価値試算',
    detail: '直近5年分の地価変動率をもとに将来価格を複利計算。用途地域による補正も実施。',
  },
  {
    name: 'フラット35金利・政策金利',
    org: '住宅金融支援機構・日本銀行',
    use: '住宅ローンシミュレーター',
    detail: '最新の固定・変動金利を自動取得して初期値に反映。毎月更新。',
  },
];

export default function AboutPage() {
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

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-12">

        {/* ミッション */}
        <section>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">イエスコアについて</h1>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <p className="text-gray-700 leading-relaxed">
              <strong>イエスコア</strong>は、マイホーム購入を検討している方が「このエリアは本当に大丈夫か？」を自分で確認できるよう開発した、無料のエリア診断サービスです。
            </p>
            <p className="text-gray-700 leading-relaxed">
              不動産の成約価格・地盤リスク・ハザード情報・駅や商業施設の利便性を、国や研究機関が公表している信頼性の高い公的データをもとに集計し、<strong>10点満点のスコアとして誰でもわかりやすく表示</strong>します。
            </p>
            <p className="text-gray-700 leading-relaxed">
              マイホームは人生で最も大きな買い物のひとつです。「なんとなく良さそう」ではなく、データに基づいた安心感をもって購入判断ができる世界を目指しています。
            </p>
          </div>
        </section>

        {/* 特徴 */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">イエスコアの特徴</h2>
          <div className="grid gap-4">
            {[
              { icon: '🏛️', title: '公的データだけを使用', text: '国土交通省・防災科研・国土地理院などの公式データのみを使用。信頼性の高い情報をもとにスコアを算出します。' },
              { icon: '🆓', title: '完全無料・登録不要', text: '全機能を無料でご利用いただけます。メールアドレスの登録もログインも不要です。' },
              { icon: '📱', title: 'スマホでもPCでも', text: 'スマートフォン・タブレット・PCのどのデバイスからでも快適にご利用いただけます。' },
              { icon: '🏢🏡', title: 'マンション・戸建て両対応', text: '物件タイプに応じて最適化された診断を実施。マンションは築年代別、戸建ては土地条件の補正機能付きです。' },
            ].map(({ icon, title, text }) => (
              <div key={title} className="bg-white rounded-xl border border-gray-200 p-5 flex gap-4">
                <span className="text-2xl shrink-0">{icon}</span>
                <div>
                  <h3 className="font-bold text-gray-800 mb-1">{title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* データソース */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">使用データソース</h2>
          <div className="space-y-3">
            {dataSources.map((ds) => (
              <div key={ds.name} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-bold text-gray-800 text-sm">{ds.name}</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{ds.org}</span>
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{ds.use}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{ds.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 運営会社 */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">運営会社</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-3 pr-4 text-gray-500 whitespace-nowrap w-28">会社名</td>
                  <td className="py-3 text-gray-800 font-medium">アクアオーブ株式会社</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">サービス名</td>
                  <td className="py-3 text-gray-800">イエスコア（iescore.com）</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">サイトURL</td>
                  <td className="py-3 text-gray-800">
                    <a href="https://www.iescore.com" className="text-blue-600 hover:underline">https://www.iescore.com</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 注意事項 */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">ご利用上の注意</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800 leading-relaxed space-y-2">
            <p>・イエスコアのスコアはエリア単位の目安であり、個別物件の評価を保証するものではありません。</p>
            <p>・不動産購入の最終判断は、必ず不動産会社や専門家にご相談ください。</p>
            <p>・データは定期的に更新していますが、最新状況と一致しない場合があります。</p>
          </div>
        </section>

        {/* CTA */}
        <div className="bg-blue-50 rounded-2xl p-6 text-center">
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
          <Link href="/features" className="hover:underline">機能一覧</Link>
        </div>
        <div>© {new Date().getFullYear()} アクアオーブ株式会社</div>
      </footer>
    </div>
  );
}
