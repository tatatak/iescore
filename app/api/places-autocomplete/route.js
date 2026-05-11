import { NextResponse } from 'next/server';

const KEY = process.env.GOOGLE_PLACES_API_KEY;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input');
  const sessiontoken = searchParams.get('sessiontoken') || '';

  if (!input || !KEY) return NextResponse.json({ predictions: [], status: 'ERROR' });

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${KEY}&language=ja&components=country:jp&types=geocode&sessiontoken=${sessiontoken}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ predictions: [], status: 'ERROR' });
  }
}
