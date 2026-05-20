"""
populationChangeData.json の欠損市区町村を補完する。
既存の結果を保持しつつ、データなしの市区町村のみ再取得。
"""

import json, time, urllib.request, os, sys

ESTAT_APP_ID = os.environ.get('ESTAT_APP_ID', 'fb297f758d2b0aea9ce82424479b2aab4087cdd9')
STATS_2020 = '0003445141'
STATS_2015 = '0003149040'

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUTURE_JSON = os.path.join(BASE_DIR, 'app', 'area', 'futurePopData.json')
OUT_JSON    = os.path.join(BASE_DIR, 'app', 'area', 'populationChangeData.json')
CKPT_JSON   = '/tmp/pop_fill_ckpt.json'

def fetch_one(stats_id, code, retries=8):
    url = (
        f'https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData'
        f'?appId={ESTAT_APP_ID}&statsDataId={stats_id}'
        f'&cdArea={code}&limit=100'
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
            best = 0
            for item in items:
                c = str(item.get('@area', '')).strip()
                if c != code:
                    continue
                try:
                    val = int(item.get('$', '') or '0')
                except ValueError:
                    continue
                if val > best:
                    best = val
            return best
        except Exception as e:
            wait = min(2 ** attempt, 60)
            print(f'  RETRY({attempt+1}/{retries}) {wait}s [{code}]: {e}', end='\r')
            time.sleep(wait)
    return 0

def load_ckpt():
    if os.path.exists(CKPT_JSON):
        try:
            return json.load(open(CKPT_JSON))
        except Exception:
            pass
    return {'pop2020': {}, 'pop2015': {}}

def save_ckpt(ckpt):
    with open(CKPT_JSON, 'w') as f:
        json.dump(ckpt, f)

def main():
    future_codes = set(json.load(open(FUTURE_JSON)).keys())
    existing = json.load(open(OUT_JSON)) if os.path.exists(OUT_JSON) else {}
    missing = sorted(future_codes - set(existing.keys()))

    print(f'既存: {len(existing)} 件 / 欠損: {len(missing)} 件')
    if not missing:
        print('欠損なし。終了。')
        return

    ckpt = load_ckpt()
    pop2020 = ckpt['pop2020']
    pop2015 = ckpt['pop2015']

    # 欠損コードのうち未取得のもの
    todo = [c for c in missing if c not in pop2020 or c not in pop2015]
    print(f'取得対象: {len(todo)} 件\n')

    for i, code in enumerate(todo):
        changed = False
        if code not in pop2020:
            v = fetch_one(STATS_2020, code)
            pop2020[code] = v
            changed = True

        if code not in pop2015:
            v = fetch_one(STATS_2015, code)
            pop2015[code] = v
            changed = True

        if changed:
            ckpt['pop2020'] = pop2020
            ckpt['pop2015'] = pop2015
            save_ckpt(ckpt)

        p20 = pop2020.get(code, 0)
        p15 = pop2015.get(code, 0)
        status = f'{p20}/{p15}' if p20 or p15 else 'NG'
        sys.stdout.write(f'  [{i+1}/{len(todo)}] {code}: {status}   \r')
        sys.stdout.flush()
        time.sleep(0.3)

    print(f'\n\n集計中...')
    result = dict(existing)
    added = 0
    no_data = []
    for code in missing:
        p20 = pop2020.get(code, 0)
        p15 = pop2015.get(code, 0)
        if p20 and p15 and p15 > 0:
            result[code] = round((p20 - p15) / p15 * 100, 1)
            added += 1
        else:
            no_data.append(code)

    print(f'追加: {added} 件 / 依然データなし: {len(no_data)} 件')
    if no_data[:10]:
        print(f'  データなし: {no_data[:10]}')

    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, separators=(',', ':'))
    print(f'保存完了: {OUT_JSON} ({len(result)} 件, {os.path.getsize(OUT_JSON):,} bytes)')

    if os.path.exists(CKPT_JSON):
        os.remove(CKPT_JSON)

if __name__ == '__main__':
    main()
