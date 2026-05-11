#!/usr/bin/env python3
"""
国土数値情報 P04 医療機関データを処理してグリッドJSONを生成する
Output: public/data/ksj-medical.json
"""

import urllib.request
import zipfile
import io
import struct
import json
import math
import os
import sys

URL = 'https://nlftp.mlit.go.jp/ksj/gml/data/P04/P04-14/P04-14_GML.zip'
OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'ksj-medical.json')

# P04_001 種別コード
def type_from_code(code):
    c = code.strip()
    if c == '1': return 'hospital'    # 病院
    if c == '2': return 'clinic'      # 診療所
    if c == '3': return 'dental'      # 歯科診療所（歯科あり）
    if c == '4': return 'dental'      # 歯科診療所のみ
    return 'clinic'                   # その他 → 診療所扱い


def grid_key(lat, lng):
    """約11km×9kmのグリッドキー"""
    return f"{math.floor(lat * 10)}_{math.floor(lng * 10)}"


def parse_shp(data):
    """SHPファイルから全座標を読み出す"""
    pos = 100  # ファイルヘッダーをスキップ
    coords = []
    while pos < len(data):
        try:
            # レコードヘッダー: 8バイト (record number big-endian, content length big-endian)
            if pos + 8 > len(data):
                break
            content_len = struct.unpack_from('>I', data, pos + 4)[0] * 2  # 16-bit words to bytes
            # コンテンツ
            content_start = pos + 8
            if content_start + content_len > len(data):
                break
            shape_type = struct.unpack_from('<I', data, content_start)[0]
            if shape_type == 1:  # Point
                x = struct.unpack_from('<d', data, content_start + 4)[0]   # longitude
                y = struct.unpack_from('<d', data, content_start + 12)[0]  # latitude
                coords.append((x, y))
            elif shape_type == 0:  # Null shape
                coords.append(None)
            pos += 8 + content_len
        except struct.error:
            break
    return coords


def parse_dbf(data):
    """DBFファイルから施設名・種別を読み出す"""
    n_records = struct.unpack_from('<I', data, 4)[0]
    header_size = struct.unpack_from('<H', data, 8)[0]
    record_size = struct.unpack_from('<H', data, 10)[0]

    # フィールド定義
    fields = []
    pos = 32
    while pos < header_size - 1:
        if data[pos] == 0x0D:
            break
        field_name = data[pos:pos+11].rstrip(b'\x00').decode('ascii', errors='replace')
        field_type = chr(data[pos+11])
        field_len = data[pos+16]
        fields.append((field_name, field_type, field_len))
        pos += 32

    # フィールドオフセット計算
    field_offsets = {}
    offset = 1  # 削除フラグ分
    for (fname, ftype, flen) in fields:
        field_offsets[fname] = (offset, flen)
        offset += flen

    print(f'DBF: {n_records} records, fields: {[f[0] for f in fields]}')

    type_offset, type_len = field_offsets.get('P04_001', (1, 1))
    name_offset, name_len = field_offsets.get('P04_002', (2, 128))

    records = []
    pos = header_size
    for i in range(n_records):
        if pos + record_size > len(data):
            break
        deleted = data[pos] == 0x2A
        if not deleted:
            type_raw = data[pos + type_offset:pos + type_offset + type_len]
            name_raw = data[pos + name_offset:pos + name_offset + name_len]
            try:
                type_code = type_raw.decode('cp932', errors='replace').strip()
                name = name_raw.rstrip(b'\x00 ').decode('cp932', errors='replace').strip()
            except:
                type_code = ''
                name = ''
            records.append((type_code, name))
        else:
            records.append(None)
        pos += record_size

    return records


def main():
    print(f'Downloading {URL}...')
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=120) as r:
        zip_data = r.read()
    print(f'Downloaded {len(zip_data):,} bytes')

    with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
        # SHP読み込み
        shp_name = next(n for n in zf.namelist() if n.endswith('.shp'))
        print(f'Parsing {shp_name}...')
        with zf.open(shp_name) as f:
            shp_data = f.read()
        coords = parse_shp(shp_data)
        print(f'  → {len(coords)} coordinates')

        # DBF読み込み
        dbf_name = next(n for n in zf.namelist() if n.endswith('.dbf'))
        print(f'Parsing {dbf_name}...')
        with zf.open(dbf_name) as f:
            dbf_data = f.read()
        records = parse_dbf(dbf_data)
        print(f'  → {len(records)} records')

    # グリッドインデックス構築
    print('Building grid index...')
    grid = {}
    skip = 0
    count_by_type = {'hospital': 0, 'clinic': 0, 'dental': 0}

    for i, (coord, record) in enumerate(zip(coords, records)):
        if coord is None or record is None:
            skip += 1
            continue
        lng, lat = coord
        type_code, name = record

        # 日本範囲チェック
        if not (20 <= lat <= 48 and 122 <= lng <= 156):
            skip += 1
            continue

        ftype = type_from_code(type_code)
        count_by_type[ftype] = count_by_type.get(ftype, 0) + 1

        key = grid_key(lat, lng)
        if key not in grid:
            grid[key] = []

        # コンパクト形式: [lat, lng, type_code, name]
        # type_code: 0=hospital, 1=clinic, 2=dental
        t = 0 if ftype == 'hospital' else (2 if ftype == 'dental' else 1)
        grid[key].append([round(lat, 5), round(lng, 5), t, name])

    print(f'Skipped: {skip}')
    print(f'By type: {count_by_type}')
    print(f'Grid cells: {len(grid)}')
    total = sum(len(v) for v in grid.values())
    print(f'Total entries: {total:,}')

    # 出力
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    print(f'Writing {OUT_PATH}...')
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump({'grid': grid}, f, ensure_ascii=False, separators=(',', ':'))

    file_size = os.path.getsize(OUT_PATH)
    print(f'Done! File size: {file_size:,} bytes ({file_size/1024/1024:.1f} MB)')

    # サンプル表示
    print('\nSample (first cell):')
    first_key = next(iter(grid))
    print(f'  Cell {first_key}: {grid[first_key][:3]}...')


if __name__ == '__main__':
    main()
