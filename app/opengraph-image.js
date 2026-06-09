import { ImageResponse } from 'next/og';

export const alt = 'イエスコア｜その価格、適正ですか？ - マイホーム購入前の無料エリア診断';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Google Fonts から必要な文字だけのサブセットフォントを取得（軽量）
async function loadGoogleFont(font, weight, text) {
  const url = `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const resource = css.match(/src: url\((.+?)\) format/);
  if (resource) {
    const res = await fetch(resource[1]);
    if (res.status === 200) return await res.arrayBuffer();
  }
  throw new Error('failed to load font');
}

export default async function Image() {
  const text =
    'その価格、適正ですか？イエスコア地盤・ハザード成約価格利便性をまとめて無料スコア診断公的データのみ登録不要｜iescore.com';
  const [bold, regular] = await Promise.all([
    loadGoogleFont('Noto+Sans+JP', 700, text),
    loadGoogleFont('Noto+Sans+JP', 400, text),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #f0fdf4 100%)',
          fontFamily: 'NotoSansJP',
          padding: '60px',
        }}
      >
        <div style={{ display: 'flex', fontSize: 46, fontWeight: 700, color: '#1f2937', marginBottom: 20 }}>
          その価格、適正ですか？
        </div>
        <div style={{ display: 'flex', fontSize: 110, fontWeight: 700, color: '#2563eb', letterSpacing: '2px', marginBottom: 28 }}>
          イエスコア
        </div>
        <div style={{ display: 'flex', fontSize: 38, fontWeight: 400, color: '#374151', marginBottom: 12 }}>
          地盤・ハザード・成約価格・利便性を
        </div>
        <div style={{ display: 'flex', fontSize: 38, fontWeight: 700, color: '#374151', marginBottom: 44 }}>
          まとめて無料スコア診断
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 28,
            fontWeight: 400,
            color: '#6b7280',
            borderTop: '2px solid #d1d5db',
            paddingTop: 24,
          }}
        >
          公的データのみ・登録不要　｜　iescore.com
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'NotoSansJP', data: bold, weight: 700, style: 'normal' },
        { name: 'NotoSansJP', data: regular, weight: 400, style: 'normal' },
      ],
    }
  );
}
