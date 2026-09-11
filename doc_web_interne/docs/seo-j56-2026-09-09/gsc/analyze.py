import csv, json, math
from pathlib import Path
P=Path(__file__).parent
def read(name): return json.loads((P/(name+'.json')).read_text())['rows']
def total(rows):
    c=sum(r['clicks'] for r in rows); i=sum(r['impressions'] for r in rows)
    return dict(clicks=c,impressions=i,ctr=c/i if i else None,position=sum(r['position']*r['impressions'] for r in rows)/i if i else None)
def write_csv(name,rows):
    with (P/name).open('w') as f:
        w=csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
def cohort(dim):
    b={tuple(r['keys']):r for r in read('casa-before-'+dim)}; a={tuple(r['keys']):r for r in read('casa-after-'+dim)}
    common=b.keys()&a.keys()
    bs=total([b[k] for k in common]); aas=total([a[k] for k in common])
    rows=[]
    for k in sorted(b.keys()|a.keys()):
        row=dict(zip(dim.split('-'),k)); row['status']='common' if k in common else 'before-only' if k in b else 'after-only'
        for per,rs in [('before',b),('after',a)]:
            for metric in ['clicks','impressions','ctr','position']:row[per+'_'+metric]=rs.get(k,{}).get(metric,'')
        rows.append(row)
    write_csv('casa-cohorts-'+dim+'.csv',rows)
    ctr_a_fixed_b=sum((b[k]['impressions']/bs['impressions'])*a[k]['ctr'] for k in common)
    ctr_b_fixed_a=sum((a[k]['impressions']/aas['impressions'])*b[k]['ctr'] for k in common)
    pos_a_fixed_b=sum((b[k]['impressions']/bs['impressions'])*a[k]['position'] for k in common)
    return dict(common_count=len(common),before_visible=total(b.values()),after_visible=total(a.values()),common_before=bs,common_after=aas,after_ctr_baseline_weights=ctr_a_fixed_b,before_ctr_after_weights=ctr_b_fixed_a,after_position_baseline_weights=pos_a_fixed_b,
      before_only=total([b[k] for k in b.keys()-a.keys()]),after_only=total([a[k] for k in a.keys()-b.keys()]))
result={dim:cohort(dim) for dim in ['query','country-device','query-country-device']}
import re
def cluster(q):
    if re.search(r'acqua|allagat|allag[a-z]*|inond|pioggia',q):return 'eau/inondation'
    if re.search(r'sconosciut|non conos|mai vist',q):return 'maison inconnue'
    return 'autres maisons'
clusters=[]
for period in ['before','after']:
    rows=read('casa-'+period+'-query')
    for label in ['eau/inondation','maison inconnue','autres maisons']:
        selected=[r for r in rows if cluster(r['keys'][0])==label]
        clusters.append(dict(period=period,cluster=label,visible_queries=len(selected),**total(selected)))
write_csv('casa-clusters.csv',clusters)
result['clusters']=clusters
(P/'casa-cohort-summary.json').write_text(json.dumps(result,indent=2)+'\n')
for dim,v in result.items():print(dim,json.dumps(v))
b={tuple(r['keys']):r for r in read('casa-before-query-country-device')};a={tuple(r['keys']):r for r in read('casa-after-query-country-device')}
print('Largest click losses common cohorts')
for k in sorted(b.keys()&a.keys(),key=lambda k:a[k]['clicks']-b[k]['clicks'])[:12]:print(k,b[k],a[k])
print('country/device rows')
for r in read('casa-before-country-device'):print('before',r)
for r in read('casa-after-country-device'):print('after',r)
