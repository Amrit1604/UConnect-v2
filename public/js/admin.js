// Admin front-end helper: secret key combo, animation, and admin login modal
(function () {
  'use strict';

  function createAdminOverlay() {
    if (document.getElementById('adminOverlay')) {
      // If overlay already exists, just return (handlers should be bound already)
      bindAdminHandlers(document.getElementById('adminOverlay'));
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'adminOverlay';
    overlay.className = 'admin-overlay';

    const modal = document.createElement('div');
    modal.id = 'adminModal';
    modal.className = 'admin-modal';
    modal.innerHTML = `
      <div class="admin-modal-inner">
        <h2 class="admin-modal-title">Admin Access</h2>
        <p class="admin-modal-sub">Please enter the admin password to continue.</p>
        <input id="adminPasswordInput" autocomplete="current-password" type="password" placeholder="Admin password" class="admin-input" />
        <div class="admin-actions">
          <button id="adminCancelBtn" class="admin-btn admin-btn-ghost">Cancel</button>
          <button id="adminLoginBtn" class="admin-btn admin-btn-primary">Unlock</button>
        </div>
        <div id="adminMsg" class="admin-msg"></div>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Event handlers
    bindAdminHandlers(overlay);


  function bindAdminHandlers(overlay) {
    const input = document.getElementById('adminPasswordInput');
    const loginBtn = document.getElementById('adminLoginBtn');
    const cancelBtn = document.getElementById('adminCancelBtn');
    const msg = document.getElementById('adminMsg');

    if (!input || !loginBtn || !cancelBtn) return;

    function clearMsg() {
      if (!msg) return;
      msg.textContent = '';
      msg.classList.remove('error');
      msg.classList.remove('success');
    }

    // Avoid duplicate event binding
    cancelBtn.addEventListener('click', () => {
      overlay.classList.remove('visible');
      overlay.classList.remove('eye-blink');
      clearMsg();
    });

    async function attemptLogin() {
      clearMsg();
      const password = input.value || '';
      if (!password) {
        if (msg) {
          msg.textContent = 'Please enter a password';
          msg.classList.add('error');
        }
        return;
      }
      loginBtn.disabled = true;
      try {
        const res = await fetch('/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          if (msg) {
            msg.textContent = data.message || 'Invalid password';
            msg.classList.add('error');
          }
          loginBtn.disabled = false;
          return;
        }
        if (msg) {
          msg.textContent = 'Access granted. Redirecting...';
          msg.classList.add('success');
        }
        // Short delay for visual feedback
        setTimeout(() => {
          window.location.href = '/admin';
        }, 700);
      } catch (err) {
        if (msg) {
          msg.textContent = 'Server error. Please try again.';
          msg.classList.add('error');
        }
      } finally {
        loginBtn.disabled = false;
      }
    }

    loginBtn.addEventListener('click', attemptLogin);
    input.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') attemptLogin();
    });
  }
    function clearMsg() {
      msg.textContent = '';
      msg.classList.remove('error');
      msg.classList.remove('success');
    }

    cancelBtn.addEventListener('click', () => {
      overlay.classList.remove('visible');
      overlay.classList.remove('eye-blink');
      clearMsg();
    });

    async function attemptLogin() {
      clearMsg();
      const password = input.value || '';
      if (!password) {
        msg.textContent = 'Please enter a password';
        msg.classList.add('error');
        return;
      }
      loginBtn.disabled = true;
      try {
        const res = await fetch('/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          msg.textContent = data.message || 'Invalid password';
          msg.classList.add('error');
          loginBtn.disabled = false;
          return;
        }
        msg.textContent = 'Access granted. Redirecting...';
        msg.classList.add('success');
        // Short delay for visual feedback
        setTimeout(() => {
          window.location.href = '/admin';
        }, 700);
      } catch (err) {
        msg.textContent = 'Server error. Please try again.';
        msg.classList.add('error');
      } finally {
        loginBtn.disabled = false;
      }
    }

    loginBtn.addEventListener('click', attemptLogin);
    input.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') attemptLogin();
    });
  }

  // Listen for Ctrl+Shift+Space
  let lastPressed = 0;
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
      // Prevent default behavior
      e.preventDefault();
      createAdminOverlay();
      const overlay = document.getElementById('adminOverlay');
      overlay.classList.add('eye-blink');
      setTimeout(() => {
        overlay.classList.add('visible');
        const input = document.getElementById('adminPasswordInput');
        if (input) input.focus();
      }, 350);
    }
  });

})();
