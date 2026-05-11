import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getAreaBySlug, getNearbyAreas, areas } from '../data';

export const revalidate = 86400;

const BASE_URL = 'https://www.iescore.com';

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const area = getAreaBySlug(slug);
  if (!area) return {};
  const title = `${area.name}（${area.prefecture}）の不動産スコア・地盤・ハザードリスク | イエスコア`;
  const description = `${area.name}の成約価格水準・地盤スコア・洪水リスク・利便性を無料診断。${area.description.slice(0, 70)}...`;
  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/area/${area.slug}` },
    openGraph: { title, description, url: `${BASE_URL}/area/${area.slug}` },
  };
}

async function fetchScores(area) {
  const [groundRes, hazardRes, transRes] = await Promise.allSettled([
    fetch(`${BASE_URL}/api/ground?lat=${area.lat}&lng=${area.lng}`, { next: { revalidate: 86400 } }),
    fetch(`${BASE_URL}/api/hazard?lat=${area.lat}&lng=${area.lng}`, { next: { revalidate: 86400 } }),
    fetch(`${BASE_URL}/api/transactions?lat=${area.lat}&lng=${area.lng}&muniCode=${area.muniCode}&muniName=${encodeURIComponent(area.name)}`, { next: { revalidate: 86400 } }),
  ]);
  const ground = groundRes.status === 'fulfilled' && groundRes.value.ok ? await groundRes.value.json() : null;
  const hazard = hazardRes.status === 'fulfilled' && hazardRes.value.ok ? await hazardRes.value.json() : null;
  const trans  = transRes.status  === 'fulfilled' && transRes.value.ok  ? await transRes.value.json()  : null;
  return { ground, hazard, trans };
}

function ScoreBadge({ score, label }) {
  if (score == null) return null;
  const pct = score / 10;
  const cls = pct >= 0.8 ? 'bg-green-100 text-green-700 border-green-200'
    : pct >= 0.6 ? 'bg-blue-100 text-blue-700 border-blue-200'
    : pct >= 0.4 ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-red-100 text-red-700 border-red-200';
  return (
    <div className={`flex flex-col items-center rounded-xl border px-4 py-3 ${cls}`}>
      <span className="text-2xl font-bold leading-none">{score}</span>
      <span className="text-xs mt-0.5 opacity-70">/10</span>
      <span className="text-xs font-medium mt-1">{label}</span>
    </div>
  );
}

function calcGroundScore(g) {
  if (!g?.avs30) return null;
  const a = parseFloat(g.avs30);
  let base = a >= 400 ? 10 : a >= 350 ? 9 : a >= 300 ? 8 : a >= 250 ? 7
    : a >= 200 ? 6 : a >= 160 ? 5 : a >= 130 ? 4 : a >= 100 ? 3 : a >= 70 ? 2 : 1;
  if (g.arv) {
    const r = parseFloat(g.arv);
    if (r < 1.5) base = Math.min(10, base + 1);
    if (r >= 3.5) base = Math.max(1, base - 1);
  }
  return base;
}

function calcHazardScore(h) {
  if (!h) return null;
  const flood = h.flood ?? 0;
  const land  = h.landslide ?? 0;
  const tsun  = h.tsunami ?? 0;
  const worst = Math.max(flood, land, tsun);
  return worst <= 0 ? 10 : worst <= 1 ? 8 : worst <= 2 ? 6 : worst <= 3 ? 4 : 2;
}

function HazardRow({ label, value }) {
  if (value == null) return null;
  const risk = value === 0 ? { text: 'リスクなし', cls: 'text-green-700 bg-green-50' }
    : value <= 1 ? { text: '軽微', cls: 'text-blue-700 bg-blue-50' }
    : value <= 2 ? { text: '中程度', cls: 'text-amber-700 bg-amber-50' }
    : { text: '高リスク', cls: 'text-red-700 bg-red-50' };
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-gray-600">{label}</span>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${risk.cls}`}>{risk.text}</span>
    </div>
  );
}

export default async function AreaPage({ params }) {
  const { slug } = await params;
  const area = getAreaBySlug(slug);
  if (!area) notFound();

  const nearby = getNearbyAreas(area, 6);
  const { ground, hazard, trans } = await fetchScores(area);

  const groundScore = calcGroundScore(ground);
  const hazardScore = calcHazardScore(hazard);

  const condoData   = trans?.condo;
  const condoP50    = condoData?.stats?.p50 ?? condoData?.recentStats?.p50 ?? null;
  const condoUnit   = condoData?.unitStats?.p50 ?? null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${area.name}の不動産スコア・エリア診断`,
    description: area.description,
    url: `${BASE_URL}/area/${area.slug}`,
    isPartOf: { '@id': `${BASE_URL}/#website` },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="イエスコア" width={1396} height={684} className="h-10 w-auto" priority style={{ width: 'auto' }} />
          </Link>
          <Link href="/" className="text-sm text-blue-600 hover:underline">← エリア診断を使う</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* パンくず */}
        <nav className="text-xs text-gray-400 flex items-center gap-1">
          <Link href="/" className="hover:underline">イエスコア</Link>
          <span>›</span>
          <Link href="/area" className="hover:underline">エリア一覧</Link>
          <span>›</span>
          <span className="text-gray-600">{area.prefecture} {area.name}</span>
        </nav>

        {/* タイトル */}
        <section>
          <p className="text-sm text-gray-500 mb-1">{area.prefecture}</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{area.name}の不動産スコア・エリア診断</h1>
          <p className="text-gray-600 leading-relaxed text-sm">{area.description}</p>
          {area.stations.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {area.stations.map(s => (
                <span key={s} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">🚉 {s}</span>
              ))}
            </div>
          )}
        </section>

        {/* スコアサマリー */}
        {(groundScore != null || hazardScore != null) && (
          <section>
            <h2 className="text-base font-bold text-gray-700 mb-3">主要スコア（代表地点）</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {groundScore != null && <ScoreBadge score={groundScore} label="地盤スコア" />}
              {hazardScore != null && <ScoreBadge score={hazardScore} label="ハザードスコア" />}
            </div>
            <p className="text-xs text-gray-400 mt-2">※ エリア代表地点（{area.lat.toFixed(4)}, {area.lng.toFixed(4)}）の値。実際の物件住所で個別診断することをお勧めします。</p>
          </section>
        )}

        {/* 地盤詳細 */}
        {ground && (
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-3">🌏 地盤データ</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {ground.avs30 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">平均せん断波速度（AVS30）</p>
                  <p className="font-bold text-gray-800">{Math.round(parseFloat(ground.avs30))} m/s</p>
                </div>
              )}
              {ground.arv && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">揺れ増幅率（ARV）</p>
                  <p className="font-bold text-gray-800">{parseFloat(ground.arv).toFixed(2)}</p>
                </div>
              )}
              {ground.type && (
                <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                  <p className="text-xs text-gray-500 mb-0.5">地盤の種類</p>
                  <p className="font-bold text-gray-800">{ground.type}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ハザード詳細 */}
        {hazard && (
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-3">🌊 ハザードリスク</h2>
            <HazardRow label="洪水浸水リスク"   value={hazard.flood} />
            <HazardRow label="土砂災害リスク"   value={hazard.landslide} />
            <HazardRow label="津波浸水リスク"   value={hazard.tsunami} />
            <HazardRow label="高潮浸水リスク"   value={hazard.stormSurge} />
          </section>
        )}

        {/* 成約価格 */}
        {condoP50 != null && (
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-3">📊 マンション成約価格（直近3年中央値）</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">成約価格（P50）</p>
                <p className="font-bold text-gray-800">{condoP50.toLocaleString()}万円</p>
              </div>
              {condoUnit != null && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">坪単価（P50）</p>
                  <p className="font-bold text-gray-800">{condoUnit.toLocaleString()}万円/坪</p>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">出典: 国土交通省 不動産情報ライブラリ（REINFOLIB）</p>
          </section>
        )}

        {/* CTA */}
        <section className="bg-blue-50 rounded-2xl p-6 text-center">
          <p className="text-blue-800 font-bold text-lg mb-1">{area.name}の物件をより詳しく診断する</p>
          <p className="text-blue-600 text-sm mb-4">住所・マンション名を入力すると地盤・ハザード・利便性・成約価格を10点満点でスコア表示します。完全無料・登録不要。</p>
          <Link
            href={`/?q=${encodeURIComponent(area.name)}`}
            className="inline-block bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
          >
            {area.name}でエリア診断を使う →
          </Link>
        </section>

        {/* 近隣エリア */}
        {nearby.length > 0 && (
          <section>
            <h2 className="text-base font-bold text-gray-700 mb-3">近隣エリアのスコアを見る</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {nearby.map(a => (
                <Link
                  key={a.slug}
                  href={`/area/${a.slug}`}
                  className="bg-white rounded-xl border border-gray-200 p-3 text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700 transition-colors text-center"
                >
                  {a.name}
                </Link>
              ))}
            </div>
          </section>
        )}

      </main>

      <footer className="text-center text-xs text-gray-400 py-8 space-y-1">
        <div>
          <Link href="/faq" className="hover:underline">よくある質問</Link>
          {' '}|{' '}
          <Link href="/about" className="hover:underline">サービスについて</Link>
          {' '}|{' '}
          <Link href="/features" className="hover:underline">機能一覧</Link>
        </div>
        <div>© {new Date().getFullYear()} アクアオーブ株式会社</div>
      </footer>
    </div>
  );
}
