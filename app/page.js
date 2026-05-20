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
    <div className="flex flex-col h-[100dvh] bg-gray-50">

      {/* CTAカード: 常時固定表示 */}
      <div className="shrink-0 px-4 pt-4 pb-3 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <Link href="/map" className="block group">
            <div className="bg-white rounded-2xl shadow-xl p-5 flex flex-col items-center gap-2.5 group-hover:shadow-2xl transition-shadow text-center">
              <Image src="/logo.png" alt="イエスコア" width={1396} height={684} className="h-11 w-auto" priority style={{ width: 'auto' }} />
              <p className="text-gray-800 font-bold leading-snug" style={{ fontSize: 'clamp(0.9rem, 5vw, 1.1rem)' }}>
                「ここに住んで、本当に大丈夫？」
              </p>
              <p className="text-blue-600 font-semibold text-sm leading-snug -mt-1">
                その不安、イエスコアが答えます。
              </p>
              <p className="text-sm text-gray-600 font-medium">🏢 マンション・🏡 戸建て</p>
              <div className="w-full bg-blue-600 text-white text-sm font-bold rounded-xl px-4 py-2.5 text-center">
                タップしてエリアを調べる →
              </div>
              <p className="text-xs text-gray-400">完全無料・登録不要</p>
            </div>
          </Link>
        </div>
      </div>

      {/* 記事一覧: スクロール領域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 pb-8 flex flex-col gap-4">

          <div className="flex items-center gap-2 pt-2">
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
                  <div className="w-full aspect-[2/1] bg-gray-100 overflow-hidden">
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

          <footer className="text-center text-xs text-gray-400 pt-2 pb-4 space-x-4">
            <Link href="/about" className="hover:underline">運営会社</Link>
            <Link href="/faq" className="hover:underline">よくある質問</Link>
            <Link href="/map" className="hover:underline">エリア診断</Link>
          </footer>
        </div>
      </div>

    </div>
  );
}
