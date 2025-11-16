/*
Socket-level functional tests for chat real-time features.
This module exports `runSocketTests(BASE)` which:
 - registers/logs in two users
 - opens socket.io-client connections with the session cookies
 - sends a message (via HTTP POST) from A to B while both sockets are connected
 - verifies that B's socket receives the `new_message` event

Usage:
  const { runSocketTests } = require('./socketTests');
  await runSocketTests('http://localhost:4000');

Note: requires `socket.io-client` in project dependencies. If missing, install with:
  npm i socket.io-client
*/

const fetch = globalThis.fetch || require('node-fetch');
const { io } = require('socket.io-client');

function cookieJarFrom(res){
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

async function runSocketTests(BASE){
  console.log('\n--- SOCKET TESTS START ---');
  const results = { connected: false, messageDelivered: false, errors: [] };

  try{
    // register users (ignore failures if already exist)
    const uA = { email: 'socket_a@test-chat.com', name:'SocketA', username:'socket_a', password:'Password123!' };
    const uB = { email: 'socket_b@test-chat.com', name:'SocketB', username:'socket_b', password:'Password123!' };
    await postJson(BASE + '/auth/register', uA).catch(()=>{});
    await postJson(BASE + '/auth/register', uB).catch(()=>{});

    // login to get cookies
    const lA = await postJson(BASE + '/auth/login', { email: uA.email, password: uA.password });
    const cookieA = cookieJarFrom(lA);
    const lB = await postJson(BASE + '/auth/login', { email: uB.email, password: uB.password });
    const cookieB = cookieJarFrom(lB);

    // helper to get user id via authenticated search endpoint
    async function getUserId(username, cookie){
      try{
        const q = encodeURIComponent(username);
        const r = await getJson(BASE + '/users/search?q=' + q, cookie);
        if (r.status === 200 && r.body && r.body.results && r.body.results.length) {
          return r.body.results[0].id;
        }
      }catch(e){ console.log('getUserId error', e.message); }
      return null;
    }

    // Search using cookieA (authenticated) to find user B's id
    const idB = await getUserId('socket_b', cookieA);
    if (!idB) {
      results.errors.push('could not find user id for socket_b');
      return results;
    }

    // connect sockets with cookies
    const socketA = io(BASE, { extraHeaders: { Cookie: cookieA }, transports: ['websocket'], reconnection: false });
    const socketB = io(BASE, { extraHeaders: { Cookie: cookieB }, transports: ['websocket'], reconnection: false });

    let aConnected=false, bConnected=false;

    const waitFor = (ms)=> new Promise(r=>setTimeout(r, ms));

    socketA.on('connect', ()=>{ aConnected=true; console.log('[socketA] connected'); });
    socketB.on('connect', ()=>{ bConnected=true; console.log('[socketB] connected'); });

    // wait for both to connect or time out
    for(let i=0;i<30;i++){
      if (aConnected && bConnected) break;
      await waitFor(200);
    }

    if (!(aConnected && bConnected)){
      results.errors.push('sockets failed to connect');
      socketA.close(); socketB.close();
      return results;
    }

    results.connected = true;

    // listen for new_message on B
    let received = false;
    socketB.on('new_message', (msg)=>{
      console.log('[socketB] got new_message', msg && (msg.text||msg._id));
      received = true;
    });

    // send message via HTTP endpoint from A to B
    const loginA = await postJson(BASE + '/auth/login', { email: uA.email, password: uA.password });
    const cookieForA = cookieJarFrom(loginA);
    const payload = { type:'text', text: 'Hello from socket test ' + Date.now() };
    const res = await fetch(BASE + '/chat/' + idB + '/message', { method:'POST', headers:{ 'content-type':'application/json', cookie: cookieForA }, body: JSON.stringify(payload) });
    if (res.status >= 400) results.errors.push('message POST failed: ' + res.status);

    // wait up to 5s for socket delivery
    for(let i=0;i<25;i++){
      if (received) break;
      await waitFor(200);
    }

    results.messageDelivered = !!received;

    socketA.close(); socketB.close();

  }catch(e){ results.errors.push(e.message || String(e)); }

  console.log('--- SOCKET TESTS END ---', results);
  return results;
}

module.exports = { runSocketTests };
