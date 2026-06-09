import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

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
    'その価格、適正ですか？地盤・ハザード成約価格利便性をまとめて無料スコア診断公的データのみ登録不要｜iescore.com';
  const [bold, regular, logoData] = await Promise.all([
    loadGoogleFont('Noto+Sans+JP', 700, text),
    loadGoogleFont('Noto+Sans+JP', 400, text),
    readFile(join(process.cwd(), 'public', 'logo.png')),
  ]);
  const logoSrc = `data:image/png;base64,${logoData.toString('base64')}`;

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
          padding: '56px 60px',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={460} height={225} alt="イエスコア" style={{ marginBottom: 28 }} />
        <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, color: '#1f2937', marginBottom: 26 }}>
          その価格、適正ですか？
        </div>
        <div style={{ display: 'flex', fontSize: 36, fontWeight: 400, color: '#374151', marginBottom: 8 }}>
          地盤・ハザード・成約価格・利便性を
        </div>
        <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, color: '#374151', marginBottom: 40 }}>
          まとめて無料スコア診断
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 27,
            fontWeight: 400,
            color: '#6b7280',
            borderTop: '2px solid #d1d5db',
            paddingTop: 22,
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
