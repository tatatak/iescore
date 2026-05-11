import { Geist } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const SITE_URL = 'https://www.iescore.com';
const SITE_NAME = 'イエスコア';
const TITLE = 'イエスコア | マイホーム購入前の無料エリア診断';
const DESCRIPTION = '住所・駅名・エリアを入力するだけで、不動産成約価格・地盤・ハザードリスク・利便性を10点満点でスコア表示。住宅ローンシミュレーターと購入コスト診断も無料で使えるマイホーム購入サポートサービスです。';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['マイホーム購入', '不動産エリア診断', '地盤スコア', 'ハザードマップ', '住宅ローンシミュレーター', '成約価格', 'マンション購入', '戸建て購入', '不動産相場', 'エリア比較'],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: SITE_NAME,
    locale: 'ja_JP',
    images: [
      {
        url: '/logo.png',
        width: 1396,
        height: 684,
        alt: 'イエスコア - マイホーム購入前の無料エリア診断サービス',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/logo.png'],
  },
  alternates: {
    canonical: SITE_URL,
  },
  verification: {
    google: 'sLGkIpqSDjv-uIE3xNlGr9vd5MUxM43X4r5yh9DnNBk',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DESCRIPTION,
      inLanguage: 'ja',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      legalName: 'アクアオーブ株式会社',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`,
        width: 1396,
        height: 684,
      },
      sameAs: [],
    },
    {
      '@type': 'HowTo',
      '@id': `${SITE_URL}/#howto`,
      name: 'イエスコアの使い方',
      description: '購入予定エリアの不動産スコアを3分で診断する手順',
      totalTime: 'PT3M',
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: '物件タイプを選ぶ',
          text: '画面上部の「マンション」または「戸建て」ボタンをタップします。それぞれに最適化された診断が行われます。',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: 'エリアを検索する',
          text: '検索フォームに調べたい住所・駅名・エリア名を入力して選択します。マンションの場合はマンション名でも検索できます。',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: 'スコアを確認する',
          text: '成約価格・地盤・ハザード・利便性の各スコアと総合スコアが10点満点で表示されます。点数の根拠となるデータも一緒に確認できます。',
        },
        {
          '@type': 'HowToStep',
          position: 4,
          name: '地図レイヤーで視覚確認する',
          text: '洪水・土砂崩れ・津波・騒音などのリスクレイヤーをボタンで切り替えながら、地図上で視覚的にリスクを確認します。',
        },
        {
          '@type': 'HowToStep',
          position: 5,
          name: '住宅ローンをシミュレーションする',
          text: '物件価格・頭金・金利・返済年数を入力して毎月の返済額と総支払額を試算します。エリアの成約相場との比較診断も自動で行われます。',
        },
        {
          '@type': 'HowToStep',
          position: 6,
          name: 'AIに詳細診断を依頼する',
          text: '「この物件を自分のAIに質問する」ボタンからスコアデータをまとめたプロンプトをコピーして、ChatGPT・Claudeなどに貼り付けることで詳細なアドバイスを受けられます。',
        },
      ],
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#webapp`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DESCRIPTION,
      applicationCategory: 'RealEstateApplication',
      operatingSystem: 'Web Browser',
      inLanguage: 'ja',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'JPY',
      },
      featureList: [
        '不動産成約価格スコア（国交省REINFOLIB・直近3年データ）',
        '地盤スコア（防災科研J-SHISデータ）',
        'ハザードリスクスコア（洪水・土砂・津波・高潮）',
        '駅・バス停・スーパー・病院などの利便性スコア',
        '住宅ローンシミュレーター（変動・固定）',
        'マイホーム購入コスト診断（エリア相場との比較）',
        '10年後の資産価値試算（戸建て）',
        '土地条件補正（旗竿地・角地・日当たりなど）',
      ],
      provider: {
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
      },
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/#faq`,
      mainEntity: [
        {
          '@type': 'Question',
          name: 'イエスコアとはどんなサービスですか？',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'イエスコアは、マイホーム購入を検討している方向けの無料エリア診断サービスです。住所・駅名・エリア名を入力するだけで、不動産の成約価格水準・地盤の強さ・ハザードリスク・駅や商業施設などの利便性を10点満点でスコア表示します。会員登録不要で、スマートフォン・PC問わず無料でご利用いただけます。',
          },
        },
        {
          '@type': 'Question',
          name: 'マンションと戸建てで使い方は違いますか？',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'はい、それぞれに最適化された診断を行います。マンションモードでは築年代別の成約単価（万円/㎡）・管理費・修繕積立金の妥当性診断・住宅ローンシミュレーターを提供します。戸建てモードでは直近20年以内築の成約価格・土地面積あたりの平米単価・旗竿地や角地などの土地条件補正・10年後の資産価値試算を提供します。',
          },
        },
        {
          '@type': 'Question',
          name: '地盤スコアはどのように計算されていますか？',
          acceptedAnswer: {
            '@type': 'Answer',
            text: '防災科学技術研究所（防災科研）のJ-SHISが提供する表層地盤データを使用しています。地盤の硬さを示すAVS30（平均せん断波速度）と揺れやすさを示すARV（増幅率）を組み合わせてスコアを算出します。住宅が建てられる現実的な地盤範囲（70〜400m/s）を基準に設計しており、火山灰台地・沖積低地・洪積台地など地盤の種類も参考表示します。',
          },
        },
        {
          '@type': 'Question',
          name: '成約価格のデータはどこから取得していますか？',
          acceptedAnswer: {
            '@type': 'Answer',
            text: '国土交通省が提供する不動産情報ライブラリ（REINFOLIB）の成約価格データを使用しています。直近3年分の実際の取引データを市区町村単位で取得します。マンションは築年代別（旧耐震・新耐震・2000年代・2011年以降）に分類し、戸建ては直近20年以内築に絞り込んで統計を算出します。',
          },
        },
        {
          '@type': 'Question',
          name: 'ハザードリスクは何のデータを使っていますか？',
          acceptedAnswer: {
            '@type': 'Answer',
            text: '国土地理院および各市区町村が公表するハザードマップポータルサイトのデータを使用しています。洪水・土砂災害・津波・高潮の各リスクレベルを地点ごとに確認できます。地盤液状化リスクについても防災科研のデータを参照しています。',
          },
        },
        {
          '@type': 'Question',
          name: '住宅ローンシミュレーターで何がわかりますか？',
          acceptedAnswer: {
            '@type': 'Answer',
            text: '物件価格・頭金・金利・返済期間を入力すると、毎月の返済額（変動・固定）と総返済額・総支払利息を計算できます。変動金利はコールレート、固定金利はフラット35の最新金利を自動取得して初期表示します。エリアの成約相場と入力価格を比較して「お得」「割高」などのコスト診断も行います。',
          },
        },
        {
          '@type': 'Question',
          name: '戸建ての10年後の資産価値試算はどう計算していますか？',
          acceptedAnswer: {
            '@type': 'Answer',
            text: '土地価格は国土交通省の公示地価データ（直近5年間の変動率）をもとに複利計算で10年後の価格を推計します。建物価格は構造別の法定耐用年数（木造22年・軽量鉄骨19年・RC47年など）を用いた定額法で減価計算し、法定耐用年数超えの建物は0円として計算します。土地と建物の合計が10年後の売却価格の目安です。',
          },
        },
        {
          '@type': 'Question',
          name: '旗竿地や角地など土地の形状は価格に影響しますか？',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'はい、土地の条件は取引価格に大きく影響します。イエスコアでは戸建ての価格シミュレーターに土地条件の補正機能を搭載しています。旗竿地（−25%）・角地（+8%）・日当たり良好（+4%）・傾斜地・高低差あり（−12%）・前面道路4m未満（−10%）を選択すると、エリアの目安価格がリアルタイムで補正されます。',
          },
        },
        {
          '@type': 'Question',
          name: 'イエスコアは無料で使えますか？',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'はい、すべての機能を完全無料でご利用いただけます。会員登録・ログインも不要です。スマートフォン・タブレット・PCのどのデバイスからもご利用いただけます。',
          },
        },
      ],
    },
  ],
};

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function RootLayout({ children }) {
  return (
    <html lang="ja" className={`${geistSans.variable} h-full antialiased overflow-x-hidden`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col overflow-x-hidden w-full">{children}</body>
      {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
    </html>
  );
}
