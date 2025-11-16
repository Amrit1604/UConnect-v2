// Fetch unread count and update navbar badge
(function(){
  async function refreshCount(){
    try{
      const res = await fetch('/notifications/api/count');
      const data = await res.json();
      const el = document.getElementById('navNotificationsCount');
      if (!el) return;
      if (data && data.count && data.count > 0) { el.style.display = 'inline-block'; el.textContent = data.count; }
      else { el.style.display = 'none'; }
    } catch(e) { /* ignore */ }
  }

  // initial
  refreshCount();

  // poll every 30s
  setInterval(refreshCount, 30000);

  // listen for socket notifications
  if (window.io) {
    const s = window.io();
    s.on('notification', (payload) => { try{ refreshCount(); }catch(e){} });
  }
})();
