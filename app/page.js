import Image from 'next/image';
import Link from 'next/link';

export const revalidate = 3600;

export const metadata = {
  title: 'イエスコア｜マイホーム購入前に知っておきたいこと',
  description: '家を買う前に知っておきたい知識と、エリアの地盤・ハザード・成約価格・将来価値を無料でスコア表示するサービス。',
};

function parseRSS(xml) {
  const items = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
      return m ? m[1].trim() : '';
    };
    const thumb = block.match(/<media:thumbnail[^>]+url="([^"]+)"/i)?.[1] ?? '';
    const link = block.match(/<link>([^<]+)<\/link>/i)?.[1]?.trim() ?? '';
    const raw = get('description');
    const excerpt = raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').replace(/続きをみる/g, '').trim().slice(0, 100);
    const dateStr = get('pubDate');
    const date = dateStr ? new Date(dateStr).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    items.push({ title: get('title'), link, thumb, excerpt, date });
  }
  return items;
}

async function getArticles() {
  try {
    const res = await fetch('https://note.com/iescore/rss', {
      next: { revalidate: 3600 },
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return [];
    return parseRSS(await res.text());
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const articles = await getArticles();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between sticky top-0 z-10">
        <Image src="/logo.png" alt="イエスコア" width={1396} height={684} className="h-9 w-auto" priority style={{ width: 'auto' }} />
        <Link
          href="/map"
          className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          エリアを調べる →
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">

        {/* サービス紹介カード */}
        <Link href="/map" className="block group">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-md group-hover:shadow-lg transition-shadow">
            <p className="text-base font-bold leading-snug mb-1">
              「ここに住んで、本当に大丈夫？」
            </p>
            <p className="text-blue-100 text-sm mb-4">
              その不安、イエスコアが答えます。
            </p>
            <div className="grid grid-cols-2 gap-1.5 mb-5 text-xs text-blue-100">
              {['🌊 水害・地盤リスク', '📊 成約価格の相場', '📈 将来の資産価値', '🚉 駅・スーパー・病院'].map(t => (
                <div key={t} className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5">{t}</div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-200">完全無料・登録不要</span>
              <span className="bg-white text-blue-600 font-bold text-sm px-4 py-2 rounded-xl group-hover:bg-blue-50 transition-colors">
                今すぐ調べる →
              </span>
            </div>
          </div>
        </Link>

        {/* 記事一覧 */}
        <div className="flex items-center gap-2 mt-2">
          <h1 className="text-sm font-bold text-gray-700">📝 マイホーム購入コラム</h1>
          <a href="https://note.com/iescore" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-blue-500 ml-auto">
            noteで全記事 →
          </a>
        </div>

        {articles.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">記事を読み込み中です…</p>
        ) : (
          articles.map((a, i) => (
            <a
              key={i}
              href={a.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group"
            >
              {a.thumb && (
                <div className="w-full aspect-[2/1] relative bg-gray-100 overflow-hidden">
                  <img
                    src={a.thumb}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    loading={i < 2 ? 'eager' : 'lazy'}
                  />
                </div>
              )}
              <div className="p-4">
                <p className="text-[11px] text-gray-400 mb-1">{a.date}</p>
                <h2 className="text-sm font-bold text-gray-800 leading-snug group-hover:text-blue-600 transition-colors mb-1.5 line-clamp-2">
                  {a.title}
                </h2>
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                  {a.excerpt}…
                </p>
              </div>
            </a>
          ))
        )}

        <a
          href="https://note.com/iescore"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3 text-sm text-gray-500 hover:text-blue-600 border border-gray-200 rounded-xl bg-white transition-colors"
        >
          📝 noteで全記事を読む
        </a>

      </main>

      <footer className="text-center text-xs text-gray-400 py-6 space-x-4">
        <Link href="/about" className="hover:underline">運営会社</Link>
        <Link href="/faq" className="hover:underline">よくある質問</Link>
        <Link href="/map" className="hover:underline">エリア診断</Link>
      </footer>
    </div>
  );
}
