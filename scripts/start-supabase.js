'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const envFile = path.resolve(__dirname, '..', '.env.supabase');

if (!fs.existsSync(envFile)) {
  console.error(
    "Missing .env.supabase. Create it with EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, and optionally SUPABASE_PROJECT_REF / EXPO_PUBLIC_API_URL."
  );
  process.exit(1);
}

function loadEnv(filePath) {
  const contents = fs.readFileSync(filePath, 'utf8');
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

loadEnv(envFile);

if (!process.env.EXPO_PUBLIC_API_URL && process.env.SUPABASE_PROJECT_REF) {
  process.env.EXPO_PUBLIC_API_URL = `https://${process.env.SUPABASE_PROJECT_REF}.functions.supabase.co/api`;
}

const requiredKeys = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_API_URL'];
const missing = requiredKeys.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing required env vars in .env.supabase: ${missing.join(', ')}`);
  process.exit(1);
}

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(cmd, ['expo', 'start'], {
  stdio: 'inherit',
  env: process.env,
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('Failed to start Expo:', err);
  process.exit(1);
});

