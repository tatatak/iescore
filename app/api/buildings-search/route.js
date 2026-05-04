import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const lat = parseFloat(searchParams.get('lat'));
  const lng = parseFloat(searchParams.get('lng'));

  if (!q || q.length < 2 || !lat || !lng) return NextResponse.json([]);

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query = `[out:json][timeout:10];(way["building"]["name"~"${escaped}",i](around:3000,${lat},${lng});relation["building"]["name"~"${escaped}",i](around:3000,${lat},${lng}););out center 20;`;

  try {
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'iescore.com/1.0' }, cache: 'no-store' }
    );
    const text = await res.text();
    if (!text.startsWith('{')) return NextResponse.json([]);

    const elements = JSON.parse(text).elements || [];
    const results = elements
      .map(el => ({
        name: el.tags?.name,
        lat: el.center?.lat ?? el.lat,
        lng: el.center?.lon ?? el.lon,
      }))
      .filter(r => r.name && r.lat && r.lng);

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
