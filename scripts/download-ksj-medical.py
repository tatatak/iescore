#!/usr/bin/env python3
"""
国土数値情報 P04 医療機関データをダウンロードしてパースする
Output: public/data/ksj-medical.json
  { "grid": { "35_139": [{name, lat, lng, type}], ... } }
"""

import urllib.request
import zipfile
import xml.etree.ElementTree as ET
import json
import io
import math
import sys
import os

# P04 - 医療機関（全国）2020年データ
# 47都道府県のファイル一覧（prefecture codes 01-47, but 14 is national?)
# 実際はファイルを確認しながら対応

PREFS = [
    ('01','北海道'), ('02','青森'), ('03','岩手'), ('04','宮城'), ('05','秋田'),
    ('06','山形'), ('07','福島'), ('08','茨城'), ('09','栃木'), ('10','群馬'),
    ('11','埼玉'), ('12','千葉'), ('13','東京'), ('14','神奈川'), ('15','新潟'),
    ('16','富山'), ('17','石川'), ('18','福井'), ('19','山梨'), ('20','長野'),
    ('21','岐阜'), ('22','静岡'), ('23','愛知'), ('24','三重'), ('25','滋賀'),
    ('26','京都'), ('27','大阪'), ('28','兵庫'), ('29','奈良'), ('30','和歌山'),
    ('31','鳥取'), ('32','島根'), ('33','岡山'), ('34','広島'), ('35','山口'),
    ('36','徳島'), ('37','香川'), ('38','愛媛'), ('39','高知'), ('40','福岡'),
    ('41','佐賀'), ('42','長崎'), ('43','熊本'), ('44','大分'), ('45','宮崎'),
    ('46','鹿児島'), ('47','沖縄'),
]

BASE_URL = 'https://nlftp.mlit.go.jp/ksj/gml/data/P04/'
OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'ksj-medical.json')

NS = {
    'gml': 'http://www.opengis.net/gml/3.2',
    'ksj': 'http://nlftp.mlit.go.jp/ksj/schemas/ksj-app',
    'P04': 'http://nlftp.mlit.go.jp/ksj/schemas/ksj-app',
}

# 診療科コード → 施設タイプ
# P04データの種別コード（P04_003）: 1=病院, 2=診療所, 3=歯科診療所, 4=薬局
def type_from_code(code_str):
    code = str(code_str).strip() if code_str else ''
    if code == '1': return 'hospital'
    if code == '3': return 'dental'
    return 'clinic'


def grid_key(lat, lng):
    return f"{math.floor(lat * 10)}_{math.floor(lng * 10)}"


def parse_gml(xml_bytes, pref_name):
    facilities = []
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as e:
        print(f'  XML parse error: {e}', file=sys.stderr)
        return facilities

    # 名前空間を自動検出（ファイルによって異なる場合あり）
    # まずタグ名から名前空間URIを取得
    ns_map = {}
    for event, elem in ET.iterparse(io.BytesIO(xml_bytes), events=['start-ns']):
        ns_map[elem[0]] = elem[1]

    # P04 の名前空間URI
    p04_ns = ns_map.get('P04', '')
    gml_ns = ns_map.get('gml', 'http://www.opengis.net/gml/3.2')

    def tag(ns_prefix, local):
        uri = ns_map.get(ns_prefix, '')
        if uri:
            return f'{{{uri}}}{local}'
        return local

    # Feature members を探す
    # gml:featureMember または gml:FeatureCollection/gml:featureMember
    count = 0
    for member in root.iter():
        # P04 要素を探す（タグ名に P04 が含まれるもの）
        if member.tag.endswith('}P04') or member.tag == 'P04':
            # 座標を取得
            lat = lng = None
            pos_elem = member.find('.//{%s}pos' % gml_ns)
            if pos_elem is not None and pos_elem.text:
                parts = pos_elem.text.strip().split()
                if len(parts) >= 2:
                    try:
                        lat = float(parts[0])
                        lng = float(parts[1])
                    except ValueError:
                        pass

            if lat is None or lng is None:
                # Point座標を別の方法で探す
                for child in member.iter():
                    if child.tag.endswith('}pos') and child.text:
                        parts = child.text.strip().split()
                        if len(parts) >= 2:
                            try:
                                lat = float(parts[0])
                                lng = float(parts[1])
                                break
                            except ValueError:
                                pass

            if lat is None or lng is None:
                continue

            # 施設名
            name = ''
            type_code = ''

            for child in member:
                local = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                text = (child.text or '').strip()
                # 施設名称フィールド（P04_001 や P04_01 など）
                if local in ('P04_001', 'P04_01', 'facilityName', 'name'):
                    name = text
                # 種別コード（P04_003: 1=病院, 2=診療所, 3=歯科, 4=薬局）
                elif local in ('P04_003', 'P04_03', 'medicalType', 'facilityType', 'typeCode'):
                    type_code = text

            # 名前が取れなかった場合は子要素を全探索
            if not name:
                for child in member.iter():
                    local = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                    if '001' in local or 'name' in local.lower() or 'Name' in local:
                        if child.text and child.text.strip():
                            name = child.text.strip()
                            break

            if not name:
                name = pref_name + '内医療機関'

            ftype = type_from_code(type_code)

            # 日本の有効範囲チェック
            if 20 <= lat <= 48 and 122 <= lng <= 154:
                facilities.append({
                    'n': name,
                    'la': round(lat, 6),
                    'ln': round(lng, 6),
                    't': ftype,
                })
                count += 1

    print(f'  → {count} facilities parsed')
    return facilities


def download_pref(pref_code, pref_name):
    """1都道府県のP04データをダウンロードしてパース"""
    # ファイル名パターン: P04-14_13GML.zip (year=14, pref=13) または P04-XX_GML.zip
    # 実際のURLパターンを試す
    candidates = [
        f'{BASE_URL}P04-20/P04-20_{pref_code}.zip',       # 2020年, 都道府県コード
        f'{BASE_URL}P04-20/P04-20_{pref_code}_GML.zip',
        f'{BASE_URL}P04-20_{pref_code}/P04-20_{pref_code}_GML.zip',
    ]

    for url in candidates:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=60) as r:
                if r.status == 200:
                    print(f'  Downloading: {url}')
                    data = r.read()
                    return parse_zip(data, pref_name)
        except urllib.error.HTTPError as e:
            if e.code != 404:
                print(f'  HTTP {e.code}: {url}')
        except Exception as e:
            pass

    print(f'  Not found: {pref_name} ({pref_code})')
    return []


def parse_zip(zip_bytes, pref_name):
    facilities = []
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for fname in zf.namelist():
                if fname.endswith('.xml') or fname.endswith('.gml'):
                    print(f'  Parsing {fname}...')
                    with zf.open(fname) as f:
                        content = f.read()
                    facilities.extend(parse_gml(content, pref_name))
    except zipfile.BadZipFile as e:
        print(f'  Bad ZIP: {e}', file=sys.stderr)
    return facilities


def main():
    # まず確認済みURLで1ファイル試す
    test_url = 'https://nlftp.mlit.go.jp/ksj/gml/data/P04/P04-14/P04-14_GML.zip'
    print(f'Testing confirmed URL: {test_url}')
    try:
        req = urllib.request.Request(test_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=120) as r:
            print(f'Status: {r.status}, Size: {r.headers.get("Content-Length", "?")} bytes')
            data = r.read()
            print(f'Downloaded {len(data)} bytes')

        # ZIPの中身を確認
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            names = zf.namelist()
            print(f'ZIP contents ({len(names)} files):')
            for n in names[:20]:
                info = zf.getinfo(n)
                print(f'  {n} ({info.file_size} bytes)')

        print('\n--- Parsing first XML/GML file ---')
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            xml_files = [n for n in zf.namelist() if n.endswith('.xml') or n.endswith('.gml')]
            if xml_files:
                with zf.open(xml_files[0]) as f:
                    content = f.read()
                # 最初の2000文字を表示
                print('First 2000 chars of XML:')
                print(content[:2000].decode('utf-8', errors='replace'))
                print('\n...\n')
                # 後半も確認
                if len(content) > 3000:
                    print('Around position 3000:')
                    print(content[2000:4000].decode('utf-8', errors='replace'))

    except Exception as e:
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
