"""
2015→2020 人口増減率を e-Stat の 0003445099 (5年間の人口増減率, tab=2020_35) から
一括取得し populationChangeData.json を再構築する。
旧スクリプトは DID（人口集中地区）人口を誤用していたため、全件再取得する。
"""

import json, time, urllib.request, os, sys

ESTAT_APP_ID = os.environ.get('ESTAT_APP_ID', 'fb297f758d2b0aea9ce82424479b2aab4087cdd9')
STATS_ID = '0003445099'  # 令和2年国勢調査: 5年間の人口増減数・増減率
TAB_CODE = '2020_35'     # 5年間の人口増減率

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUTURE_JSON = os.path.join(BASE_DIR, 'app', 'area', 'futurePopData.json')
OUT_JSON    = os.path.join(BASE_DIR, 'app', 'area', 'populationChangeData.json')
CKPT_JSON   = '/tmp/pop_rebuild_ckpt.json'

CHUNK = 50

def fetch_batch(codes, retries=8):
    url = (
        f'https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData'
        f'?appId={ESTAT_APP_ID}&statsDataId={STATS_ID}'
        f'&cdArea={",".join(codes)}&cdTab={TAB_CODE}&limit=200'
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                data = json.loads(r.read())
            items = (data.get('GET_STATS_DATA', {})
                        .get('STATISTICAL_DATA', {})
                        .get('DATA_INF', {})
                        .get('VALUE', []))
            if not isinstance(items, list):
                items = [items] if isinstance(items, dict) else []
            result = {}
            for item in items:
                code = str(item.get('@area', '')).strip()
                try:
                    val = float(item.get('$', '') or '0')
                    result[code] = round(val, 1)
                except (ValueError, TypeError):
                    pass
            return result
        except Exception as e:
            wait = min(2 ** attempt, 60)
            print(f'  RETRY({attempt+1}/{retries}) {wait}s: {e}', end='\r')
            time.sleep(wait)
    return {}

def main():
    target_codes = list(json.load(open(FUTURE_JSON)).keys())
    print(f'対象市区町村: {len(target_codes)} 件')

    # チェックポイントから再開
    ckpt = {}
    if os.path.exists(CKPT_JSON):
        try:
            ckpt = json.load(open(CKPT_JSON))
            print(f'チェックポイント再開: {len(ckpt)} 件取得済み')
        except Exception:
            pass

    remaining = [c for c in target_codes if c not in ckpt]
    chunks = [remaining[i:i+CHUNK] for i in range(0, len(remaining), CHUNK)]
    total = len(chunks)
    print(f'残り {len(remaining)} 件, {total} バッチ\n')

    for i, chunk in enumerate(chunks):
        r = fetch_batch(chunk)
        ckpt.update(r)

        with open(CKPT_JSON, 'w') as f:
            json.dump(ckpt, f)

        sys.stdout.write(f'  [{i+1}/{total}] {len(r)}件取得 (累計 {len(ckpt)})  \r')
        sys.stdout.flush()
        time.sleep(0.4)

    print(f'\n\n完了: {len(ckpt)} 件取得')

    # 出力
    result = {code: ckpt[code] for code in sorted(target_codes) if code in ckpt}
    no_data = [c for c in target_codes if c not in ckpt]

    print(f'結果: {len(result)} 件 / データなし: {len(no_data)} 件')
    if no_data[:5]:
        print(f'  データなし: {no_data[:5]}')

    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, separators=(',', ':'))
    print(f'保存完了: {OUT_JSON} ({os.path.getsize(OUT_JSON):,} bytes)')

    if os.path.exists(CKPT_JSON):
        os.remove(CKPT_JSON)

if __name__ == '__main__':
    main()
