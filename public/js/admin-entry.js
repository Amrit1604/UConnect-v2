(function(){
  // Global keyboard shortcut Ctrl+Shift+Space to open admin password prompt
  function createPrompt() {
    const overlay = document.createElement('div');
    overlay.id = 'adminEntryOverlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = 2000;

    const box = document.createElement('div');
    box.style.background = '#071014';
    box.style.padding = '18px';
    box.style.borderRadius = '8px';
    box.style.minWidth = '320px';
    box.style.boxShadow = '0 12px 40px rgba(0,0,0,0.6)';

    const label = document.createElement('div');
    label.style.color = '#cdebb3';
    label.style.marginBottom = '8px';
    label.textContent = 'Admin access — enter password';

    const input = document.createElement('input');
    input.type = 'password';
    input.placeholder = 'Admin password';
    input.style.width = '100%';
    input.style.padding = '8px 10px';
    input.style.borderRadius = '6px';
    input.style.border = '1px solid rgba(255,255,255,0.04)';
    input.style.background = 'rgba(255,255,255,0.02)';
    input.style.color = 'var(--white)';

    const buttons = document.createElement('div');
    buttons.style.display = 'flex';
    buttons.style.justifyContent = 'flex-end';
    buttons.style.gap = '8px';
    buttons.style.marginTop = '10px';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.style.padding = '6px 10px';

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.textContent = 'Enter';
    submit.style.padding = '6px 10px';
    submit.style.background = 'rgba(57,255,20,0.12)';
    submit.style.border = '1px solid rgba(57,255,20,0.9)';
    submit.style.color = '#dfffe0';
    submit.style.borderRadius = '6px';

    buttons.appendChild(cancel);
    buttons.appendChild(submit);
    box.appendChild(label);
    box.appendChild(input);
    box.appendChild(buttons);
    overlay.appendChild(box);

    function close() { document.body.removeChild(overlay); }
    cancel.addEventListener('click', close);
    overlay.addEventListener('click', function(e){ if (e.target === overlay) close(); });

    submit.addEventListener('click', async function(){
      const pw = input.value || '';
      try {
        const res = await fetch('/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
        const json = await res.json();
        if (json && json.success) {
          close();
          // open terminal in current window
          window.location.href = '/admin/terminal';
        } else {
          label.textContent = 'Invalid password — try again';
          label.style.color = '#ffb3b3';
        }
      } catch (err) {
        label.textContent = 'Error contacting server';
        label.style.color = '#ffb3b3';
      }
    });

    input.addEventListener('keydown', function(e){ if (e.key === 'Enter') submit.click(); });

    document.body.appendChild(overlay);
    input.focus();
  }

  window.addEventListener('keydown', function(e){
    if (e.code === 'Space' && e.ctrlKey && e.shiftKey) {
      // prevent default space scrolling
      e.preventDefault();
      createPrompt();
    }
  });
})();
