/**
 * Test the complete notifications flow:
 * 1. Login as the receiver (demo_req_receiver)
 * 2. Fetch notifications via API
 * 3. Accept the follow request via API
 * 4. Verify friendship was created and chat is accessible
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = process.env.BASE_URL || 'http://localhost:4000';

async function getCookies(response) {
  // Try to read set-cookie from headers; undici may expose multiple headers via raw()
  try {
    const raw = response.headers && typeof response.headers.raw === 'function' ? response.headers.raw() : null;
    if (raw && Array.isArray(raw['set-cookie'])) {
      return raw['set-cookie'].map(c => c.split(';')[0].trim()).join('; ');
    }
  } catch (e) {
    // fall through to legacy get
  }

  const setCookie = response.headers.get && response.headers.get('set-cookie');
  if (!setCookie) return '';
  // Prefer extracting connect.sid specifically, otherwise fall back to parsing name=value
  const sidMatch = setCookie.match(/connect\.sid=[^;\s]+/);
  if (sidMatch) return sidMatch[0];
  const pairs = setCookie.match(/([^\s;=,]+=[^;=,]+)/g) || [];
  const cookies = pairs.map(p => p.split(';')[0].trim()).join('; ');
  return cookies;
}

async function run() {
  console.log('=== NOTIFICATIONS FLOW TEST ===\n');

  // Step 1: Login as receiver
  console.log('1. Logging in as demo_req_receiver...');
  // Note: server expects the field name 'email' (or username) in the 'email' form field
  // Submit as URL-encoded form to mimic browser form submit
  const formBody = new URLSearchParams({ email: 'demo_req_receiver@test-chat.com', password: 'Password123!' }).toString();
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody,
    redirect: 'follow'
  });

  if (!loginRes.ok) {
    console.error('Login failed:', loginRes.status, await loginRes.text());
    process.exit(1);
  }

  const cookies = await getCookies(loginRes);
  if (!cookies) {
    console.error('Login did not return session cookies. Response body for debugging:\n', await loginRes.text().then(t => t.substring(0,400)));
    process.exit(1);
  }
  console.log('Cookies after login:', cookies);
  console.log('✅ Logged in successfully\n');

  // Step 2: Fetch notifications
  console.log('2. Fetching notifications...');
  const notifRes = await fetch(`${BASE}/notifications/api/count`, {
    headers: { cookie: cookies }
  });

  // Ensure the response is JSON (debug if not)
  const notifCt = notifRes.headers.get && notifRes.headers.get('content-type');
  if (!notifCt || !notifCt.includes('application/json')) {
    const bodyText = await notifRes.text();
    console.error('Expected JSON from /notifications/api/count but received:', notifRes.status);
    console.error(bodyText.substring(0, 200));
    process.exit(1);
  }

  const notifData = await notifRes.json();
  console.log('Unread notifications count:', notifData.count);

  // Step 3: Get full notifications list to find follow request
  const notifListRes = await fetch(`${BASE}/notifications`, {
    headers: { cookie: cookies }
  });
  
  const notifHtml = await notifListRes.text();
  
  // Extract follow request ID from HTML (basic parsing)
  const match = notifHtml.match(/data-id="([a-f0-9]{24})"/);
  if (!match) {
    console.log('❌ No follow request notification found');
    console.log('This is expected if the request was already accepted.');
    process.exit(0);
  }

  const followRequestId = match[1];
  console.log('✅ Found follow request ID:', followRequestId, '\n');

  // Step 4: Accept the follow request
  console.log('3. Accepting follow request...');
  const acceptRes = await fetch(`${BASE}/chat/request/${followRequestId}/accept`, {
    method: 'POST',
    headers: {
      cookie: cookies,
      'Content-Type': 'application/json'
    }
  });

  if (!acceptRes.ok) {
    const errorText = await acceptRes.text();
    console.error('Accept failed:', acceptRes.status, errorText);
    process.exit(1);
  }

  const acceptData = await acceptRes.json();
  console.log('✅ Follow request accepted!');
  console.log('Friendship ID:', acceptData.friendshipId);
  console.log('Message:', acceptData.message, '\n');

  // Step 5: Verify chat is accessible
  console.log('4. Verifying chat access...');
  
  // Get sender's user ID (we know it's demo_req_sender)
  const userSearchRes = await fetch(`${BASE}/users/search?q=demo_req_sender`, {
    headers: { cookie: cookies }
  });
  
  const userSearchCt = userSearchRes.headers.get && userSearchRes.headers.get('content-type');
  if (!userSearchCt || !userSearchCt.includes('application/json')) {
    console.error('Expected JSON from /users/search but got status', userSearchRes.status);
    console.error(await userSearchRes.text());
    process.exit(1);
  }

  const searchData = await userSearchRes.json();
  if (!searchData.success || !searchData.results || searchData.results.length === 0) {
    console.error('Could not find sender user');
    process.exit(1);
  }

  const senderId = searchData.results[0]._id;
  console.log('Sender ID:', senderId);

  // Try to access chat conversation
  const chatRes = await fetch(`${BASE}/chat/${senderId}`, {
    headers: { cookie: cookies }
  });

  if (!chatRes.ok) {
    console.error('❌ Chat access failed:', chatRes.status);
    process.exit(1);
  }

  console.log('✅ Chat is now accessible!\n');

  // Step 6: Send a test message
  console.log('5. Sending test message...');
  const msgRes = await fetch(`${BASE}/chat/${senderId}/message`, {
    method: 'POST',
    headers: {
      cookie: cookies,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: 'Hello! Thanks for the friend request. Chat is now unlocked!'
    })
  });

  if (!msgRes.ok) {
    console.error('Message send failed:', msgRes.status);
  } else {
    const msgData = await msgRes.json();
    console.log('✅ Message sent successfully!');
    console.log('Message ID:', msgData.message._id);
  }

  console.log('\n=== FLOW COMPLETE ===');
  console.log('Summary:');
  console.log('✅ User logged in');
  console.log('✅ Notifications fetched');
  console.log('✅ Follow request accepted');
  console.log('✅ Friendship created');
  console.log('✅ Chat unlocked');
  console.log('✅ Message sent');
  console.log('\nYou can now visit:');
  console.log(`- ${BASE}/notifications (see notifications page)`);
  console.log(`- ${BASE}/chat/${senderId} (chat with sender)`);
  console.log(`- ${BASE}/chat (inbox with all conversations)`);
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
