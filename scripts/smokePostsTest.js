#!/usr/bin/env node
// smokePostsTest.js
// Lightweight smoke test for posts endpoints.
// Usage (Windows cmd):
//   node scripts\smokePostsTest.js --email your@test.com --password yourpass
// Optional: --base http://localhost:4000 --postId <id>

const { argv, env } = require('process');

function parseArgs() {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const base = args.base || env.BASE_URL || 'http://localhost:4000';
  const email = args.email || env.SMOKE_EMAIL;
  const password = args.password || env.SMOKE_PASSWORD;
  const suppliedPostId = args.postId || env.SMOKE_POST_ID;

  if (!email || !password) {
    console.error('Missing credentials. Provide --email and --password or set SMOKE_EMAIL/SMOKE_PASSWORD.');
    process.exit(2);
  }

  console.log(`Base URL: ${base}`);

  // Use global fetch (Node 18+). If not available, try to load node-fetch dynamically.
  if (typeof fetch !== 'function') {
    try {
      // eslint-disable-next-line import/no-extraneous-dependencies, global-require
      const nodeFetch = require('node-fetch');
      // Node-fetch v3 exports ESM default; handle both
      global.fetch = nodeFetch.default || nodeFetch;
      console.log('Loaded node-fetch fallback.');
    } catch (e) {
      console.error('Global fetch is not available and node-fetch is not installed. Install node-fetch or run on Node 18+.');
      console.error('Install with: npm install node-fetch@2 --save-dev');
      process.exit(3);
    }
  }

  // Cookie jar (simple): store 'name=value' pairs separated by '; '
  let cookieJar = '';

  // Helper to store cookies from Set-Cookie header(s)
  function storeSetCookie(setCookieHeader) {
    if (!setCookieHeader) return;
    // setCookieHeader may be a string or array-like joined by ', ' if multiple
    const parts = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    parts.forEach(sc => {
      const pair = sc.split(';')[0].trim();
      if (!cookieJar) cookieJar = pair;
      else {
        const name = pair.split('=')[0];
        // replace same name
        const re = new RegExp('(^|; )' + name + '=[^;]+');
        if (re.test(cookieJar)) cookieJar = cookieJar.replace(re, pair);
        else cookieJar += '; ' + pair;
      }
    });
  }

  async function postForm(url, formObj, opts = {}) {
    const body = new URLSearchParams(formObj).toString();
    const res = await fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded' }, opts.headers || {}),
      body,
      redirect: 'manual'
    });
    const sc = res.headers.get('set-cookie');
    if (sc) storeSetCookie(sc);
    return res;
  }

  async function get(url, opts = {}) {
    const headers = Object.assign({}, opts.headers || {});
    if (cookieJar) headers.Cookie = cookieJar;
    const res = await fetch(url, { headers, redirect: 'manual' });
    const sc = res.headers.get('set-cookie');
    if (sc) storeSetCookie(sc);
    return res;
  }

  try {
    console.log('Logging in...');
    const loginRes = await postForm(`${base}/auth/login`, { email, password });
    if (loginRes.status === 302) {
      console.log('Login route redirected (expected). Cookies stored.');
    } else if (loginRes.status === 200) {
      console.log('Login returned 200 OK (session likely created).');
    } else {
      console.warn('Login returned status', loginRes.status);
    }

    if (!cookieJar) {
      console.warn('No session cookie received. The script may not be authenticated.');
    } else {
      // Do not print raw session tokens to logs. Confirm existence only.
      console.log('Session cookie received (value hidden)');
    }

    // Fetch /posts
    console.log('Fetching /posts...');
    const postsRes = await get(`${base}/posts`);
    if (postsRes.status === 302) {
      const loc = postsRes.headers.get('location');
      console.error(`GET /posts redirected to ${loc}. You may not be authenticated.`);
      process.exit(4);
    }

    const postsHtml = await postsRes.text();
    // Find first data-post-id in HTML
    const idMatch = postsHtml.match(/data-post-id="([^"]+)"/i);
    const postId = suppliedPostId || (idMatch && idMatch[1]);
    if (!postId) {
      console.error('No post id found on /posts. There may be no posts in the DB.');
      process.exit(5);
    }
    console.log('Found post id:', postId);

    // Test like endpoint
    console.log('Testing like endpoint...');
  const likeRes = await fetch(`${base}/posts/${postId}/like`, { method: 'POST', headers: { Cookie: cookieJar, 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
    const likeBodyText = await likeRes.text();
    let likeBody;
    try { likeBody = JSON.parse(likeBodyText); } catch (e) { likeBody = { raw: likeBodyText }; }
    if (likeRes.ok && likeBody.success !== false) {
      console.log('LIKE PASS:', likeBody);
    } else {
      console.error('LIKE FAIL:', likeRes.status, likeBody);
      process.exitCode = 6;
    }

    // Test comment endpoint
    console.log('Testing comment endpoint...');
    const commentPayload = { content: `Smoke test comment at ${new Date().toISOString()}` };
    const commentRes = await fetch(`${base}/posts/${postId}/comment`, {
      method: 'POST',
      headers: { Cookie: cookieJar, 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify(commentPayload)
    });
    const commentText = await commentRes.text();
    let commentBody;
    try { commentBody = JSON.parse(commentText); } catch (e) { commentBody = { raw: commentText }; }
    if (commentRes.ok && commentBody.success !== false) {
      console.log('COMMENT PASS:', commentBody);
    } else {
      console.error('COMMENT FAIL:', commentRes.status, commentBody);
      process.exitCode = 7;
    }

    console.log('\nSmoke tests completed.');

  } catch (err) {
    console.error('Error during smoke test:', err);
    process.exit(1);
  }
}

main();
