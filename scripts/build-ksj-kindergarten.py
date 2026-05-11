#!/usr/bin/env python3
"""
国土数値情報 P29 学校データから幼稚園・認定こども園を抽出してグリッドJSONを生成
Output: public/data/ksj-kindergarten.json
"""

import urllib.request, zipfile, io, json, math, os

URL = 'https://nlftp.mlit.go.jp/ksj/gml/data/P29/P29-21/P29-21_GML.zip'
OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'ksj-kindergarten.json')

# 対象種別コード
TARGET_CODES = {
    16011: 'kindergarten',  # 幼稚園
    16013: 'kodomoen',      # 認定こども園（幼保連携型）
}

def grid_key(lat, lng):
    return f"{math.floor(lat * 10)}_{math.floor(lng * 10)}"

def main():
    print(f'Downloading {URL}...')
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=120) as r:
        zip_data = r.read()
    print(f'Downloaded {len(zip_data):,} bytes')

    with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
        print('Parsing P29-21.geojson...')
        with zf.open('P29-21.geojson') as f:
            gj = json.load(f)

    features = gj['features']
    print(f'Total features: {len(features):,}')

    grid = {}
    count_by_type = {}
    skipped = 0

    for feat in features:
        props = feat['properties']
        code = props.get('P29_003')
        if code not in TARGET_CODES:
            continue

        coords = feat.get('geometry', {}).get('coordinates')
        if not coords or len(coords) < 2:
            skipped += 1
            continue

        lng, lat = coords[0], coords[1]

        # 日本範囲チェック
        if not (20 <= lat <= 48 and 122 <= lng <= 156):
            skipped += 1
            continue

        name = (props.get('P29_004') or '').strip()
        if not name:
            skipped += 1
            continue

        ftype = TARGET_CODES[code]
        count_by_type[ftype] = count_by_type.get(ftype, 0) + 1

        key = grid_key(lat, lng)
        if key not in grid:
            grid[key] = []

        # コンパクト形式: [lat, lng, type_code, name]
        # type_code: 0=幼稚園, 1=こども園
        t = 0 if ftype == 'kindergarten' else 1
        grid[key].append([round(lat, 5), round(lng, 5), t, name])

    print(f'By type: {count_by_type}')
    print(f'Skipped: {skipped}')
    print(f'Grid cells: {len(grid)}')
    print(f'Total entries: {sum(len(v) for v in grid.values()):,}')

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    print(f'Writing {OUT_PATH}...')
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump({'grid': grid}, f, ensure_ascii=False, separators=(',', ':'))

    size = os.path.getsize(OUT_PATH)
    print(f'Done! {size:,} bytes ({size/1024/1024:.1f} MB)')

if __name__ == '__main__':
    main()
