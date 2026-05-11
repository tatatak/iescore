#!/usr/bin/env python3
"""P04データの構造を調査するスクリプト"""

import urllib.request
import zipfile
import io
import struct
import sys

URL = 'https://nlftp.mlit.go.jp/ksj/gml/data/P04/P04-14/P04-14_GML.zip'

def read_dbf_header(data):
    """DBFファイルのヘッダーとフィールド定義を読む"""
    # バイト0: バージョン
    # バイト4-7: レコード数
    # バイト8-9: ヘッダーサイズ
    # バイト10-11: レコードサイズ
    n_records = struct.unpack_from('<I', data, 4)[0]
    header_size = struct.unpack_from('<H', data, 8)[0]
    record_size = struct.unpack_from('<H', data, 10)[0]

    print(f'DBF: {n_records} records, header={header_size} bytes, record_size={record_size} bytes')

    # フィールド定義（32バイトずつ、ヘッダーの32バイト目から）
    fields = []
    pos = 32
    while pos < header_size - 1:
        if data[pos] == 0x0D:  # ヘッダー終端
            break
        field_name = data[pos:pos+11].rstrip(b'\x00').decode('ascii', errors='replace')
        field_type = chr(data[pos+11])
        field_len = data[pos+16]
        fields.append((field_name, field_type, field_len))
        pos += 32

    print('Fields:')
    for f in fields:
        print(f'  {f[0]} ({f[1]}) len={f[2]}')

    return fields, n_records, header_size, record_size


def read_shp_summary(data):
    """SHPファイルのサマリーを読む"""
    # ファイルヘッダー 100バイト
    file_code = struct.unpack_from('>I', data, 0)[0]
    file_length = struct.unpack_from('>I', data, 24)[0] * 2  # 16-bit words to bytes
    version = struct.unpack_from('<I', data, 28)[0]
    shape_type = struct.unpack_from('<I', data, 32)[0]
    xmin = struct.unpack_from('<d', data, 36)[0]
    ymin = struct.unpack_from('<d', data, 44)[0]
    xmax = struct.unpack_from('<d', data, 52)[0]
    ymax = struct.unpack_from('<d', data, 60)[0]

    print(f'SHP: file_code={file_code}, shape_type={shape_type}, version={version}')
    print(f'  Bounding box: ({xmin:.4f},{ymin:.4f}) - ({xmax:.4f},{ymax:.4f})')
    print(f'  File length: {file_length} bytes')

    # 最初の数レコードを読む
    pos = 100
    count = 0
    points = []
    while pos < len(data) and count < 5:
        rec_num = struct.unpack_from('>I', data, pos)[0]
        content_len = struct.unpack_from('>I', data, pos+4)[0] * 2
        stype = struct.unpack_from('<I', data, pos+8)[0]
        if stype == 1:  # Point
            x = struct.unpack_from('<d', data, pos+12)[0]
            y = struct.unpack_from('<d', data, pos+20)[0]
            points.append((rec_num, x, y))
        pos += 8 + content_len
        count += 1

    print(f'First {len(points)} points (lng, lat):')
    for p in points:
        print(f'  #{p[0]}: lng={p[1]:.6f}, lat={p[2]:.6f}')

    return points


def read_dbf_records(dbf_data, fields, n_records, header_size, record_size, max_rows=5):
    """DBFの最初のmax_rows件を読む"""
    pos = header_size
    rows = []
    for i in range(min(max_rows, n_records)):
        if data[pos] == 0x2A:  # 削除済みレコード
            pos += record_size
            continue
        row = {}
        field_pos = pos + 1  # 最初の1バイトは削除フラグ
        for (fname, ftype, flen) in fields:
            raw = dbf_data[field_pos:field_pos+flen]
            if ftype == 'C':  # Character
                try:
                    val = raw.decode('cp932', errors='replace').strip()
                except:
                    val = raw.decode('latin1', errors='replace').strip()
            elif ftype in ('N', 'F'):  # Numeric
                val = raw.decode('ascii', errors='replace').strip()
            else:
                val = raw.decode('ascii', errors='replace').strip()
            row[fname] = val
            field_pos += flen
        rows.append(row)
        pos += record_size
    return rows


def main():
    print(f'Downloading {URL}...')
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=120) as r:
        zip_data = r.read()
    print(f'Downloaded {len(zip_data)} bytes\n')

    with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
        # SHPファイルを読む
        shp_name = next(n for n in zf.namelist() if n.endswith('.shp'))
        print(f'=== SHP: {shp_name} ===')
        with zf.open(shp_name) as f:
            shp_data = f.read()
        read_shp_summary(shp_data)

        print()

        # DBFファイルを読む
        dbf_name = next(n for n in zf.namelist() if n.endswith('.dbf'))
        print(f'=== DBF: {dbf_name} ===')
        with zf.open(dbf_name) as f:
            dbf_data = f.read()

        global data
        data = dbf_data
        fields, n_records, header_size, record_size = read_dbf_header(dbf_data)

        print('\nFirst 5 records:')
        rows = read_dbf_records(dbf_data, fields, n_records, header_size, record_size, 5)
        for row in rows:
            print('  ', {k: v for k, v in row.items() if v.strip()})

        print()

        # XMLの最初の部分を読む
        xml_name = next((n for n in zf.namelist() if n.endswith('.xml') and 'META' not in n and 'meta' not in n), None)
        if xml_name:
            print(f'=== XML (first 3000 chars): {xml_name} ===')
            with zf.open(xml_name) as f:
                first_bytes = f.read(3000)
            print(first_bytes.decode('shift_jis', errors='replace'))


if __name__ == '__main__':
    main()
