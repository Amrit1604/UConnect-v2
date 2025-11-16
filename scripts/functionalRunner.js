/*
Standalone functional test runner.
Usage: node scripts/functionalRunner.js

This script performs sequential "function-level" stress tests (auth, follow-request, messaging).
It attempts to start the server if not running (by spawning `node startup/server.js`), and then
uses `node-fetch` (built-in fetch in Node 18+) to exercise HTTP endpoints.

Note: this is intentionally NOT a Jest unit test. It's a quick functional runner for rapid integration checks.
*/

const { spawn } = require('child_process');
const fetch = globalThis.fetch || require('node-fetch');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:4000';
const START_SERVER = process.env.START_SERVER !== 'false';

async function wait(ms){ return new Promise(r=>setTimeout(r, ms)); }

function startServer(){
  // spawn server in background
  console.log('Starting server: node startup/server.js');
  const proc = spawn(process.execPath, [path.join(__dirname,'..','startup','server.js')], {
    stdio: ['ignore','pipe','pipe'],
    env: { ...process.env, NODE_ENV: 'test' },
    windowsHide: true
  });
  proc.stdout.on('data', d=>process.stdout.write(`[server] ${d}`));
  proc.stderr.on('data', d=>process.stderr.write(`[server] ${d}`));
  return proc;
}

async function tryHealth(){
  try {
    const res = await fetch(BASE + '/');
    return res.status < 500;
  } catch(e){ return false; }
}

async function ensureServerRunning(){
  if (!START_SERVER) return null;
  const ok = await tryHealth();
  if (ok) { console.log('Server is already running at', BASE); return null; }
  const proc = startServer();
  // wait for health
  for(let i=0;i<30;i++){
    if (await tryHealth()) return proc;
    await wait(1000);
  }
  throw new Error('Server did not become healthy');
}

// Basic helper for cookies
function cookieJarFrom(res){
  // Accept either a Response-like object with headers.get, or our own { cookie } wrapper
  if (!res) return '';
  if (typeof res === 'string') return res;
  if (res.cookie) return res.cookie;
  if (res.headers && typeof res.headers.get === 'function'){
    const raw = res.headers.get('set-cookie');
    return raw ? raw.split(',').map(s=>s.split(';')[0]).join('; ') : '';
  }
  return '';
}

async function postJson(url, body, cookie){
  const res = await fetch(url, { method:'POST', headers:{ 'content-type':'application/json', ...(cookie?{cookie}:{}) }, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try{ json = JSON.parse(text); }catch(e){};
  return { status: res.status, body: json || text, cookie: res.headers.get('set-cookie') };
}

async function getJson(url, cookie){
  const res = await fetch(url, { headers: { ...(cookie?{cookie}:{}) } });
  const text = await res.text();
  let json = null;
  try{ json = JSON.parse(text); }catch(e){};
  return { status: res.status, body: json || text, cookie: res.headers.get('set-cookie') };
}

// --- Tests ---
async function authStress(){
  console.log('\n=== AUTH STRESS TEST ===');
  const results = { created:0, logins:0, errors:[] };
  // create many accounts quickly
  for(let i=0;i<8;i++){
    const user = { email:`func_user_${Date.now()}_${i}@test-chat.com`, name:`FuncUser${i}`, username:`funcuser_${Date.now()}_${i}`, password:'Password123!' };
    try{
      const r = await postJson(BASE + '/auth/register', user);
      if (r.status===302 || r.status===200) results.created++;
      else results.errors.push({phase:'register',status:r.status,body:r.body});
    }catch(e){ results.errors.push({phase:'register',err:e.message}); }
    await wait(120);
  }
  // try logins rapidly (including invalids)
  for(let i=0;i<12;i++){
    const payload = i%3===0 ? { email:'nonexistent@test-chat.com', password:'x' } : { email: `func_user_${Date.now() - (i%8)}_${i%8}@test-chat.com`, password:'Password123!' };
    try{
      const r = await postJson(BASE + '/auth/login', payload);
      if (r.status===302 || r.status===200) results.logins++;
    }catch(e){ results.errors.push({phase:'login',err:e.message}); }
  }
  console.log('Auth stress results:', results);
  return results;
}

async function followRequestStress(){
  console.log('\n=== FOLLOW REQUEST STRESS TEST ===');
  const results = { sent:0, blocked:0, errors:[] };
  // create two stable test users (if not exist) and login with cookies
  const u1 = { email:'fr_user1@test-chat.com', name:'FRUser1', username:'fr_user1', password:'Password123!' };
  const u2 = { email:'fr_user2@test-chat.com', name:'FRUser2', username:'fr_user2', password:'Password123!' };
  await postJson(BASE + '/auth/register', u1).catch(()=>{});
  await postJson(BASE + '/auth/register', u2).catch(()=>{});
  const login1 = await postJson(BASE + '/auth/login', { email:u1.email, password:u1.password });
  const cookie1 = cookieJarFrom(login1);
  const login2 = await postJson(BASE + '/auth/login', { email:u2.email, password:u2.password });
  const cookie2 = cookieJarFrom(login2);

  // send many follow requests from user1 to user2
  for(let i=0;i<6;i++){
    try{
      const r = await fetch(BASE + '/chat/request/' + encodeURIComponent((await getUserIdByUsername('fr_user2')).id), { method:'POST', headers:{ cookie: cookie1 } });
      if (r.status===200 || r.status===201 || r.status===302) results.sent++;
      else if (r.status===429) results.blocked++;
    }catch(e){ results.errors.push({err:e.message}); }
    await wait(150);
  }
  console.log('Follow-request stress results:', results);
  return results;
}

async function messagingStress(){
  console.log('\n=== MESSAGING STRESS TEST ===');
  const results = { sent:0, failures:0 };
  // ensure two friends exist and are friends
  const userA = { email:'msg_user_a@test-chat.com', name:'MsgA', username:'msg_a', password:'Password123!' };
  const userB = { email:'msg_user_b@test-chat.com', name:'MsgB', username:'msg_b', password:'Password123!' };
  await postJson(BASE + '/auth/register', userA).catch(()=>{});
  await postJson(BASE + '/auth/register', userB).catch(()=>{});
  const loginA = await postJson(BASE + '/auth/login', { email:userA.email, password:userA.password });
  const cookieA = cookieJarFrom(loginA);
  const loginB = await postJson(BASE + '/auth/login', { email:userB.email, password:userB.password });
  const cookieB = cookieJarFrom(loginB);

  // Make them friends (send request and accept)
  const idB = (await getUserIdByUsername('msg_b')).id;
  await fetch(BASE + '/chat/request/' + idB, { method:'POST', headers:{ cookie:cookieA } });
  // accept as B
  const pending = await getPendingRequests(cookieB);
  if (pending && pending[0]){
    await fetch(BASE + '/chat/request/' + pending[0]._id + '/accept', { method:'POST', headers:{ cookie:cookieB } });
  }

  // send many messages quickly
  for(let i=0;i<40;i++){
    try{
      const id = idB;
      const r = await fetch(BASE + '/chat/' + id + '/message', { method:'POST', headers:{ 'content-type':'application/json', cookie:cookieA }, body: JSON.stringify({ type:'text', text: 'Load message ' + i + ' ' + 'x'.repeat(i*10) }) });
      if (r.status===200) results.sent++;
      else results.failures++;
    }catch(e){ results.failures++; }
    if (i%10===0) await wait(200);
  }
  console.log('Messaging stress results:', results);
  return results;
}

async function socketStress(){
  // run socket-level tests using scripts/socketTests.js
  console.log('\n=== SOCKET.IO STRESS TEST ===');
  try{
    const { runSocketTests } = require('./socketTests');
    const r = await runSocketTests(BASE);
    console.log('Socket tests results:', r);
    return r;
  }catch(e){
    console.error('Socket tests failed to run', e.message||e);
    return { error: e.message };
  }
}

// helper to fetch user id by username via search endpoint or users route
async function getUserIdByUsername(username){
  try{
    const r = await postJson(BASE + '/chat/search', { query: username });
    // chat/search in this app returns HTML; fallback to /users?username
  }catch(e){}
  try{
    const res = await getJson(BASE + '/users/username/' + encodeURIComponent(username));
    if (res.status===200 && res.body && res.body._id) return { id: res.body._id };
  }catch(e){}
  // fallback: query users list
  return { id: null };
}

async function getPendingRequests(cookie){
  try{
    const r = await fetch(BASE + '/chat/requests', { headers:{ cookie } });
    const text = await r.text();
    // The view returns HTML; we can't parse reliably here. Return empty.
    return [];
  }catch(e){ return []; }
}

(async ()=>{
  let serverProc = null;
  try{
    serverProc = await ensureServerRunning();
  }catch(e){ console.error('Could not start server:', e.message); process.exit(2); }

  const summary = {};
  try{
    summary.auth = await authStress();
    summary.follow = await followRequestStress();
    summary.messaging = await messagingStress();
    summary.socket = await socketStress();
  }catch(e){ console.error('Error during functional tests', e); }

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));

  if (serverProc){
    console.log('Stopping spawned server');
    serverProc.kill();
  }
  process.exit(0);
})();
