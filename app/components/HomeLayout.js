'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function HomeLayout({ articles }) {
  const [compact, setCompact] = useState(false);
  const scrollRef = useRef(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCompact(el.scrollTop > 40);
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50">

      {/* CTAカード */}
      <div className="shrink-0 px-4 pt-4 pb-3 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <Link href="/map" className="block group">
            <div className="bg-white rounded-2xl shadow-xl flex flex-col items-center text-center overflow-hidden transition-all duration-300"
              style={{ padding: compact ? '12px 20px' : '20px 20px' }}
            >
              <Image
                src="/logo.png"
                alt="イエスコア"
                width={1396}
                height={684}
                priority
                style={{ width: 'auto', height: compact ? '28px' : '44px', transition: 'height 0.3s' }}
              />

              {/* 縮小時に隠れる部分 */}
              <div className={`w-full flex flex-col items-center gap-2 overflow-hidden transition-all duration-300 ${compact ? 'max-h-0 opacity-0 mt-0' : 'max-h-40 opacity-100 mt-2.5'}`}>
                <p className="text-gray-800 font-bold leading-snug" style={{ fontSize: 'clamp(0.9rem, 5vw, 1.1rem)' }}>
                  「ここに住んで、本当に大丈夫？」
                </p>
                <p className="text-blue-600 font-semibold text-base leading-snug">
                  その不安、イエスコアが答えます。
                </p>
                <p className="text-sm text-gray-600 font-medium">🏢 マンション・🏡 戸建て</p>
              </div>

              <div className={`w-full bg-blue-600 text-white font-bold rounded-xl text-center transition-all duration-300 ${compact ? 'text-xs py-1.5 mt-2' : 'text-sm py-2.5 mt-2.5'}`}>
                タップしてエリアを調べる →
              </div>

              <div className={`overflow-hidden transition-all duration-300 ${compact ? 'max-h-0 opacity-0' : 'max-h-8 opacity-100 mt-1'}`}>
                <p className="text-xs text-gray-400">完全無料・登録不要</p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* 記事一覧: スクロール領域 */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 pb-8 flex flex-col gap-4">

          <div className="flex items-center gap-2 pt-2">
            <h1 className="text-sm font-bold text-gray-700">📝 マイホーム購入コラム</h1>
            <a href="https://note.com/iescore" className="text-xs text-gray-400 hover:text-blue-500 ml-auto">
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
                className="block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group"
              >
                {a.thumb && (
                  <div className="w-full aspect-[2/1] bg-gray-100 overflow-hidden">
                    <img
                      src={a.thumb}
                      alt=""
                      className="w-full h-full object-cover"
                      loading={i < 2 ? 'eager' : 'lazy'}
                    />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-[11px] text-gray-400 mb-1">{a.date}</p>
                  <h2 className="text-sm font-bold text-gray-800 leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
                    {a.title}
                  </h2>
                </div>
              </a>
            ))
          )}

          <a
            href="https://note.com/iescore"
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
