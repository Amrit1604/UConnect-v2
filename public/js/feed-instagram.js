// feed-instagram.js
// Client-side real-time handlers for posts feed (socket initialization and helpers)
(function(){
  'use strict';

  // Wait until socket.io client is loaded
  function ready(fn) {
    if (window.io) return fn();
    var i = setInterval(function(){ if (window.io) { clearInterval(i); fn(); } }, 50);
  }

  ready(function(){
    try {
      const socket = io();
  // Read campus from the hidden data attribute injected by the template
  const campusEl = document.getElementById('__uconnect_campus');
  const campus = (campusEl && campusEl.dataset && campusEl.dataset.campus) ? campusEl.dataset.campus : '';
      if (campus) socket.emit('join-campus', campus);
      console.log('feed-instagram: joined campus', campus);

      socket.on('new-post', (data) => {
        console.log('feed-instagram: new-post', data);
        showNewPostNotification();
      });

      socket.on('post-liked', (data) => {
        console.log('feed-instagram: post-liked', data);
        updateLikeCount(data.postId, data.likes, data.isLiked);
      });

      socket.on('new-comment', (data) => {
        console.log('feed-instagram: new-comment', data);
        addCommentToPost(data.postId, data.comment);
      });

      socket.on('connect', () => console.log('feed-instagram: socket connected'));
      socket.on('disconnect', () => console.log('feed-instagram: socket disconnected'));

      // Helper functions
      window.updateLikeCount = function(postId, likes, isLiked){
        const postElement = document.querySelector(`[data-post-id="${postId}"]`);
        if (postElement) {
          const likeBtn = postElement.querySelector('.like-btn');
          if (likeBtn) {
            const icon = likeBtn.querySelector('i');
            const countEl = likeBtn.querySelector('span');
            if (icon) {
              icon.classList.toggle('fas', isLiked);
              icon.classList.toggle('far', !isLiked);
            }
            if (typeof countEl !== 'undefined' && countEl) countEl.textContent = likes || 0;
            likeBtn.classList.toggle('liked', !!isLiked);
          }
        }
      };

      window.addCommentToPost = function(postId, comment){
        const postElement = document.querySelector(`[data-post-id="${postId}"]`);
        if (!postElement || !comment) return;

        // Support both neo and classic feeds
        const commentsSection = postElement.querySelector('.comments-list') || postElement.querySelector('.quick-comments-list');
        if (!commentsSection) return;

        // Avoid duplicate insertion if comment already present
        if (comment._id && commentsSection.querySelector(`[data-comment-id="${comment._id}"]`)) {
          console.log('Comment already exists, skipping duplicate');
          return;
        }

        // Check for "no comments" placeholder and remove it
        const noCommentsPlaceholder = commentsSection.querySelector('[style*="text-align: center"]');
        if (noCommentsPlaceholder && noCommentsPlaceholder.textContent.includes('No comments yet')) {
          noCommentsPlaceholder.remove();
        }

        // Create the new comment element with proper styling
        const commentElement = document.createElement('div');
        commentElement.className = 'comment-item new-comment';
        if (comment._id) commentElement.setAttribute('data-comment-id', comment._id);
        
        const avatarUrl = (comment.author && comment.author.avatarUrl) ? comment.author.avatarUrl : '/images/default-avatar.png';
        const username = (comment.author && comment.author.username) ? comment.author.username : 'User';
        const content = comment.content || '';
        
        commentElement.innerHTML = `
          <img src="${avatarUrl}" alt="${username}" class="comment-author-avatar" onerror="this.src='/images/default-avatar.png'">
          <div class="comment-content">
            <div class="comment-header">
              <strong class="comment-author">${escapeHtml(username)}</strong>
              <small class="comment-time">Just now</small>
            </div>
            <p class="comment-text">${escapeHtml(content)}</p>
          </div>
        `;

        // Insert at the END of the list (newest last) to maintain order
        commentsSection.appendChild(commentElement);
        
        // Scroll to the new comment
        commentElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Remove highlight after animation
        setTimeout(() => commentElement.classList.remove('new-comment'), 2000);

        // Update comment count in the action button
        const commentCountSpan = postElement.querySelector('.comment-btn span');
        if (commentCountSpan) {
          const currentCount = parseInt(commentCountSpan.textContent) || 0;
          commentCountSpan.textContent = currentCount + 1;
        }
      };

      function showNewPostNotification(){
        const notification = document.createElement('div');
        notification.className = 'new-post-notification';
        notification.innerHTML = `\n          <i class=\"fas fa-plus-circle\"></i> New post available <button onclick=\"window.location.reload()\">Refresh</button>\n        `;
        notification.style.cssText = 'position:fixed;top:20px;right:20px;background:#4caf50;color:white;padding:12px 16px;border-radius:8px;z-index:1000;';
        document.body.appendChild(notification);
        setTimeout(()=> notification.remove(), 5000);
      }

      function escapeHtml(str){
        if (!str) return '';
        return String(str).replace(/[&<>"'`=\/]/g, function (s) {
          return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;",'/':'&#x2F;'})[s];
        });
      }

      // Story click handling: scroll to first post by that username
      document.addEventListener('click', function(e){
        const story = e.target.closest('.story');
        if (!story) return;
        const username = story.dataset.storyUsername;
        if (!username) return;
        // Find first post authored by this username
        const posts = document.querySelectorAll('.post-card');
        for (const p of posts) {
          const authorLink = p.querySelector('.author-name');
          if (!authorLink) continue;
          const href = authorLink.getAttribute('href') || '';
          // href may be /users/username or /users/id
          if (href.endsWith('/' + username) || authorLink.textContent.trim().replace('@','') === username) {
            p.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // give visual focus briefly
            p.classList.add('highlight-story-target');
            setTimeout(()=> p.classList.remove('highlight-story-target'), 2000);
            break;
          }
        }
      });

    } catch (err) {
      console.error('feed-instagram init error', err);
    }
  });
})();
