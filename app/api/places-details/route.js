import { NextResponse } from 'next/server';

const KEY = process.env.GOOGLE_PLACES_API_KEY;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('placeId');
  const sessiontoken = searchParams.get('sessiontoken') || '';

  if (!placeId || !KEY) return NextResponse.json({ status: 'ERROR' });

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,name,formatted_address,types&key=${KEY}&language=ja&sessiontoken=${sessiontoken}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ status: 'ERROR' });
  }
}
