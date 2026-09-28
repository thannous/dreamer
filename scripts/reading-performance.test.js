'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');

it('journal-only capture scrolls the journal without opening detail or reading', () => {
  const code = `
import importlib.util, hashlib, types
spec=importlib.util.spec_from_file_location('worker', ${JSON.stringify(path.join(__dirname, 'android/reading-performance.py'))})
w=importlib.util.module_from_spec(spec); spec.loader.exec_module(w)
actions=[]
class Node:
 def get(self,key,default=''): return 'synthetic journal' if key=='content-desc' else default
 def iter(self,key): return []
card=Node()
r=types.SimpleNamespace(phases=['journal-scroll'], scenario={'targetTestId':'card','dreamLabelSha256':hashlib.sha256(b'synthetic journal').hexdigest()}, tree=lambda: {}, find=lambda tree,key: card if key=='card' else None, tap=lambda node: actions.append('tap'), scroll=lambda: actions.append('scroll'), measure=lambda run,phase,action: (actions.append(phase),action()))
w.Runner.journey(r,1)
assert actions == ['journal-scroll','scroll'], actions
`;
  const result = spawnSync('python3', ['-c', code], { encoding: 'utf8' });
  expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: '' });
});
