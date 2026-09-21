#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { buildProductSql, buildReport, markdown } = require('./lib/product-funnel');
function main(argv) {
  const options = {}; let sql = false;
  for (let i=0;i<argv.length;i++) {
    if (argv[i] === '--sql') { sql=true; continue; }
    if (argv[i] === '--help') {
      console.log('Usage: npm run analytics:baseline -- --from YYYY-MM-DD --to YYYY-MM-DD --as-of YYYY-MM-DD [--sql | --product aggregate.json --web website-summary.json --out directory]\nSQL mode produces a read-only query. Inputs contain aggregate counts only; no credentials are read.');return;
    }
    const names={'--from':'from','--to':'to','--as-of':'asOf','--product':'productPath','--web':'webPath','--out':'out'};
    const name=names[argv[i]];
    if (!name || !argv[i+1] || argv[i+1].startsWith('--')) throw new Error('Unknown or incomplete argument');
    options[name]=argv[++i];
  }
  if (sql) { console.log(buildProductSql(options)); return; }
  if (!options.out) throw new Error('--out is required');
  const read = p=>p ? JSON.parse(fs.readFileSync(p,'utf8')) : undefined;
  const report=buildReport({...options,product:read(options.productPath),web:read(options.webPath)});
  fs.mkdirSync(options.out,{recursive:true});
  fs.writeFileSync(path.join(options.out,'baseline.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(options.out,'baseline.md'),markdown(report));
  console.log(path.resolve(options.out,'baseline.md'));
}
if(require.main===module){try{main(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={main};
