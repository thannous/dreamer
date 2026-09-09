const { test } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./run-ti559-completion.cjs');
test('completion launcher isolates credentials and fixed bounded destination', () => {
 let calls=0;
 launch({PATH:'path',HOME:'home',GEMINI_API_KEY:'synthetic',OTHER_SECRET:'excluded'}, (command,args,options)=>{
  calls++;
  assert.equal(command,'deno');
  assert.deepEqual(options.env,{PATH:'path',HOME:'home',GEMINI_API_KEY:'synthetic'});
  assert.equal(options.shell,false);
  assert.ok(args.includes('--allow-net=generativelanguage.googleapis.com'));
  assert.ok(args.includes('--allow-write=/private/tmp/ti559-completion-evaluation-run'));
  return {status:0};
 });
 assert.equal(calls,1);
});
