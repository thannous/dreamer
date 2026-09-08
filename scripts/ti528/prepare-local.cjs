'use strict';
// Preparation only. Does not start, stop, reset or delete any Docker project.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const destination = '/private/tmp/noctalia-ti528-db';
const target = path.join(destination, 'supabase');
const config = path.join(target, 'config.toml');
if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink()) throw new Error('Refusing symlink workdir');
if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('Refusing symlink Supabase directory');
if (fs.existsSync(config)) {
  if (fs.lstatSync(config).isSymbolicLink() || !/^project_id\s*=\s*"noctalia-ti528-disposable"\s*$/m.test(fs.readFileSync(config, 'utf8'))) throw new Error('Existing directory is not the TI-528 project');
} else if (fs.existsSync(destination) && fs.readdirSync(destination).length) {
  throw new Error('Refusing nonempty unrecognized workdir');
}
fs.mkdirSync(target, { recursive: true });
const migrations = path.join(target, 'migrations');
if (fs.existsSync(migrations) && fs.lstatSync(migrations).isSymbolicLink()) throw new Error('Refusing symlink migrations');
fs.mkdirSync(migrations, { recursive: true });
const source = path.join(root, 'supabase');
const names = fs.readdirSync(path.join(source, 'migrations')).filter(name => name.endsWith('.sql'));
for (const existing of fs.readdirSync(migrations)) {
  if (!names.includes(existing)) throw new Error('Unexpected migration in existing TI-528 directory');
}
for (const name of names) {
  if (!name.endsWith('.sql')) continue;
  const output = path.join(migrations, name);
  if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) throw new Error('Refusing symlink migration');
  fs.copyFileSync(path.join(source, 'migrations', name), output);
}
const input = fs.readFileSync(path.join(source, 'config.toml'), 'utf8');
const result = input.replace(/^project_id\s*=.*$/m, 'project_id = "noctalia-ti528-disposable"')
  .replace(/^(\s*(?:port|shadow_port)\s*=\s*)5432(\d)\s*$/gm, '$15532$2')
  .replace(/^inspector_port\s*=\s*8083\s*$/m, 'inspector_port = 8183')
  .replace('sql_paths = ["./seed.sql"]', 'sql_paths = []');
fs.writeFileSync(config, result);
console.log(`Prepared ${destination}; no containers or existing database contents changed.`);
