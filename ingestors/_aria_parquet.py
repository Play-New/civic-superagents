#!/usr/bin/env python3
# Aggregates EEA per-sampling-point PM10 Parquet (one file = one station series) to 2024 annual stats.
# argv[1] = file with one parquet URL per line; argv[2] = output JSON path.
# Output: { "<Samplingpoint>": {"n": <valid days>, "media": <mean ug/m3>, "sfor": <days >50>}, ... }
import sys, json, io, urllib.request, concurrent.futures
import pyarrow.parquet as pq
import pyarrow.compute as pc

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36'
urls = [l.strip() for l in open(sys.argv[1]) if l.strip().endswith('.parquet')]


def proc(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        data = urllib.request.urlopen(req, timeout=90).read()
        t = pq.read_table(io.BytesIO(data), columns=['Samplingpoint', 'Start', 'Value', 'AggType', 'Validity'])
        yr = pc.year(t['Start'])
        mask = pc.and_(pc.and_(pc.equal(yr, 2024), pc.greater(t['Validity'], 0)), pc.equal(t['AggType'], 'day'))
        t = t.filter(mask)
        if t.num_rows == 0:
            return None
        sp = t['Samplingpoint'][0].as_py()
        vals = [float(v.as_py()) for v in t['Value'] if v.as_py() is not None]
        if not vals:
            return None
        return (sp, len(vals), sum(vals), sum(1 for v in vals if v > 50))
    except Exception:
        return None


out = {}
done = 0
with concurrent.futures.ThreadPoolExecutor(max_workers=24) as ex:
    for r in ex.map(proc, urls):
        done += 1
        if done % 100 == 0:
            print(f'  ...{done}/{len(urls)}', file=sys.stderr)
        if not r:
            continue
        sp, n, s, sfor = r
        cur = out.setdefault(sp, [0, 0.0, 0])
        cur[0] += n; cur[1] += s; cur[2] += sfor

res = {k: {'n': v[0], 'media': round(v[1] / v[0], 2), 'sfor': v[2]} for k, v in out.items() if v[0] > 0}
json.dump(res, open(sys.argv[2], 'w'))
print(f'sampling points with 2024 PM10 data: {len(res)}', file=sys.stderr)
