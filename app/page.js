import HomeLayout from './components/HomeLayout';

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
    const thumb = block.match(/<media:thumbnail[^>]*>([^<]+)<\/media:thumbnail>/i)?.[1]?.trim() ?? '';
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
  return <HomeLayout articles={articles} />;
}
