/**
 * Gossip Frontend - Real-time functionality with Socket.IO
 */

console.log('🗣️ Gossip.js Loading...');

// Configuration from server
const GOSSIP_CONFIG = window.GOSSIP_CONFIG || {};
const ITEMS_PER_PAGE = 20;

// DOM Elements - will be initialized after DOM loads
let gossipInput, postGossipBtn, gossipFeed, emptyState, charCount;

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function formatTime(date) {
  const now = new Date();
  const msgDate = new Date(date);
  const diffInSeconds = Math.floor((now - msgDate) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return msgDate.toLocaleDateString();
}

function sanitizeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message, type = 'info') {
  console.log(`📢 ${type.toUpperCase()}: ${message}`);
  // You can add a toast notification here if desired
}

// ==========================================
// DOM ELEMENTS INITIALIZATION
// ==========================================

function initializeDOMElements() {
  gossipInput = document.getElementById('gossipInput');
  postGossipBtn = document.getElementById('postGossipBtn');
  gossipFeed = document.getElementById('gossipFeed');
  emptyState = document.getElementById('emptyState');
  charCount = document.getElementById('charCount');
  
  console.log('✅ DOM Elements Initialized:', {
    gossipInput: !!gossipInput,
    postGossipBtn: !!postGossipBtn,
    gossipFeed: !!gossipFeed,
    emptyState: !!emptyState,
    charCount: !!charCount
  });
}

// ==========================================
// CHARACTER COUNTER & INPUT HANDLERS
// ==========================================

function setupInputHandlers() {
  if (gossipInput) {
    gossipInput.addEventListener('input', function() {
      const count = this.value.length;
      charCount.textContent = `${count}/1000 (min 5)`;

      if (count > 900) {
        charCount.parentElement.classList.add('warning');
      } else {
        charCount.parentElement.classList.remove('warning');
      }

      postGossipBtn.disabled = count < 5 || count > 1000;
    });
  }

  if (postGossipBtn) {
    postGossipBtn.addEventListener('click', async () => {
      const content = gossipInput.value.trim();

      if (!content) {
        showNotification('Please enter a gossip message', 'warning');
        return;
      }

      if (content.length > 1000) {
        showNotification('Gossip is too long (max 1000 characters)', 'warning');
        return;
      }

      try {
        postGossipBtn.disabled = true;
        postGossipBtn.textContent = 'POSTING...';

        const response = await fetch('/gossip/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.message);

        // Add to top of feed
        const newCard = createGossipCard(data.gossip);
        gossipFeed.insertBefore(newCard, gossipFeed.firstChild);

        gossipInput.value = '';
        charCount.textContent = '0';
        updateEmptyState(false);

        console.log('✅ Gossip posted successfully!');
        showNotification('Your gossip was posted! 🎉', 'success');
      } catch (error) {
        console.error('❌ Error posting gossip:', error);
        showNotification(error.message || 'Failed to post gossip', 'error');
      } finally {
        postGossipBtn.disabled = false;
        postGossipBtn.textContent = 'POST ANONYMOUSLY';
      }
    });

    // Post on Enter key
    gossipInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        postGossipBtn.click();
      }
    });
  }
}

// ==========================================
// LOAD GOSSIPS
// ==========================================

async function loadGossips(page = 1) {
  try {
    console.log(`📥 Loading gossips from page ${page}...`);

    const response = await fetch(`/gossip/api/all?page=${page}`);
    const data = await response.json();

    if (!data.success) {
      console.error('❌ Failed to load gossips:', data.message);
      return;
    }

    renderGossips(data.gossips);
    updateEmptyState(data.gossips.length === 0);

    console.log(`✅ Loaded ${data.gossips.length} gossips`);
  } catch (error) {
    console.error('❌ Error loading gossips:', error);
    showNotification('Failed to load gossips', 'error');
  }
}

// ==========================================
// RENDER GOSSIPS
// ==========================================

function renderGossips(gossips) {
  gossipFeed.innerHTML = '';

  if (gossips.length === 0) {
    updateEmptyState(true);
    return;
  }

  gossips.forEach(gossip => {
    const gossipCard = createGossipCard(gossip);
    gossipFeed.appendChild(gossipCard);
  });

  updateEmptyState(false);
}

function createGossipCard(gossip) {
  const card = document.createElement('div');
  card.className = 'gossip-card';
  card.id = `gossip-${gossip._id}`;
  card.dataset.gossipId = gossip._id;
  card.dataset.anonId = gossip.anonId;

  const isOwner = gossip.anonId === GOSSIP_CONFIG.anonId;
  const isLiked = gossip.likedBy?.some(like => like.anonId === GOSSIP_CONFIG.anonId);

  let commentsHTML = '';
  if (gossip.comments && gossip.comments.length > 0) {
    commentsHTML = `
      <div class="comments-section active">
        <div class="comments-header" style="cursor: pointer; user-select: none; padding: 8px 0;">
          <button class="toggle-comments-btn" data-action="toggle-comments" style="background: none; border: none; color: #888; cursor: pointer; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 0;">
            ▼ 💬 Comments (${gossip.comments.length})
          </button>
        </div>
        <div class="comments-list active">
          ${gossip.comments.map((comment, index) => createCommentHTML(gossip._id, comment, index)).join('')}
        </div>
      </div>
    `;
  }

  const deleteBtn = isOwner ? `
    <button class="gossip-delete-btn" data-action="delete" title="Delete this gossip">🗑️</button>
  ` : '';

  card.innerHTML = `
    <div class="gossip-header-row">
      <div class="gossip-anon-info">
        🔐 <span class="gossip-anon-id">${gossip.anonId}</span>
        <span class="gossip-time">${formatTime(gossip.createdAt)}</span>
      </div>
      ${deleteBtn}
    </div>

    <div class="gossip-content">${sanitizeHTML(gossip.content)}</div>

    <div class="gossip-actions">
      <button class="action-btn like-btn ${isLiked ? 'liked' : ''}" data-action="like">
        <span>${isLiked ? '❤️' : '🤍'}</span>
        <span>${gossip.likes}</span>
      </button>
      <button class="action-btn comment-btn" data-action="comment">
        <span>💬</span>
        <span>${gossip.comments?.length || 0}</span>
      </button>
      <button class="action-btn share-btn" data-action="share">
        <span>📤</span>
        <span>Share</span>
      </button>
    </div>

    ${commentsHTML}

    <div class="add-comment-form" style="display: none;">
      <input type="text" class="comment-input" placeholder="Add a comment..." maxlength="300">
      <button class="comment-submit-btn" data-action="submit-comment">POST</button>
    </div>
  `;

  return card;
}

function createCommentHTML(gossipId, comment, index) {
  const isCommentOwner = comment.anonId === GOSSIP_CONFIG.anonId;

  return `
    <div class="comment-item" data-comment-index="${index}" data-gossip-id="${gossipId}">
      <div class="comment-header">
        <div class="comment-anon">
          🔐 <span class="comment-anon-id">${comment.anonId}</span>
          <span class="comment-time">${formatTime(comment.createdAt)}</span>
        </div>
        ${isCommentOwner ? `
          <button class="comment-action" data-action="delete-comment" title="Delete">🗑️</button>
        ` : ''}
      </div>
      <div class="comment-text">${sanitizeHTML(comment.content)}</div>
      <div class="comment-likes" data-comment-index="${index}">
        ❤️ ${comment.likes}
        ${isCommentOwner ? '' : `<button class="comment-action" data-action="like-comment" style="margin-left: 8px;">👍</button>`}
      </div>
    </div>
  `;
}

// ==========================================
// HANDLE GOSSIP ACTIONS - Using Event Delegation
// ==========================================

function setupGossipFeedEventListeners() {
  gossipFeed.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    event.preventDefault();
    event.stopPropagation();

    // Find the gossip card
    const card = event.target.closest('.gossip-card');
    const gossipId = card?.dataset.gossipId;

    if (!gossipId && action !== 'like-comment' && action !== 'delete-comment') return;

    console.log(`🎯 Action: ${action} on gossip: ${gossipId}`);

    switch (action) {
      case 'like':
        await likeGossip(event.target.closest('.like-btn'), gossipId);
        break;
      case 'comment':
        toggleCommentForm(card);
        break;
      case 'toggle-comments':
        toggleCommentsList(event.target.closest('.comments-section'));
        break;
      case 'submit-comment':
        await submitComment(event.target, gossipId);
        break;
      case 'share':
        shareGossip(gossipId);
        break;
      case 'delete':
        if (confirm('Delete your gossip? This cannot be undone.')) {
          await deleteGossip(gossipId);
        }
        break;
      case 'like-comment':
        await likeComment(event.target, gossipId);
        break;
      case 'delete-comment':
        await deleteComment(event.target, gossipId);
        break;
    }
  });
}

async function handleGossipAction(event, gossipId) {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;

  console.log(`🎯 Action: ${action} on gossip: ${gossipId}`);

  switch (action) {
    case 'like':
      await likeGossip(event.target.closest('.like-btn'), gossipId);
      break;
    case 'comment':
      toggleCommentForm(event.target.closest('.gossip-card'));
      break;
    case 'submit-comment':
      await submitComment(event.target, gossipId);
      break;
    case 'share':
      shareGossip(gossipId);
      break;
    case 'menu':
      showGossipMenu(event.target, gossipId);
      break;
    case 'like-comment':
      await likeComment(event.target, gossipId);
      break;
    case 'delete-comment':
      await deleteComment(event.target, gossipId);
      break;
  }
}

async function likeGossip(btn, gossipId) {
  try {
    btn.disabled = true;
    const response = await fetch(`/gossip/like/${gossipId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.message);

    // Update UI
    const count = btn.querySelector('span:last-child');
    count.textContent = data.likes;
    btn.classList.toggle('liked');
    btn.querySelector('span:first-child').textContent = data.liked ? '❤️' : '🤍';

    console.log(`✅ Gossip liked! Total: ${data.likes}`);
  } catch (error) {
    console.error('❌ Error liking gossip:', error);
    showNotification('Failed to like gossip', 'error');
  } finally {
    btn.disabled = false;
  }
}

function toggleCommentForm(card) {
  const form = card.querySelector('.add-comment-form');
  form.style.display = form.style.display === 'none' ? 'flex' : 'none';

  if (form.style.display === 'flex') {
    form.querySelector('.comment-input').focus();
  }
}

function toggleCommentsList(commentsSection) {
  const commentsList = commentsSection.querySelector('.comments-list');
  const toggleBtn = commentsSection.querySelector('.toggle-comments-btn');
  
  if (commentsList.classList.contains('active')) {
    commentsList.classList.remove('active');
    toggleBtn.textContent = toggleBtn.textContent.replace('▼', '▶');
  } else {
    commentsList.classList.add('active');
    toggleBtn.textContent = toggleBtn.textContent.replace('▶', '▼');
  }
}

async function submitComment(btn, gossipId) {
  try {
    const form = btn.closest('.add-comment-form');
    const input = form.querySelector('.comment-input');
    const content = input.value.trim();

    if (!content) {
      showNotification('Comment cannot be empty', 'warning');
      return;
    }

    btn.disabled = true;
    const response = await fetch(`/gossip/comment/${gossipId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.message);

    // Add comment to UI
    const card = btn.closest('.gossip-card');
    const commentsList = card.querySelector('.comments-list');
    const commentsSection = card.querySelector('.comments-section');

    if (!commentsList) {
      // Create comments section if it doesn't exist
      const newSection = document.createElement('div');
      newSection.className = 'comments-section active';
      newSection.innerHTML = `
        <div class="comments-header">💬 Comments (1)</div>
        <div class="comments-list"></div>
      `;
      card.insertBefore(newSection, form);
    }

    const updatedList = card.querySelector('.comments-list');
    const commentHTML = createCommentHTML(gossipId, data.comment, data.comment.index || 0);
    updatedList.innerHTML += commentHTML;

    input.value = '';
    form.style.display = 'none';

    console.log('✅ Comment added successfully!');
    showNotification('Comment posted!', 'success');
  } catch (error) {
    console.error('❌ Error submitting comment:', error);
    showNotification(error.message || 'Failed to post comment', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function likeComment(btn, gossipId) {
  try {
    const commentItem = btn.closest('.comment-item');
    const commentIndex = commentItem.dataset.commentIndex;

    btn.disabled = true;
    const response = await fetch(`/gossip/comment/${gossipId}/${commentIndex}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.message);

    // Update like count
    const likesDiv = commentItem.querySelector('.comment-likes');
    likesDiv.textContent = `❤️ ${data.likes}`;

    console.log(`✅ Comment liked! Total: ${data.likes}`);
  } catch (error) {
    console.error('❌ Error liking comment:', error);
    showNotification('Failed to like comment', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function deleteComment(btn, gossipId) {
  try {
    const commentItem = btn.closest('.comment-item');
    const commentIndex = commentItem.dataset.commentIndex;

    if (!confirm('Delete this comment?')) return;

    btn.disabled = true;
    const response = await fetch(`/gossip/${gossipId}/comment/${commentIndex}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.message);

    // Remove comment from UI with animation
    commentItem.style.opacity = '0';
    commentItem.style.transform = 'translateY(-10px)';
    setTimeout(() => commentItem.remove(), 300);
    
    // Update comment count
    const card = btn.closest('.gossip-card');
    const commentBtn = card.querySelector('.comment-btn span:last-child');
    const currentCount = parseInt(commentBtn.textContent);
    commentBtn.textContent = Math.max(0, currentCount - 1);
    
    console.log('✅ Comment deleted!');
    showNotification('Comment deleted', 'success');
  } catch (error) {
    console.error('❌ Error deleting comment:', error);
    showNotification(error.message || 'Failed to delete comment', 'error');
  } finally {
    btn.disabled = false;
  }
}

function shareGossip(gossipId) {
  const gossipUrl = `${window.location.origin}/gossip#${gossipId}`;

  if (navigator.share) {
    navigator.share({
      title: 'Check this gossip',
      url: gossipUrl
    }).catch(err => console.log('Share cancelled:', err));
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(gossipUrl)
      .then(() => showNotification('Link copied to clipboard!', 'success'))
      .catch(() => showNotification('Failed to copy link', 'error'));
  }
}

async function deleteGossip(gossipId) {
  try {
    console.log(`🗑️ Deleting gossip: ${gossipId}`);
    
    const response = await fetch(`/gossip/${gossipId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Delete response:', data);

    if (!data.success) {
      throw new Error(data.message || 'Failed to delete gossip');
    }

    // Remove from UI with animation
    const card = document.getElementById(`gossip-${gossipId}`);
    if (card) {
      card.style.transition = 'all 0.3s ease-out';
      card.style.opacity = '0';
      card.style.transform = 'translateY(-10px)';
      
      setTimeout(() => {
        card.remove();
        updateEmptyState(gossipFeed.children.length === 0);
      }, 300);
    }

    console.log('✅ Gossip deleted successfully!');
    showNotification('Your gossip has been deleted', 'success');
  } catch (error) {
    console.error('❌ Error deleting gossip:', error);
    showNotification(error.message || 'Failed to delete gossip', 'error');
  }
}



// ==========================================
// EMPTY STATE
// ==========================================

function updateEmptyState(show) {
  if (emptyState) {
    emptyState.style.display = show && gossipFeed.children.length === 0 ? 'block' : 'none';
  }
}

// ==========================================
// REAL-TIME SOCKET.IO
// ==========================================

if (typeof io !== 'undefined') {
  const socket = io();

  // Join gossip room
  socket.emit('join', 'gossip');
  console.log('🔌 Joined gossip room');

  // Listen for new gossips
  socket.on('gossipCreated', (gossip) => {
    console.log('📨 New gossip received (real-time):', gossip);
    // Don't add if it's our own gossip (already added locally)
    if (gossip.anonId !== GOSSIP_CONFIG.anonId) {
      const newCard = createGossipCard(gossip);
      gossipFeed.insertBefore(newCard, gossipFeed.firstChild);
      updateEmptyState(false);
    }
  });

  // Listen for gossip likes
  socket.on('gossipLiked', (data) => {
    console.log('💗 Gossip liked (real-time):', data);
    const card = document.getElementById(`gossip-${data.gossipId}`);
    if (card) {
      const likeBtn = card.querySelector('.like-btn span:last-child');
      if (likeBtn) likeBtn.textContent = data.likes;
    }
  });

  // Listen for comments
  socket.on('commentAdded', (data) => {
    console.log('💬 Comment added (real-time):', data);
    const card = document.getElementById(`gossip-${data.gossipId}`);
    if (card) {
      let commentsList = card.querySelector('.comments-list');

      if (!commentsList) {
        const section = document.createElement('div');
        section.className = 'comments-section active';
        section.innerHTML = `
          <div class="comments-header" style="cursor: pointer; user-select: none; padding: 8px 0;">
            <button class="toggle-comments-btn" data-action="toggle-comments" style="background: none; border: none; color: #888; cursor: pointer; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 0;">
              ▼ 💬 Comments (1)
            </button>
          </div>
          <div class="comments-list active"></div>
        `;
        const form = card.querySelector('.add-comment-form');
        card.insertBefore(section, form);
        commentsList = section.querySelector('.comments-list');
      }

      const commentHTML = createCommentHTML(data.gossipId, data.comment, data.comment.index);
      commentsList.innerHTML += commentHTML;
    }
  });

  // Listen for comment likes
  socket.on('commentLiked', (data) => {
    console.log('💗 Comment liked (real-time):', data);
    const card = document.getElementById(`gossip-${data.gossipId}`);
    if (card) {
      const commentItem = card.querySelector(`[data-comment-index="${data.commentIndex}"]`);
      if (commentItem) {
        const likesDiv = commentItem.querySelector('.comment-likes');
        likesDiv.textContent = `❤️ ${data.likes}`;
      }
    }
  });

  // Listen for comment deletion
  socket.on('commentDeleted', (data) => {
    console.log('🗑️ Comment deleted (real-time):', data);
    const card = document.getElementById(`gossip-${data.gossipId}`);
    if (card) {
      const commentItem = card.querySelector(`[data-comment-index="${data.commentIndex}"]`);
      if (commentItem) {
        commentItem.style.opacity = '0';
        setTimeout(() => commentItem.remove(), 300);
      }
    }
  });

  // Listen for gossip deletion
  socket.on('gossipDeleted', (data) => {
    console.log('🗑️ Gossip deleted (real-time):', data);
    const card = document.getElementById(`gossip-${data.gossipId}`);
    if (card) {
      card.style.opacity = '0';
      setTimeout(() => card.remove(), 300);
    }
  });
}

// ==========================================
// INITIALIZATION
// ==========================================

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGossip);
} else {
  // DOM already loaded
  initializeGossip();
}

function initializeGossip() {
  console.log('🚀 Initializing Gossip...');

  // Initialize DOM elements
  initializeDOMElements();

  // Verify all elements exist
  if (!gossipInput || !postGossipBtn || !gossipFeed || !charCount) {
    console.error('❌ Required DOM elements not found!', {
      gossipInput: !!gossipInput,
      postGossipBtn: !!postGossipBtn,
      gossipFeed: !!gossipFeed,
      charCount: !!charCount
    });
    return;
  }

  // Setup input handlers after DOM elements are confirmed to exist
  setupInputHandlers();

  // Setup event delegation for gossip feed actions
  setupGossipFeedEventListeners();

  console.log('✅ Gossip.js Loaded Successfully!');
  console.log('🔐 Anonymous ID:', GOSSIP_CONFIG.anonId);

  // Load initial gossips on page load
  loadGossips(1);
}
