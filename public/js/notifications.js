// Fetch unread count and update navbar badge
(function(){
  function escapeHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  const badgeEl = document.getElementById('navNotificationsCount');
  const linkEl = document.getElementById('navNotificationsLink');
  // create popup container if missing
  let popup = document.getElementById('navNotificationsPopup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'navNotificationsPopup';
    popup.className = 'neo-notif-popup';
    popup.style.display = 'none';
    popup.innerHTML = '<div id="navNotificationsList" class="neo-notif-list"></div><div style="text-align:center;margin-top:8px"><a href="/notifications" class="nav-btn-ghost" style="padding:6px 12px;border-radius:8px">View all</a></div>';
    // attach near nav link
    if (linkEl && linkEl.parentElement) {
      linkEl.parentElement.style.position = 'relative';
      linkEl.parentElement.appendChild(popup);
    } else {
      document.body.appendChild(popup);
    }
  }

  async function refreshCount(){
    try{
      const res = await fetch('/notifications/api/count');
      const data = await res.json();
      if (!badgeEl) return;
      if (data && data.count && data.count > 0) { badgeEl.style.display = 'inline-block'; badgeEl.textContent = data.count; }
      else { badgeEl.style.display = 'none'; }
    } catch(e) { /* ignore */ }
  }

  async function loadList(){
    try{
      const res = await fetch('/notifications/api/list?limit=8');
      const data = await res.json();
      const listEl = document.getElementById('navNotificationsList');
      if (!listEl) return;
      listEl.innerHTML = '';
      if (!data || !data.notifications || data.notifications.length === 0) {
        listEl.innerHTML = '<div style="padding:12px;color:var(--white);opacity:0.7">No new notifications</div>';
        return;
      }

      data.notifications.forEach(n => {
        const sender = n.sender || {};
        const item = document.createElement('div');
          item.className = 'nav-notification-item neo-notif-item';
          item.style.display = 'flex';
          item.style.alignItems = 'center';
          item.style.gap = '12px';
          item.style.padding = '10px';
          item.style.borderRadius = '10px';
          item.style.background = 'transparent';

        const avatar = document.createElement('img');
        avatar.src = (sender.avatarUrl ? sender.avatarUrl : '/images/default-avatar.png') + '?v=' + Date.now();
        avatar.style.width = '42px'; avatar.style.height = '42px'; avatar.style.borderRadius = '8px'; avatar.style.objectFit = 'cover'; avatar.onerror = function(){ this.src='/images/default-avatar.png' };

        const meta = document.createElement('div');
        meta.style.flex = '1';
        meta.innerHTML = `<div style="font-weight:700;color:var(--white)">${n.title}</div><div style="font-size:12px;color:var(--white);opacity:0.65">${n.message}</div>`;

        const actions = document.createElement('div');
        actions.style.display = 'flex'; actions.style.gap='8px';

        // Only show accept/reject for follow_request notifications
        if (n.type === 'follow_request' && n.relatedId) {
          const acceptBtn = document.createElement('button');
          acceptBtn.className = 'btn-brutalist neo-accept-btn';
          acceptBtn.style.padding = '6px 10px';
          acceptBtn.style.fontSize = '12px';
          acceptBtn.textContent = 'Accept';
          acceptBtn.addEventListener('click', async () => {
            acceptBtn.disabled = true;
            try{
              const r = await fetch(`/chat/request/${n.relatedId}/accept`, { method: 'POST', headers: {'Content-Type':'application/json'} });
              const d = await r.json();
              if (d && d.success) {
                // mark notification read and update UI
                await fetch('/notifications/api/mark-read', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ids: [n._id] }) });
                loadList(); refreshCount();
              } else {
                acceptBtn.disabled = false;
                alert(d && d.message ? d.message : 'Failed');
              }
            }catch(e){ acceptBtn.disabled=false; alert('Network error'); }
          });

          const rejectBtn = document.createElement('button');
          rejectBtn.className = 'btn-glass neo-reject-btn';
          rejectBtn.style.padding='6px 10px'; rejectBtn.style.fontSize='12px'; rejectBtn.textContent='Reject';
          rejectBtn.addEventListener('click', async () => {
            rejectBtn.disabled = true;
            try{
              const r = await fetch(`/chat/request/${n.relatedId}/reject`, { method: 'POST', headers: {'Content-Type':'application/json'} });
              const d = await r.json();
              if (d && d.success) {
                await fetch('/notifications/api/mark-read', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ids: [n._id] }) });
                loadList(); refreshCount();
              } else {
                rejectBtn.disabled = false;
                alert(d && d.message ? d.message : 'Failed');
              }
            }catch(e){ rejectBtn.disabled=false; alert('Network error'); }
          });

          actions.appendChild(acceptBtn);
          actions.appendChild(rejectBtn);
        } else {
          // For non-actionable notifications show a link
          const viewLink = document.createElement('a');
          viewLink.href = n.actionUrl || '/notifications';
          viewLink.className = 'nav-btn-ghost';
          viewLink.textContent = 'Open';
          actions.appendChild(viewLink);
        }

        item.appendChild(avatar);
        item.appendChild(meta);
        item.appendChild(actions);
        listEl.appendChild(item);
      });
    } catch(e) {
      console.warn('Failed to load notifications', e);
    }
  }

  // initial
  refreshCount();

  // poll every 30s
  setInterval(refreshCount, 30000);

  // toggle popup on bell click
  if (linkEl) {
    linkEl.addEventListener('click', (e) => {
      e.preventDefault();
      if (popup.style.display === 'none') {
        popup.style.display = 'block';
        loadList();
      } else {
        popup.style.display = 'none';
      }
    });
  }

  // close popup when click outside
  document.addEventListener('click', (e) => {
    if (!popup.contains(e.target) && !(linkEl && linkEl.contains(e.target))) {
      popup.style.display = 'none';
    }
  });

  // listen for socket notifications
  if (window.io) {
    try {
      const s = io();
      s.on('notification', (payload) => { try{ refreshCount(); loadList(); }catch(e){} });
      s.on('follow_request', (payload) => { try{ refreshCount(); loadList(); }catch(e){} });
      // Admin broadcast messages (pop-up)
      s.on('admin:message', (payload) => {
        try {
          // lightweight toast/modal
          const t = document.createElement('div');
          t.className = 'admin-toast';
          t.style.position = 'fixed';
          t.style.right = '20px';
          t.style.bottom = '20px';
          t.style.zIndex = 99999;
          t.style.background = 'linear-gradient(180deg, rgba(0,20,0,0.95), rgba(0,10,0,0.95))';
          t.style.border = '1px solid rgba(0,255,0,0.06)';
          t.style.color = '#b7ffb7';
          t.style.padding = '12px 14px';
          t.style.borderRadius = '8px';
          t.style.boxShadow = '0 12px 40px rgba(0,0,0,0.6)';
          t.innerHTML = `<div style="font-weight:700;margin-bottom:6px">Admin message</div><div style="font-size:14px">${(payload && payload.message) ? escapeHtml(payload.message) : ''}</div>`;
          const btn = document.createElement('button');
          btn.textContent = 'Dismiss';
          btn.style.marginTop = '8px';
          btn.className = 'nav-btn-ghost';
          btn.addEventListener('click', () => { try { t.remove(); } catch (e) {} });
          t.appendChild(btn);
          document.body.appendChild(t);
          // auto-remove after 12s
          setTimeout(() => { try { t.remove(); } catch (e) {} }, 12000);
        } catch (e) { console.warn('Failed to show admin message', e); }
      });
    } catch (e) {}
  }

})();
