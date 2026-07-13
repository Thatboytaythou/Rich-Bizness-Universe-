const origin = (process.env.RB_ORIGIN || 'https://rich-bizness.com').replace(/\/$/, '');

const routes = [
  '/', '/feed.html', '/live.html', '/watch.html', '/gallery.html', '/music.html',
  '/upload.html', '/gaming.html', '/sports.html', '/meta.html', '/store.html',
  '/creator.html', '/admin.html', '/messages.html', '/notifications.html',
  '/search.html', '/profile.html', '/edit.html', '/avatar.html', '/settings.html',
  '/auth.html', '/onboarding.html', '/health.html',
  '/games/rich-chess/', '/games/money-road-runner/', '/games/smoke-city-hustle/'
];

const results = [];
for (const route of routes) {
  const url = `${origin}${route}`;
  const started = Date.now();
  try {
    const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Rich-Bizness-Smoke-Test/1.0' } });
    const text = await response.text();
    const ok = response.ok && /<!doctype html/i.test(text);
    results.push({ route, status: response.status, ms: Date.now() - started, ok });
  } catch (error) {
    results.push({ route, status: 0, ms: Date.now() - started, ok: false, error: error.message });
  }
}

for (const row of results) {
  console.log(`${row.ok ? 'PASS' : 'FAIL'} ${String(row.status).padStart(3)} ${String(row.ms).padStart(5)}ms ${row.route}${row.error ? ` — ${row.error}` : ''}`);
}

const failed = results.filter((row) => !row.ok);
console.log(`\n${results.length - failed.length}/${results.length} routes passed.`);
if (failed.length) process.exitCode = 1;
