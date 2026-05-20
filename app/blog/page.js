import Image from 'next/image';
import Link from 'next/link';

export const revalidate = 3600;

export const metadata = {
  title: 'マイホーム購入コラム | イエスコア',
  description: '家を買う前に知っておきたい知識、地価・相場・リスクの読み方を解説するコラム一覧です。',
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
    const excerpt = raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').replace(/続きをみる/g, '').trim().slice(0, 120);
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
    const xml = await res.text();
    return parseRSS(xml);
  } catch {
    return [];
  }
}

export default async function BlogPage() {
  const articles = await getArticles();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href="/">
          <Image src="/logo.png" alt="イエスコア" width={1396} height={684} className="h-9 w-auto" priority style={{ width: 'auto' }} />
        </Link>
        <span className="text-gray-400 text-sm">|</span>
        <span className="text-sm font-medium text-gray-700">マイホーム購入コラム</span>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-gray-800 mb-1">マイホーム購入コラム</h1>
        <p className="text-sm text-gray-500 mb-6">
          家を買う前に知っておきたい知識を、データと事例で解説します。
          元記事は <a href="https://note.com/iescore" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">note.com/iescore</a> で公開しています。
        </p>

        {articles.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-12">記事を読み込み中です…</p>
        ) : (
          <div className="flex flex-col gap-4">
            {articles.map((a, i) => (
              <a
                key={i}
                href={a.link}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white rounded-xl shadow-sm border border-gray-100 flex gap-4 p-4 hover:shadow-md transition-shadow group"
              >
                {a.thumb && (
                  <div className="shrink-0 w-24 h-16 sm:w-32 sm:h-20 relative rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={a.thumb}
                      alt=""
                      className="w-full h-full object-cover"
                      loading={i < 3 ? 'eager' : 'lazy'}
                    />
                  </div>
                )}
                <div className="flex flex-col gap-1 min-w-0">
                  <p className="text-[11px] text-gray-400">{a.date}</p>
                  <h2 className="text-sm font-bold text-gray-800 leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
                    {a.title}
                  </h2>
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 hidden sm:block">
                    {a.excerpt}…
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}

        {articles.length > 0 && (
          <div className="mt-8 text-center">
            <a
              href="https://note.com/iescore"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white text-sm rounded-full hover:bg-gray-700 transition-colors"
            >
              📝 noteで全記事を読む
            </a>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-6">
        <Link href="/" className="text-blue-500 hover:underline">← イエスコアに戻る</Link>
      </footer>
    </div>
  );
}
