/**
 * Mini Gossip Box - Landing Page Widget
 * Displays recent gossips with create/like/comment/delete functionality
 */

console.log('🗣️ Mini Gossip Box Loading...');

// Configuration from server
const MINI_GOSSIP_CONFIG = window.GOSSIP_CONFIG || {};
const MINI_GOSSIP_ITEMS_LIMIT = 8;

// DOM Elements
let miniGossipInput, miniPostGossipBtn, miniGossipFeed, miniCharCount;
let miniSocket = null;

// ==========================================
// INITIALIZATION
// ==========================================

function initMiniGossip() {
  miniGossipInput = document.getElementById('miniGossipInput');
  miniPostGossipBtn = document.getElementById('miniPostGossipBtn');
  miniGossipFeed = document.getElementById('miniGossipFeed');
  miniCharCount = document.getElementById('miniCharCount');

  if (!miniGossipInput || !miniGossipFeed) {
    console.log('⚠️ Mini Gossip elements not found');
    return;
  }

  console.log('✅ Mini Gossip Initialized');
  setupMiniGossipHandlers();
  loadMiniGossips();
  setupMiniGossipSocket();
// ==========================================
// ANONYMOUS POSTS TOGGLE
// ==========================================
// ALL COMMENTS TOGGLE
// ==========================================

function setupAllCommentsToggle() {
  const toggleBtn = document.getElementById('toggleAllCommentsBtn');
  if (!toggleBtn) return;

  let commentsHidden = false;

  toggleBtn.addEventListener('click', function() {
    commentsHidden = !commentsHidden;
    toggleBtn.textContent = commentsHidden ? 'Show Comments' : 'Hide Comments';
    const commentSections = document.querySelectorAll('.mini-comments-section');
    commentSections.forEach(section => {
      section.style.display = commentsHidden ? 'none' : '';
    });
  });
}
// ==========================================

}

// ==========================================
// INPUT HANDLERS
// ==========================================

function setupMiniGossipHandlers() {
  if (miniGossipInput) {
    miniGossipInput.addEventListener('input', function() {
      const count = this.value.length;
      miniCharCount.textContent = `${count}/300`;

      if (miniPostGossipBtn) {
        miniPostGossipBtn.disabled = count === 0 || count > 300;
      }
    });
  }

  if (miniPostGossipBtn) {
    miniPostGossipBtn.addEventListener('click', async () => {
      const content = miniGossipInput.value.trim();

      if (!content) return;
      if (content.length > 300) {
        alert('Gossip is too long (max 300 characters)');
        return;
      }

      try {
        miniPostGossipBtn.disabled = true;
        miniPostGossipBtn.textContent = 'POSTING...';

        const response = await fetch('/gossip/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.message);

        // Add to top of mini feed
        const newItem = createMiniGossipItem(data.gossip);
        miniGossipFeed.insertBefore(newItem, miniGossipFeed.firstChild);

        miniGossipInput.value = '';
        miniCharCount.textContent = '0/300';

        console.log('✅ Mini gossip posted!');
      } catch (error) {
        console.error('❌ Error posting mini gossip:', error);
        alert('Failed to post gossip');
      } finally {
        miniPostGossipBtn.disabled = false;
        miniPostGossipBtn.textContent = 'POST';
      }
    });
  }
}

// ==========================================
// LOAD GOSSIPS
// ==========================================

async function loadMiniGossips() {
  try {
    const response = await fetch(`/gossip/api/all?page=1&limit=${MINI_GOSSIP_ITEMS_LIMIT}`);
    const data = await response.json();

    if (!data.success) {
      miniGossipFeed.innerHTML = '<p class="mini-gossip-empty">Failed to load gossips</p>';
      return;
    }

    if (!data.gossips || data.gossips.length === 0) {
      miniGossipFeed.innerHTML = '<p class="mini-gossip-empty">No gossips yet 🎉</p>';
      return;
    }

    miniGossipFeed.innerHTML = '';
    data.gossips.slice(0, MINI_GOSSIP_ITEMS_LIMIT).forEach(gossip => {
      const item = createMiniGossipItem(gossip);
      miniGossipFeed.appendChild(item);
    });

    console.log(`✅ Loaded ${data.gossips.length} mini gossips`);
  } catch (error) {
    console.error('❌ Error loading mini gossips:', error);
    miniGossipFeed.innerHTML = '<p class="mini-gossip-empty">Error loading gossips</p>';
  }
}

// ==========================================
// CREATE MINI GOSSIP ITEM
// ==========================================

function createMiniGossipItem(gossip) {
  const item = document.createElement('div');
  item.className = 'mini-gossip-item';
  item.id = `mini-gossip-${gossip._id}`;
  item.dataset.gossipId = gossip._id;
  item.dataset.anonId = gossip.anonId;

  const isOwner = gossip.anonId === MINI_GOSSIP_CONFIG.anonId;
  const isLiked = gossip.likedBy?.some(like => like.anonId === MINI_GOSSIP_CONFIG.anonId);

  const deleteBtn = isOwner ? `
    <button class="mini-action-btn delete-mini-btn" data-action="delete-mini-gossip" title="Delete">🗑️</button>
  ` : '';

  // Comments HTML
  let commentsHTML = '';
  if (gossip.comments && gossip.comments.length > 0) {
    commentsHTML = `
      <div class="mini-comments-section" style="display: none;">
        <div class="mini-comments-toggle">
          <button class="mini-toggle-comments-btn" data-action="toggle-mini-comments" style="background: none; border: none; color: #888; cursor: pointer; font-size: 11px; font-weight: 600; padding: 0;">
            ▼ Comments (${gossip.comments.length})
          </button>
        </div>
        <div class="mini-comments-list active">
          ${gossip.comments.map((comment, idx) => `
            <div class="mini-comment-item">
              <div class="mini-comment-header">
                <span class="mini-comment-anon">🔐 ${comment.anonId}</span>
                <span class="mini-comment-time">${formatMiniTime(comment.createdAt)}</span>
              </div>
              <div class="mini-comment-text">${sanitizeMiniHTML(comment.content)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  item.innerHTML = `
    <div class="mini-gossip-header-info">
      <span class="mini-gossip-anon-id">${gossip.anonId}</span>
      <span class="mini-gossip-time">${formatMiniTime(gossip.createdAt)}</span>
      ${deleteBtn}
    </div>
    <div class="mini-gossip-content">${sanitizeMiniHTML(gossip.content)}</div>
    <div class="mini-gossip-actions">
      <button class="mini-action-btn like-mini-btn ${isLiked ? 'liked' : ''}" data-action="like-mini-gossip">
        <span>${isLiked ? '❤️' : '🤍'}</span>
        <span>${gossip.likes}</span>
      </button>
      <button class="mini-action-btn comment-mini-btn" data-action="comment-mini-gossip">
        <span>💬</span>
        <span>${gossip.comments?.length || 0}</span>
      </button>
      <a href="/gossip#${gossip._id}" class="mini-action-btn" style="text-decoration: none; color: inherit;">
        <span>👁️ View</span>
      </a>
    </div>
    ${commentsHTML}
  `;

  // Add event listeners
  item.querySelector('.like-mini-btn')?.addEventListener('click', () => likeMiniGossip(item, gossip._id));
  item.querySelector('.delete-mini-btn')?.addEventListener('click', () => deleteMiniGossip(item, gossip._id));
  item.querySelector('.comment-mini-btn')?.addEventListener('click', () => {
    // Toggle comment section visibility
    toggleMiniComments(item);
    // Optionally focus comment input if present in future
  });
  item.querySelector('.mini-toggle-comments-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleMiniCommentsVisibility(item);
  });

  return item;
}

// ==========================================
// UTILITIES
// ==========================================

function formatMiniTime(date) {
  const now = new Date();
  const msgDate = new Date(date);
  const diffInSeconds = Math.floor((now - msgDate) / 1000);

  if (diffInSeconds < 60) return 'now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  return `${Math.floor(diffInSeconds / 86400)}d`;
}

function sanitizeMiniHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==========================================
// COMMENT TOGGLE FUNCTIONS
// ==========================================

function toggleMiniComments(item) {
  const commentsSection = item.querySelector('.mini-comments-section');
  if (commentsSection) {
    commentsSection.style.display = 'block';
    // Optionally, scroll into view for better UX
    commentsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function toggleMiniCommentsVisibility(item) {
  const commentsList = item.querySelector('.mini-comments-list');
  const toggleBtn = item.querySelector('.mini-toggle-comments-btn');
  
  if (!commentsList || !toggleBtn) return;

  if (commentsList.classList.contains('active')) {
    commentsList.classList.remove('active');
    toggleBtn.textContent = toggleBtn.textContent.replace('▼', '▶');
  } else {
    commentsList.classList.add('active');
    toggleBtn.textContent = toggleBtn.textContent.replace('▶', '▼');
  }
}

// ==========================================
// ACTIONS
// ==========================================

async function likeMiniGossip(item, gossipId) {
  try {
    const btn = item.querySelector('.like-mini-btn');
    btn.disabled = true;

    const response = await fetch(`/gossip/like/${gossipId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.message);

    // Update UI
    const countSpan = btn.querySelector('span:last-child');
    countSpan.textContent = data.likes;
    btn.classList.toggle('liked');

    console.log('✅ Mini gossip liked!');
  } catch (error) {
    console.error('❌ Error liking mini gossip:', error);
  } finally {
    btn.disabled = false;
  }
}

async function deleteMiniGossip(item, gossipId) {
  if (!confirm('Delete this gossip?')) return;

  try {
    const response = await fetch(`/gossip/${gossipId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.message);

    // Remove with animation
    item.classList.add('deleted');
    setTimeout(() => item.remove(), 300);

    console.log('✅ Mini gossip deleted!');
  } catch (error) {
    console.error('❌ Error deleting mini gossip:', error);
    alert('Failed to delete gossip');
  }
}

// ==========================================
// SOCKET.IO REAL-TIME UPDATES
// ==========================================

function setupMiniGossipSocket() {
  if (!window.io) {
    console.log('⚠️ Socket.IO not available for mini gossip');
    return;
  }

  miniSocket = io();
  miniSocket.emit('join', 'gossip');

  // New gossip created
  miniSocket.on('gossipCreated', (data) => {
    console.log('🗣️ New gossip (real-time):', data);
    const feed = document.getElementById('miniGossipFeed');
    if (feed && feed.children.length > 0) {
      const item = createMiniGossipItem(data.gossip);
      feed.insertBefore(item, feed.firstChild);

      // Keep only MINI_GOSSIP_ITEMS_LIMIT items
      while (feed.children.length > MINI_GOSSIP_ITEMS_LIMIT) {
        feed.removeChild(feed.lastChild);
      }
    }
  });

  // Gossip liked
  miniSocket.on('gossipLiked', (data) => {
    const item = document.getElementById(`mini-gossip-${data.gossipId}`);
    if (item) {
      const btn = item.querySelector('.like-mini-btn');
      if (btn) {
        const countSpan = btn.querySelector('span:last-child');
        countSpan.textContent = data.likes;
      }
    }
  });

  // Gossip deleted
  miniSocket.on('gossipDeleted', (data) => {
    const item = document.getElementById(`mini-gossip-${data.gossipId}`);
    if (item) {
      item.classList.add('deleted');
      setTimeout(() => item.remove(), 300);
    }
  });

  console.log('🔌 Mini Gossip Socket.IO connected');
}

// ==========================================
// INIT ON DOM READY
// ==========================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMiniGossip);
} else {
  initMiniGossip();
}
