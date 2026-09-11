import urllib.request,json,re,html,datetime
from pathlib import Path
out=Path(__file__).parent
urls=['https://noctalia.app/es/simbolos/hospital','https://noctalia.app/en/blog/dream-interpretation-history']
results=[]
for url in urls:
 req=urllib.request.Request(url,headers={'User-Agent':'Noctalia-J56-publication-verification/1.0','Cache-Control':'no-cache'})
 with urllib.request.urlopen(req,timeout=45) as r:
  s=r.read().decode(); status=r.status; headers=dict(r.headers)
 title=html.unescape(re.search(r'<title>(.*?)</title>',s,re.S).group(1));desc=html.unescape(re.search(r'<meta name="description" content="([^"]*)"',s).group(1));canon=re.search(r'<link rel="canonical" href="([^"]*)"',s).group(1)
 checks={'http200':status==200,'canonical':canon==url}
 if url.endswith('/hospital'):
  checks.update(title=title=='Soñar con un hospital: estar allí o verlo lleno | Noctalia',description=desc=='¿Qué significa soñar con un hospital? Compara estar allí, verlo lleno de gente, enfermos o personal médico según tu emoción y contexto, sin predicciones.')
 else:
  blocks=[json.loads(x) for x in re.findall(r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>',s,re.S)]
  types={x.get('@type'):x for x in blocks if isinstance(x,dict)}
  b=types.get('BlogPosting',{});f=types.get('FAQPage',{})
  checks.update(correctedStatistic='65% of 299 sleep reports' in s,oldStatisticAbsent='65% of dream content' not in s,modified=b.get('dateModified')=='2026-09-09',published=b.get('datePublished')=='2025-12-11',faq4=len(f.get('mainEntity',[]))==4,correctFreudLink='https://www.gutenberg.org/ebooks/66048' in s)
 results.append({'url':url,'http':status,'title':title,'description':desc,'canonical':canon,'checks':checks,'headers':{k:v for k,v in headers.items() if k.lower() in ['date','etag','cf-cache-status','last-modified','cf-ray']}})
sitemap=urllib.request.urlopen(urllib.request.Request('https://noctalia.app/sitemap.xml',headers={'User-Agent':'Noctalia-J56-publication-verification/1.0','Cache-Control':'no-cache'}),timeout=45).read().decode()
for x in results:x['checks']['sitemap']='<loc>'+x['url']+'</loc>' in sitemap
payload={'verifiedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':results,'passed':all(all(x['checks'].values()) for x in results)}
(out/'public-verification.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2));print(json.dumps(payload,ensure_ascii=False,indent=2))
assert payload['passed']
