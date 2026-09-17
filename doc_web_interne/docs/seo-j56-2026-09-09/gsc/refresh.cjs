// Read-only GSC J56 evidence. No credentials are written or printed.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const root = path.resolve(__dirname, '../../../..');
const authPath = path.join(root, 'scripts/export-search-console.js');
const auth = new Module(authPath, module);
auth.filename = authPath;
auth.paths = Module._nodeModulePaths(path.dirname(authPath));
auth._compile(fs.readFileSync(authPath, 'utf8') + '\nmodule.exports.getAccessToken = getAccessToken;', authPath);
const { csvEscape } = auth.exports;
const save = (name, data) => fs.writeFileSync(path.join(__dirname, name), JSON.stringify(data, null, 2) + '\n');
const csv = (name, rows, dimensions) => fs.writeFileSync(path.join(__dirname, name), [
  [...dimensions, 'clicks', 'impressions', 'ctr', 'position'].join(','),
  ...rows.map(r => [...(r.keys || []), r.clicks, r.impressions, r.ctr, r.position].map(csvEscape).join(',')),
].join('\n') + '\n');
const shift = (d,n) => new Date(new Date(d+'T00:00:00Z').getTime()+n*86400000).toISOString().slice(0,10);
async function main() {
  const { token, quotaProjectId } = await auth.exports.getAccessToken();
  async function query(name, request) {
    const file = path.join(__dirname, name+'.json');
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file));
    const body = {type:'web', dataState:'final', rowLimit:25000, ...request};
    const pages = []; let startRow = 0;
    do {
      const response = await fetch('https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Anoctalia.app/searchAnalytics/query', {
        method:'POST', headers:{authorization:`Bearer ${token}`, 'content-type':'application/json', ...(quotaProjectId ? {'x-goog-user-project':quotaProjectId} : {})},
        body:JSON.stringify({...body,startRow}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error('GSC HTTP '+response.status+' '+JSON.stringify(payload));
      pages.push(payload); startRow += (payload.rows||[]).length;
      if ((payload.rows||[]).length < body.rowLimit || !(body.dimensions||[]).length) break;
    } while (true);
    const result = {fetchedAt:new Date().toISOString(), site:'sc-domain:noctalia.app', request:body, responses:pages, rows:pages.flatMap(p=>p.rows||[])};
    save(name+'.json',result); csv(name+'.csv',result.rows,body.dimensions||[]);
    console.log(name, result.rows.length, 'rows');
    return result;
  }
  const all = await query('daily-all',{startDate:'2026-08-25',endDate:'2026-09-09',dimensions:['date'],dataState:'all'});
  const final = await query('daily-final',{startDate:'2026-08-25',endDate:'2026-09-09',dimensions:['date']});
  const latest = final.rows.map(r=>r.keys[0]).sort().at(-1);
  const incomplete = all.responses.find(r=>r.metadata)?.metadata?.firstIncompleteDate;
  save('freshness.json',{latestFinalizedDate:latest,firstIncompleteDate:incomplete||null,fetchedAt:final.fetchedAt,dateTimezone:'America/Los_Angeles'});
  console.log('Freshness',latest,incomplete);
  await query('site-current-28d',{startDate:shift(latest,-27),endDate:latest,dimensions:[]});
  await query('site-previous-28d',{startDate:shift(latest,-55),endDate:shift(latest,-28),dimensions:[]});
  const experiments = [
    {id:'arbol',url:'https://noctalia.app/es/simbolos/arbol',publication:'2026-09-02'},
    {id:'pidocchi',url:'https://noctalia.app/it/simboli/pidocchi',publication:'2026-09-02'},
    {id:'work-en',url:'https://noctalia.app/en/blog/stress-dreams-work',publication:'2026-09-01'},
    {id:'false-awakening-en',url:'https://noctalia.app/en/blog/false-awakening-dreams',publication:'2026-09-01'},
  ];
  for (const exp of experiments) {
    const startDate=shift(exp.publication,1),endDate=latest < shift(exp.publication,7) ? latest : shift(exp.publication,7);
    const base={dimensionFilterGroups:[{groupType:'and',filters:[{dimension:'page',operator:'equals',expression:exp.url}]}]};
    exp.windows={before:{startDate:shift(startDate,-7),endDate:shift(endDate,-7)},after:{startDate,endDate}};
    for (const [period,window] of Object.entries(exp.windows)) {
      await query(exp.id+'-'+period,{...base,...window,dimensions:[]});
      await query(exp.id+'-'+period+'-daily',{...base,...window,dimensions:['date']});
      await query(exp.id+'-'+period+'-queries',{...base,...window,dimensions:['query']});
    }
  }
  save('experiments.json',experiments);
  const casa={dimensionFilterGroups:[{groupType:'and',filters:[{dimension:'page',operator:'equals',expression:'https://noctalia.app/it/simboli/casa'}]}]};
  for(const [period,window] of Object.entries({before:{startDate:'2026-07-11',endDate:'2026-08-07'},after:{startDate:'2026-08-09',endDate:'2026-09-05'}})) {
    for(const dimensions of [[],['date'],['query'],['country','device'],['query','country','device']]) {
      await query('casa-'+period+'-'+(dimensions.join('-')||'summary'),{...casa,...window,dimensions});
    }
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
