(function(){
  const out = document.getElementById('terminalOutput');
  const input = document.getElementById('terminalInput');
  const form = document.getElementById('terminalForm');
  if (!out || !input || !form) return;

  const history = [];
  let histIdx = -1;
  // caches for numbered references
  let lastUsers = [];
  let lastPosts = [];

  function appendLine(html, cls) {
    const div = document.createElement('div');
    div.className = cls || 'term-line';
    div.innerHTML = html;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  }

  function prettyJSON(obj) {
    try { return '<pre class="term-pre">' + JSON.stringify(obj, null, 2) + '</pre>'; }
    catch (e) { return String(obj); }
  }

  async function runCommand(raw) {
    const line = raw.trim();
    if (!line) return;
    appendLine('<span class="prompt">$</span> ' + escapeHtml(line), 'term-cmd');
    history.push(line);
    histIdx = history.length;

    const parts = line.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    try {
      switch (cmd) {
        case 'help':
          appendLine('<div class="help-list">\n  <div><strong>help</strong> — show this help</div>\n  <div><strong>status</strong> — show system status</div>\n  <div><strong>users [limit]</strong> — list users (numbered)</div>\n  <div><strong>posts [limit]</strong> — list posts (numbered)</div>\n  <div><strong>audit [limit]</strong> — recent admin logs</div>\n  <div><strong>finduser &lt;q&gt;</strong> — lookup user by username/email/displayName</div>\n  <div><strong>deactivate &lt;username|userId|#n&gt;</strong> — toggle active status</div>\n  <div><strong>deleteuser &lt;username|userId|#n&gt;</strong> — delete user and posts</div>\n  <div><strong>deletepost &lt;postId|#n&gt;</strong> — delete a post (use <code>posts</code> to get numbers)</div>\n  <div><strong>run &lt;script&gt;</strong> — run allowed script (fixCampus, testGridFS)</div>\n  <div><strong>fixcampus</strong> / <strong>testgridfs</strong> — script shortcuts</div>\n  <div><strong>jest</strong> — run tests (blocking)</div>\n  <div><strong>jeststream</strong> — run tests with live stream</div>\n  <div><strong>clear</strong> — clear terminal output</div>\n  <div style="margin-top:8px;color:rgba(183,255,183,0.7);">Tip: After listing, reference items by number: <code>posts</code> then <code>deletepost 3</code></div>\n</div>');
          break;

        case 'clear':
          out.innerHTML = '';
          break;

        case 'status': {
          appendLine('Fetching status...', 'term-info');
          const res = await fetch('/admin/api/status');
          const json = await res.json();
          appendLine(prettyJSON(json), 'term-json');
          break;
        }

        case 'users': {
          const limit = parseInt(parts[1], 10) || 50;
          appendLine('Loading users (limit=' + limit + ')...', 'term-info');
          const res = await fetch('/admin/api/list/users?limit=' + encodeURIComponent(limit));
          const json = await res.json();
          if (!json.success) { appendLine('<span class="term-error">Failed to load users</span>'); break; }
          lastUsers = json.users || [];
          const rows = lastUsers.map((u, idx) => `<div class=\"term-row\"><span class=\"num\">#${idx+1}</span> <span class=\"mono\">${u.username}</span> — ${escapeHtml(u.displayName||'')} — ${escapeHtml(u.email||'')} — <span class=\"muted\">${u.campus||''}</span> — <strong>${u.isActive? 'active':'inactive'}</strong></div>`).join('');
          appendLine(rows, 'term-table');
          break;
        }

        case 'posts': {
          const limit = parseInt(parts[1], 10) || 50;
          appendLine('Loading posts (limit=' + limit + ')...', 'term-info');
          const res = await fetch('/admin/api/list/posts?limit=' + encodeURIComponent(limit));
          const json = await res.json();
          if (!json.success) { appendLine('<span class="term-error">Failed to load posts</span>'); break; }
          lastPosts = json.posts || [];
          const rows = lastPosts.map((p, idx) => `<div class=\"term-row\"><span class=\"num\">#${idx+1}</span> <span class=\"mono\">${p._id}</span> — ${escapeHtml(p.author && (p.author.username||p.author.displayName) || 'unknown')} — <span class=\"muted\">${new Date(p.createdAt).toLocaleString()}</span> — <strong>${p.isActive? 'active':'inactive'}</strong> — reports:${p.reportCount||0}</div>`).join('');
          appendLine(rows, 'term-table');
          break;
        }

        case 'audit': {
          const limit = parseInt(parts[1], 10) || 200;
          appendLine('Loading audit logs (limit=' + limit + ')...', 'term-info');
          const res = await fetch('/admin/api/list/audit?limit=' + encodeURIComponent(limit));
          const json = await res.json();
          if (!json.success) { appendLine('<span class="term-error">Failed to load audit logs</span>'); break; }
          const rows = json.logs.map(l => `<div class=\"term-row\"><span class=\"muted\">${new Date(l.createdAt).toLocaleString()}</span> — <strong>${escapeHtml(l.action)}</strong> — ${escapeHtml(JSON.stringify(l.details||{}))}</div>`).join('');
          appendLine(rows, 'term-table');
          break;
        }

        case 'run': {
          const script = parts[1];
          if (!script) { appendLine('<span class="term-error">Usage: run &lt;script&gt; (fixCampus, testGridFS)</span>'); break; }
          appendLine('Running script: ' + escapeHtml(script), 'term-info');
          const res = await fetch('/admin/api/run', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script })
          });
          const json = await res.json();
          appendLine(prettyJSON(json), 'term-json');
          break;
        }

        // shorthand aliases for common scripts typed directly in terminal
        case 'testgridfs':
        case 'fixcampus': {
          const script = cmd === 'testgridfs' ? 'testGridFS' : 'fixCampus';
          appendLine('Running script: ' + escapeHtml(script), 'term-info');
          const res = await fetch('/admin/api/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ script })
          });
          const json = await res.json();
          appendLine(prettyJSON(json), 'term-json');
          break;
        }

        // helper shortcut: run:scriptName
        case 'run:testgridfs':
        case 'run:fixcampus': {
          // map lower-case command to allowed script
          const map = { 'run:testgridfs': 'testGridFS', 'run:fixcampus': 'fixCampus' };
          const script = map[cmd] || parts[1];
          appendLine('Running script: ' + escapeHtml(script), 'term-info');
          const res = await fetch('/admin/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script }) });
          const json = await res.json();
          appendLine(prettyJSON(json), 'term-json');
          break;
        }

        case 'logout': {
          appendLine('Logging out admin session...', 'term-info');
          try {
            const res = await fetch('/admin/logout', { method: 'POST', headers: { 'Accept': 'application/json' } });
            const json = await res.json();
            appendLine(prettyJSON(json), 'term-json');
            if (json && json.success) {
              appendLine('<div class="term-info">Redirecting to homepage...</div>');
              setTimeout(() => { window.location.href = '/'; }, 800);
            }
          } catch (err) {
            appendLine('<span class="term-error">Logout failed: ' + escapeHtml(err.message || String(err)) + '</span>');
          }
          break;
        }

        case 'recent-signups': {
          const limit = parseInt(parts[1], 10) || 50;
          appendLine('Fetching recent signups...', 'term-info');
          const res = await fetch('/admin/api/recent-signups?limit=' + encodeURIComponent(limit));
          const json = await res.json();
          if (!json.success) { appendLine('<span class="term-error">Failed to fetch signups</span>'); break; }
          const rows = json.users.map((u, idx) => `<div class=\\"term-row\\"><span class=\\"num\\">#${idx+1}</span> <strong>${escapeHtml(u.username)}</strong> — ${escapeHtml(u.email||'')} — <span class=\\"muted\\">${new Date(u.createdAt).toLocaleString()}</span></div>`).join('');
          appendLine(rows, 'term-table');
          break;
        }

        case 'login-history': {
          const limit = parseInt(parts[1], 10) || 50;
          appendLine('Fetching recent login history...', 'term-info');
          const res = await fetch('/admin/api/login-history?limit=' + encodeURIComponent(limit));
          const json = await res.json();
          if (!json.success) { appendLine('<span class=\"term-error\">Failed to fetch login history</span>'); break; }
          const rows = json.users.map((u, idx) => `<div class=\\"term-row\\"><span class=\\"num\\">#${idx+1}</span> <strong>${escapeHtml(u.username)}</strong> — ${escapeHtml(u.email||'')} — <span class=\\"muted\\">${new Date(u.lastLogin).toLocaleString()}</span></div>`).join('');
          appendLine(rows, 'term-table');
          break;
        }

        case 'online': {
          appendLine('Fetching online users...', 'term-info');
          const res = await fetch('/admin/api/online');
          const json = await res.json();
          if (!json.success) { appendLine('<span class=\"term-error\">Failed to fetch online users</span>'); break; }
          appendLine('<div class=\"term-info\">Online: ' + (json.onlineCount || 0) + ' sockets: ' + (json.socketCount || 0) + '</div>');
          if (json.users && json.users.length) appendLine(prettyJSON(json.users), 'term-json');
          break;
        }

        case 'traffic': {
          appendLine('Fetching traffic snapshot...', 'term-info');
          const res = await fetch('/admin/api/traffic');
          const json = await res.json();
          appendLine(prettyJSON(json), 'term-json');
          break;
        }

        case 'broadcast': {
          const msg = parts.slice(1).join(' ');
          if (!msg) { appendLine('<span class=\"term-error\">Usage: broadcast &lt;message&gt;</span>'); break; }
          appendLine('Broadcasting message: ' + escapeHtml(msg), 'term-info');
          const res = await fetch('/admin/api/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) });
          const json = await res.json();
          appendLine(prettyJSON(json), 'term-json');
          break;
        }

        case 'jest':
        case 'runtests': {
          appendLine('Running full Jest suite (this may take a while)...', 'term-info');
          try {
            const res = await fetch('/admin/api/run-jest', { method: 'POST' });
            const json = await res.json();
            if (json.success && json.report) {
              appendLine(prettyJSON(json.report), 'term-json');
            } else {
              appendLine('<div class="term-error">Test runner returned an error or no report.</div>');
              if (json.raw) appendLine('<pre class="term-pre">' + escapeHtml(json.raw) + '</pre>');
              if (json.rawSnippet) appendLine('<pre class="term-pre">' + escapeHtml(json.rawSnippet) + '</pre>');
            }
          } catch (err) {
            appendLine('<span class="term-error">Failed to run tests: ' + escapeHtml(err.message || String(err)) + '</span>');
          }
          break;
        }

        case 'jeststream':
        case 'streamtests': {
          appendLine('Opening test stream...', 'term-info');
          try {
            const es = new EventSource('/admin/api/run-jest-stream');
            appendLine('<div class="term-info">Stream opened — incoming logs will appear below.</div>');
            es.onmessage = function(e) {
              try {
                const obj = JSON.parse(e.data);
                if (obj.type === 'stdout' || obj.type === 'stderr') {
                  // show raw text lines, split on newlines
                  const txt = obj.text || '';
                  txt.split(/\r?\n/).forEach(line => { if (line) appendLine(escapeHtml(line), 'term-line'); });
                } else if (obj.type === 'report') {
                  appendLine('<div class="term-info">Test report received</div>');
                  appendLine(prettyJSON(obj.report), 'term-json');
                } else if (obj.type === 'report_error') {
                  appendLine('<div class="term-error">Report parse error: ' + escapeHtml(obj.message || '') + '</div>');
                  if (obj.snippet) appendLine('<pre class="term-pre">' + escapeHtml(obj.snippet) + '</pre>');
                } else if (obj.type === 'no_report') {
                  appendLine('<div class="term-error">No JSON report found. Raw output:</div>');
                  appendLine('<pre class="term-pre">' + escapeHtml(obj.raw || '') + '</pre>');
                } else if (obj.type === 'end') {
                  appendLine('<div class="term-info">Stream ended (code=' + (obj.code || 0) + ')</div>');
                  try { es.close(); } catch (e) {}
                } else if (obj.type === 'error') {
                  appendLine('<div class="term-error">' + escapeHtml(obj.message || 'Error') + '</div>');
                }
              } catch (err) {
                appendLine('<div class="term-error">Malformed event data</div>');
              }
            };
            es.onerror = function(e) {
              appendLine('<div class="term-error">Stream error or connection closed.</div>');
              try { es.close(); } catch (e) {}
            };
          } catch (err) {
            appendLine('<span class="term-error">Failed to open stream: ' + escapeHtml(err.message || String(err)) + '</span>');
          }
          break;
        }

        case 'finduser': {
          const q = parts.slice(1).join(' ');
          if (!q) { appendLine('<span class="term-error">Usage: finduser &lt;query&gt;</span>'); break; }
          appendLine('Searching users for: ' + escapeHtml(q), 'term-info');
          const res = await fetch('/admin/api/find/user?q=' + encodeURIComponent(q));
          const json = await res.json();
          if (!json.success) { appendLine('<span class="term-error">Search failed</span>'); break; }
          lastUsers = json.users || [];
          const rows = lastUsers.map((u, idx) => `<div class=\"term-row\"><span class=\"num\">#${idx+1}</span> <span class=\"mono\">${u._id}</span> • ${escapeHtml(u.username||'')} • ${escapeHtml(u.displayName||'')} • ${escapeHtml(u.email||'')} • <strong>${u.isActive? 'active':'inactive'}</strong></div>`).join('');
          appendLine(rows, 'term-table');
          break;
        }

        case 'deactivate': {
          const target = parts.slice(1).join(' ');
          if (!target) { appendLine('<span class="term-error">Usage: deactivate &lt;username|userId|#n&gt;</span>'); break; }
          let userId = null;
          // numeric reference like 3 or #3 maps to lastUsers
          const m = target.match(/^#?(\d+)$/);
          if (m) {
            const idx = parseInt(m[1], 10) - 1;
            if (lastUsers[idx]) userId = lastUsers[idx]._id;
          }
          // if looks like an ObjectId-ish string, treat as id
          if (!userId && /^[0-9a-fA-F]{24}$/.test(target)) userId = target;
          // otherwise assume username; try to find via API
          if (!userId) {
            const res = await fetch('/admin/api/find/user?q=' + encodeURIComponent(target));
            const json = await res.json();
            if (json.success && json.users && json.users.length > 0) userId = json.users[0]._id;
          }
          if (!userId) { appendLine('<span class="term-error">Could not resolve user: ' + escapeHtml(target) + '</span>'); break; }
          appendLine('Toggling active for user id ' + escapeHtml(userId), 'term-info');
          const resToggle = await fetch('/admin/api/users/' + encodeURIComponent(userId) + '/toggle', { method: 'POST' });
          const jsonToggle = await resToggle.json();
          appendLine(prettyJSON(jsonToggle), 'term-json');
          break;
        }

        case 'deleteuser': {
          const target = parts.slice(1).join(' ');
          if (!target) { appendLine('<span class="term-error">Usage: deleteuser &lt;username|userId|#n&gt;</span>'); break; }
          let userId = null;
          const m = target.match(/^#?(\d+)$/);
          if (m) {
            const idx = parseInt(m[1], 10) - 1;
            if (lastUsers[idx]) userId = lastUsers[idx]._1d || lastUsers[idx]._id || null;
          }
          if (!userId && /^[0-9a-fA-F]{24}$/.test(target)) userId = target;
          if (!userId) {
            const resFind = await fetch('/admin/api/find/user?q=' + encodeURIComponent(target));
            const jsonFind = await resFind.json();
            if (jsonFind.success && jsonFind.users && jsonFind.users.length > 0) userId = jsonFind.users[0]._id;
          }
          if (!userId) { appendLine('<span class="term-error">Could not resolve user: ' + escapeHtml(target) + '</span>'); break; }
          if (!confirm('Confirm delete user ' + userId + ' ? This will remove their posts.')) { appendLine('<span class="term-info">Aborted</span>'); break; }
          appendLine('Deleting user ' + escapeHtml(userId), 'term-info');
          const res = await fetch('/admin/api/users/' + encodeURIComponent(userId), { method: 'DELETE' });
          const json = await res.json();
          appendLine(prettyJSON(json), 'term-json');
          break;
        }

        case 'deletepost': {
          const target = parts[1];
          if (!target) { appendLine('<span class="term-error">Usage: deletepost &lt;postId|#n&gt;</span>'); break; }
          let postId = null;
          const m = target.match(/^#?(\d+)$/);
          if (m) {
            const idx = parseInt(m[1], 10) - 1;
            if (lastPosts[idx]) postId = lastPosts[idx]._id;
          }
          if (!postId && /^[0-9a-fA-F]{24}$/.test(target)) postId = target;
          if (!postId) { appendLine('<span class="term-error">Could not resolve post: ' + escapeHtml(target) + '</span>'); break; }
          if (!confirm('Confirm delete post ' + postId + ' ?')) { appendLine('<span class="term-info">Aborted</span>'); break; }
          appendLine('Deleting post ' + escapeHtml(postId), 'term-info');
          const res = await fetch('/admin/api/posts/' + encodeURIComponent(postId), { method: 'DELETE' });
          const json = await res.json();
          appendLine(prettyJSON(json), 'term-json');
          break;
        }

        default:
          appendLine('<span class="term-error">Unknown command: ' + escapeHtml(cmd) + '. Type <strong>help</strong>.</span>');
      }
    } catch (err) {
      console.error('Terminal command error:', err);
      appendLine('<span class="term-error">Error: ' + escapeHtml(err.message || String(err)) + '</span>');
    }
  }

  function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = '';
    runCommand(v);
    input.focus();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      if (history.length && histIdx > 0) { histIdx -= 1; input.value = history[histIdx]; }
      else if (history.length && histIdx === history.length) { histIdx = history.length - 1; input.value = history[histIdx]; }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (history.length && histIdx < history.length - 1) { histIdx += 1; input.value = history[histIdx]; }
      else { histIdx = history.length; input.value = ''; }
      e.preventDefault();
    }
  });

  // initial prompt
  appendLine('<div class="welcome">Welcome to UConnect Admin Terminal. Type <strong>help</strong> for commands.</div>','term-welcome');
  input.focus();

  // Wire up side buttons (quick actions)
  try {
    document.querySelectorAll('.side-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const c = (btn.dataset && btn.dataset.cmd) ? btn.dataset.cmd : btn.getAttribute('data-cmd');
        if (!c) return;
        // Some side buttons include a prefix like run:scriptName — pass through
        runCommand(String(c));
      });
    });
  } catch (e) { /* ignore */ }
})();
