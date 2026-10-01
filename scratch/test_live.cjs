const fs = require('fs');

function parseEnv(path) {
  if (!fs.existsSync(path)) return {};
  const content = fs.readFileSync(path, 'utf8');
  const res = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      res[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return res;
}

const env = { ...parseEnv('.env'), ...parseEnv('.env.local') };
const keys = (env.GEMINI_API_KEYS || env.GEMINI_API_KEY || '').split(/[\n,;]+/).map(k => k.trim()).filter(Boolean);

const models = [
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-3.1-pro-preview',
  'gemini-pro-latest'
];

async function test() {
  for (const m of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${keys[0]}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] })
      });
      const data = await r.json();
      console.log(m, r.status, r.status === 200 ? 'OK' : data.error?.message?.slice(0, 80));
    } catch (e) {
      console.log(m, 'error', e.message);
    }
  }
}
test();
