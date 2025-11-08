// posts.js
// Client-side handlers for posts feed: likes, comments, toggles, share, story interactions.
// Designed to work with the existing server endpoints under /posts

(function () {
	'use strict';

	// Helper: fetch wrapper that returns JSON or throws
	async function requestJson(url, opts = {}) {
		const defaultOpts = {
			credentials: 'same-origin', // Include cookies for session
			headers: {
				'X-Requested-With': 'XMLHttpRequest' // Mark as AJAX request
			}
		};

		const finalOpts = { ...defaultOpts, ...opts };
		if (opts.headers) {
			finalOpts.headers = { ...defaultOpts.headers, ...opts.headers };
		}

		const res = await fetch(url, finalOpts);
		if (!res.ok) {
			let errorMessage = `Request failed: ${res.status} ${res.statusText}`;
			try {
				const errorData = await res.json();
				errorMessage = errorData.message || errorMessage;
			} catch (e) {
				// If not JSON, try text
				try {
					const errorText = await res.text();
					if (errorText) errorMessage = errorText;
				} catch (e2) {
					// Keep default error message
				}
			}
			const err = new Error(errorMessage);
			err.status = res.status;
			err.body = errorMessage;
			throw err;
		}
		// Try JSON, fallback to text
		const contentType = res.headers.get('content-type') || '';
		if (contentType.includes('application/json')) return res.json();
		return res.text();
	}

	// Toggle Like: sends POST /posts/:id/like and updates UI
	async function toggleLike(postId) {
		try {
			const btn = document.querySelector(`[data-post-id="${postId}"] .like-btn`);
			// optimistic UI: toggle local state
			if (btn) btn.classList.toggle('liked');

			const data = await requestJson(`/posts/${postId}/like`, { method: 'POST' });

			// update counts & classes
			const postEl = document.querySelector(`[data-post-id="${postId}"]`);
			if (postEl) {
				const likeCount = postEl.querySelector('.like-count') || postEl.querySelector('.action-btn .count');
				if (likeCount) likeCount.textContent = data.likeCount || data.likes || 0;

				const likeBtn = postEl.querySelector('.like-btn');
				if (likeBtn) {
					likeBtn.classList.toggle('liked', data.isLiked);
					const icon = likeBtn.querySelector('i');
					if (icon) {
						icon.classList.toggle('fas', data.isLiked);
						icon.classList.toggle('far', !data.isLiked);
					}
				}
			}
		} catch (err) {
			console.error('Like error', err);
			// revert optimistic UI
			const btn = document.querySelector(`[data-post-id="${postId}"] .like-btn`);
			if (btn) btn.classList.toggle('liked');
			alert('Failed to update like. Please try again.');
		}
	}

	// Add comment: POST /posts/:id/comment
	async function addComment(postId, textarea) {
		try {
			console.log('Adding comment for postId:', postId);
			const content = textarea.value.trim();
			console.log('Comment content:', content);
			if (!content) {
				console.log('Comment content is empty, returning');
				return;
			}

			const payload = { content };
			console.log('Sending payload:', payload);
			const data = await requestJson(`/posts/${postId}/comment`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			console.log('Comment response:', data);

			// Append the new comment into comments list if present
			const postEl = document.querySelector(`[data-post-id="${postId}"]`);
			if (postEl) {
				const commentsList = postEl.querySelector('.comments-list') || postEl.querySelector('.comments-container .comments-list');
				if (commentsList && data.comment) {
					const div = document.createElement('div');
					div.className = 'comment-item new-comment';
					div.innerHTML = `
						<img src="${data.comment.author.avatarUrl || '/images/default-avatar.png'}" alt="${data.comment.author.username}" style="width:32px;height:32px;border-radius:50%;border:2px solid #e5e7eb;flex-shrink:0;">
						<div style="flex:1">
							<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
								<strong style="font-weight:600;color:#1f2937">${data.comment.author.username}</strong>
								<small style="color:#6b7280">Just now</small>
							</div>
							<p style="margin:0;color:#374151">${escapeHtml(data.comment.content)}</p>
						</div>
					`;
					commentsList.appendChild(div);
					textarea.value = '';

					// Update comment count in the action button
					const commentCountSpan = postEl.querySelector('.comment-btn span');
					console.log('Comment count span found:', !!commentCountSpan);
					if (commentCountSpan) {
						const currentCount = parseInt(commentCountSpan.textContent) || 0;
						console.log('Current comment count:', currentCount);
						commentCountSpan.textContent = currentCount + 1;
						console.log('Updated comment count to:', currentCount + 1);
					}
				}
			}
		} catch (err) {
			console.error('Add comment error', err);
			alert(err.body || 'Failed to add comment');
		}
	}

	// Toggle comments visibility (simple expand/collapse)
	function toggleComments(postId) {
		const commentsSection = document.getElementById('comments-' + postId);
		if (!commentsSection) return;
		if (commentsSection.style.display === 'none' || !commentsSection.style.display) {
			commentsSection.style.display = 'block';
			commentsSection.style.maxHeight = '500px';
		} else {
			commentsSection.style.maxHeight = '0';
			setTimeout(() => { commentsSection.style.display = 'none'; }, 300);
		}
	}

	// Toggle comments rollout (show/hide comments section)
	function toggleCommentsRollout(postId) {
		const commentsSection = document.getElementById('comments-' + postId);
		if (!commentsSection) return;

		const isExpanded = commentsSection.classList.contains('expanded');

		if (isExpanded) {
			// Hide comments
			commentsSection.classList.remove('expanded');
		} else {
			// Show comments
			commentsSection.classList.add('expanded');
		}
	}

	// Share post (open in new tab)
	function sharePost(postId) {
		console.log('Share button clicked with postId:', postId);
		const url = `${window.location.origin}/posts/${postId}`;
		console.log('Opening URL:', url);
		window.open(url, '_blank');
		showToast('Post opened in new tab');
	}

	// Delete post
	async function deletePost(postId) {
		console.log('Delete button clicked with postId:', postId);

		// Show confirmation dialog
		if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
			return;
		}

		try {
			const data = await requestJson(`/posts/${postId}`, { method: 'DELETE' });

			// Remove the post from the DOM
			const postEl = document.querySelector(`[data-post-id="${postId}"]`);
			if (postEl) {
				postEl.remove();
				showToast('Post deleted successfully');
			}

			console.log('Post deleted successfully:', postId);
		} catch (err) {
			console.error('Delete post error', err);
			alert('Failed to delete post. Please try again.');
		}
	}

	function showToast(text) {
		const t = document.createElement('div');
		t.className = 'uconnect-toast';
		t.textContent = text;
		t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#111;color:#fff;padding:10px 14px;border-radius:8px;z-index:9999;opacity:0;transition:all .2s ease';
		document.body.appendChild(t);
		requestAnimationFrame(() => t.style.opacity = '1');
		setTimeout(() => { t.style.opacity = '0'; setTimeout(()=>t.remove(), 300); }, 2500);
	}

	// Small HTML escape utility
	function escapeHtml(str) {
		if (!str) return '';
		return str.replace(/[&<>"'`=\/]/g, function (s) {
			return ({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;',
				'/': '&#x2F;'
			})[s];
		});
	}

	// Attach event listeners on DOMContentLoaded
	document.addEventListener('DOMContentLoaded', function () {
		// Delegate click events for like buttons
		document.body.addEventListener('click', function (e) {
			const likeBtn = e.target.closest('.like-btn');
			if (likeBtn) {
				const postEl = likeBtn.closest('[data-post-id]');
				if (postEl) toggleLike(postEl.dataset.postId);
				return;
			}

			const shareBtn = e.target.closest('.share-btn');
			if (shareBtn) {
				const postEl = shareBtn.closest('[data-post-id]');
				if (postEl) sharePost(postEl.dataset.postId);
				return;
			}

			const commentToggle = e.target.closest('.comment-btn');
			if (commentToggle) {
				const postEl = commentToggle.closest('[data-post-id]');
				if (postEl) toggleCommentsRollout(postEl.dataset.postId);
				return;
			}

			const deleteBtn = e.target.closest('.delete-btn');
			if (deleteBtn) {
				const postEl = deleteBtn.closest('[data-post-id]');
				if (postEl) deletePost(postEl.dataset.postId);
				return;
			}
		});

		// Attach comment form submissions
		document.querySelectorAll('.comment-form').forEach(form => {
			form.addEventListener('submit', function (ev) {
				ev.preventDefault();
				const postId = this.dataset.postId;
				const textarea = this.querySelector('.comment-input');
				console.log('Form submitted for postId:', postId, 'textarea found:', !!textarea);
				if (postId && textarea) {
					addComment(postId, textarea);
				} else {
					console.error('Missing postId or textarea:', { postId, textarea });
				}
			});
		});

		// Character counters for comment inputs
		document.querySelectorAll('.comment-input').forEach(inp => {
			const postEl = inp.closest('[data-post-id]');
			const counter = postEl ? postEl.querySelector(`#comment-char-${postEl.dataset.postId}`) : null;
			if (!counter) return;
			inp.addEventListener('input', () => {
				counter.textContent = inp.value.length;
			});
		});
	});

	// Expose some helpers for inline templates
	window.toggleLike = toggleLike;
	window.toggleComments = toggleComments;
	window.toggleCommentsRollout = toggleCommentsRollout;
	window.sharePost = sharePost;
	window.deletePost = deletePost;
	window.addComment = function (postId) {
		const postEl = document.querySelector(`[data-post-id="${postId}"]`);
		const textarea = postEl ? postEl.querySelector('.comment-input') : null;
		if (textarea) addComment(postId, textarea);
	};

})();

