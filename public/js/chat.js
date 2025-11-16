// Minimal Chat client
// Responsibilities:
// - Connect to Socket.IO
// - Authenticate socket with current user ID
// - Join/leave conversation rooms
// - Send messages via REST and display incoming messages

(function(){
  if (typeof window === 'undefined') return;
  if (!window.io) return; // socket.io client not loaded

  const userId = window.__USER_ID__ || null;
  if (!userId) {
    console.warn('Chat client: user not logged in (no user id)');
    return;
  }

  const socket = io();

  socket.on('connect', () => {
    console.log('chat: socket connected', socket.id);
    socket.emit('authenticate', userId);
  });

  socket.on('disconnect', () => {
    console.log('chat: socket disconnected');
  });

  socket.on('new_message', (payload) => {
    try {
      const msg = payload.message;
      // Try to append to conversation list if present
      const convList = document.getElementById('conversationMessages');
      if (convList) {
        const li = document.createElement('div');
        // Determine sender id robustly
        const senderId = (msg && msg.sender && (msg.sender._id || msg.sender.id)) || (payload.sender && payload.sender.id);
        const isMe = senderId && String(senderId) === String(userId);
        li.className = 'chat-message-item ' + (isMe ? 'me' : '');
        // Attach message id when available
        if (msg && (msg._id || msg.id)) li.setAttribute('data-msg-id', msg._id || msg.id);
        const time = new Date(msg.sentAt || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        const senderName = (payload.sender && payload.sender.username) || (msg.sender && msg.sender.username) || 'Unknown';
        li.innerHTML = `<div><strong>${escapeHtml(senderName)}</strong> <span style="color:var(--muted);font-size:12px;margin-left:8px">${time}</span> <span class="read-receipt" style="float:right;color:var(--muted);font-size:11px"></span></div><div>${escapeHtml(msg.content || '')}</div>`;
        convList.appendChild(li);
        // Auto-scroll
        convList.scrollTop = convList.scrollHeight;
      }

      // Update conversations list preview if present
      const otherIdForPreview = (msg && msg.sender && (msg.sender._id || msg.sender.id)) || (payload.sender && payload.sender.id);
      const convItem = document.querySelector(`.conversation-item[data-other-id="${otherIdForPreview}"]`);
      if (convItem) {
        const last = convItem.querySelector('.last-message');
        if (last) last.textContent = msg.content ? (msg.content.slice(0,60)) : '';
      }
    } catch (e) { console.warn('chat: could not render incoming message', e); }
  });

  socket.on('user_online', ({ userId }) => {
    try {
      const otherId = window.__CHAT_OTHER_USER_ID__ || (document.querySelector('.chat-conversation') && document.querySelector('.chat-conversation').getAttribute('data-other-id'));
      if (otherId && String(userId) === String(otherId)) {
        const badge = document.getElementById('presenceBadge');
        if (badge) { badge.textContent = 'Online'; badge.classList.remove('offline'); badge.classList.add('online'); }
      }
    } catch (e) { /* ignore */ }
  });

  socket.on('user_offline', ({ userId }) => {
    try {
      const otherId = window.__CHAT_OTHER_USER_ID__ || (document.querySelector('.chat-conversation') && document.querySelector('.chat-conversation').getAttribute('data-other-id'));
      if (otherId && String(userId) === String(otherId)) {
        const badge = document.getElementById('presenceBadge');
        if (badge) { badge.textContent = 'Offline'; badge.classList.remove('online'); badge.classList.add('offline'); }
      }
    } catch (e) { /* ignore */ }
  });

  socket.on('user_typing', ({ userId, isTyping }) => {
    try {
      const otherId = window.__CHAT_OTHER_USER_ID__ || (document.querySelector('.chat-conversation') && document.querySelector('.chat-conversation').getAttribute('data-other-id'));
      // if typing event matches the other user in current view, show indicator
      if (otherId && String(userId) === String(otherId)){
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.textContent = isTyping ? 'Typing...' : '';
      }
    } catch (e) { /* ignore */ }
  });

  // Read receipt handling: mark messages as read when server notifies
  socket.on('messages_read_receipt', ({ from, to, count }) => {
    try {
      // This event notifies the sender that 'to' has read `count` messages
      // If I'm the sender (my userId === from) and current view is the conversation with 'to', mark last `count` sent messages as read
      if (String(from) !== String(userId)) return;
      const currentOther = window.__CHAT_OTHER_USER_ID__ || (document.querySelector('.chat-conversation') && document.querySelector('.chat-conversation').getAttribute('data-other-id'));
      if (!currentOther || String(currentOther) !== String(to)) return;

      const myMsgs = Array.from(document.querySelectorAll('.chat-message-item.me[data-msg-id]'));
      if (!myMsgs.length) return;
      const toMark = Math.min(count || 0, myMsgs.length);
      for (let i = myMsgs.length - toMark; i < myMsgs.length; i++) {
        const el = myMsgs[i];
        if (!el) continue;
        const rr = el.querySelector('.read-receipt');
        if (rr) rr.textContent = 'Read';
        el.setAttribute('data-read','true');
      }
    } catch (err) { console.warn('read receipt handler error', err); }
  });

  // Helper to join a conversation room
  window.chatJoinConversation = function(otherUserId) {
    socket.emit('join_conversation', { userId, otherUserId });
    // mark current conversation in DOM
    window.__CHAT_OTHER_USER_ID__ = otherUserId;
    // Tell server we've read messages in this conversation (trigger read receipts)
    try { socket.emit('messages_read', { userId, otherUserId }); } catch (e){}
    console.log('chat: join conversation with', otherUserId);
  };

  window.chatLeaveConversation = function(otherUserId) {
    socket.emit('leave_conversation', { userId, otherUserId });
    window.__CHAT_OTHER_USER_ID__ = null;
    console.log('chat: leave conversation with', otherUserId);
  };

  // Send message via REST endpoint; server will emit new_message
  window.chatSendMessage = async function(otherUserId, content) {
    try {
      const res = await fetch(`/chat/${otherUserId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'send failed');

      // Append locally
      const convList = document.getElementById('conversationMessages');
      if (convList) {
        const li = document.createElement('div');
        li.className = 'chat-message-item me';
        // attach message id if server returned one
        if (data.message && (data.message._id || data.message.id)) li.setAttribute('data-msg-id', data.message._id || data.message.id);
        const time = new Date((data.message && data.message.sentAt) || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        li.innerHTML = `<div><strong>You</strong> <span style="color:var(--muted);font-size:12px;margin-left:8px">${time}</span> <span class="read-receipt" style="float:right;color:var(--muted);font-size:11px"></span></div><div>${escapeHtml(content)}</div>`;
        convList.appendChild(li);
        convList.scrollTop = convList.scrollHeight;
      }
      return data;
    } catch (err) {
      console.error('chat send error', err);
      throw err;
    }
  };

  // Handle accept/reject actions via delegation
  document.addEventListener('click', async (ev) => {
    const target = ev.target;
    if (!target) return;
    if (target.classList.contains('accept-btn') || target.classList.contains('reject-btn') || target.classList.contains('block-btn')) {
      ev.preventDefault();
      const id = target.getAttribute('data-id');
      let path = `/chat/request/${id}/` + (target.classList.contains('accept-btn') ? 'accept' : target.classList.contains('reject-btn') ? 'reject' : 'block');
      try {
        const res = await fetch(path, { method: 'POST', headers: { 'Content-Type':'application/json' } });
        if (!res.ok) throw new Error('action failed');
        // Remove item from DOM
        const item = document.querySelector(`.request-item[data-id="${id}"]`);
        if (item) item.remove();
      } catch (err) {
        console.error('request action failed', err);
        alert('Failed to perform action');
      }
    }
  });

  // Typing helpers
  let typingTimer = null;
  window.chatTyping = function(otherUserId, isStart) {
    socket.emit(isStart ? 'typing_start' : 'typing_stop', { userId, otherUserId });
    if (isStart) {
      if (typingTimer) clearTimeout(typingTimer);
      typingTimer = setTimeout(() => socket.emit('typing_stop', { userId, otherUserId }), 3000);
    }
  };

  // Basic HTML escape
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"'`]/g, function(s) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;","`":"&#96;"})[s];
    });
  }

  // Expose socket for debugging
  window.__CHAT_SOCKET__ = socket;
})();
