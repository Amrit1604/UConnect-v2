(function(){
  // Chat sidebar that lists friends and allows opening chat without leaving page
  const toggle = document.getElementById('navChatToggle');
  if (!toggle) return;

  // create sidebar
  let sidebar = document.getElementById('chatSidebar');
  if (!sidebar) {
    sidebar = document.createElement('div');
    sidebar.id = 'chatSidebar';
    sidebar.className = 'neo-chat-sidebar';
    sidebar.style.position = 'fixed';
    sidebar.style.top = '0';
    sidebar.style.right = '-420px';
    sidebar.style.width = '420px';
    sidebar.style.height = '100%';
    sidebar.style.zIndex = 1400;
    sidebar.style.transition = 'right 0.28s ease';
    sidebar.innerHTML = `
      <div style="padding:18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--glass-border)">
        <strong style="color:var(--white)">Inbox</strong>
        <button id="closeChatSidebar" class="nav-btn-ghost">Close</button>
      </div>
      <div id="friendsListContainer" style="padding:12px;overflow:auto;height:calc(100% - 64px)"></div>
    `;
    document.body.appendChild(sidebar);
  }

  async function loadFriends(){
    const container = document.getElementById('friendsListContainer');
    if (!container) return;
    container.innerHTML = '<div style="padding:12px;color:rgba(255,255,255,0.6)">Loading...</div>';
    try{
      const res = await fetch('/friends/api/list');
      const data = await res.json();
      if (!data || !data.results) { container.innerHTML = '<div style="padding:12px;color:rgba(255,255,255,0.6)">No friends</div>'; return; }
      container.innerHTML = '';
      data.results.forEach(r => {
        const u = r.user;
        if (!u) return;
        const row = document.createElement('div');
        row.style.display='flex'; row.style.alignItems='center'; row.style.justifyContent='space-between'; row.style.gap='12px'; row.style.padding='8px'; row.style.borderRadius='8px'; row.style.marginBottom='8px'; row.style.background='rgba(255,255,255,0.02)';
        row.innerHTML = `
          <div style="display:flex;align-items:center;gap:12px">
            <img src="${u.avatarUrl}?v=${Date.now()}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;border:2px solid var(--red)" onerror="this.src='/images/default-avatar.png'">
            <div style="color:var(--white)"><div style="font-weight:700">@${u.username}</div><div style="font-size:12px;color:rgba(255,255,255,0.6)">${u.name||''}</div></div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="open-chat-mini nav-btn-ghost" data-user-id="${u._id}">Open</button>
          </div>
        `;
        container.appendChild(row);
      });
      // attach handlers
      container.querySelectorAll('.open-chat-mini').forEach(b => b.addEventListener('click', () => {
        const uid = b.getAttribute('data-user-id');
        if (!uid) return;
        // open chat in a new window/tab or navigate
        window.location.href = '/chat/' + uid;
      }));
    } catch (e) {
      container.innerHTML = '<div style="padding:12px;color:rgba(255,255,255,0.6)">Failed to load friends</div>';
    }
  }

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    if (sidebar.style.right === '0px') {
      sidebar.style.right = '-420px';
    } else {
      sidebar.style.right = '0px';
      loadFriends();
    }
  });

  const closeBtn = document.getElementById('closeChatSidebar');
  if (closeBtn) closeBtn.addEventListener('click', () => { sidebar.style.right='-420px'; });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
      sidebar.style.right='-420px';
    }
  });

})();
