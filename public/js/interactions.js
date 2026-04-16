/**
 * UConnect Interactions - "Cool Tweaks"
 * Double-tap like, Toasts, Copy Link, etc.
 */

const Interactions = {
    init: function() {
        this.initDoubleTapLike();
        this.initCopyLink();
        this.initToasts();
        this.fixChatStyling();
    },

    // Toast Notification System
    showToast: function(message, type = 'success') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast-neo toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${type === 'success' ? '✅' : '⚠️'}</span>
            <span class="toast-message">${message}</span>
        `;

        // Inline styles for the toast
        toast.style.cssText = `
            background: rgba(10, 10, 10, 0.9);
            color: #fff;
            padding: 12px 24px;
            border-radius: 50px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            font-weight: 500;
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            pointer-events: auto;
        `;

        if (type === 'error') {
            toast.style.border = '1px solid rgba(255, 59, 92, 0.3)';
            toast.style.boxShadow = '0 10px 30px rgba(255, 59, 92, 0.15)';
        }

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        // Remove after 3s
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    initToasts: function() {
        // Expose globally
        window.showToast = this.showToast;
    },

    // Double Tap to Like
    initDoubleTapLike: function() {
        const posts = document.querySelectorAll('.post-card-neo');

        posts.forEach(post => {
            const media = post.querySelector('.post-media-neo, .post-image-neo');
            if (!media) return;

            let lastTap = 0;
            media.addEventListener('click', (e) => {
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTap;

                if (tapLength < 300 && tapLength > 0) {
                    // Double tap detected
                    e.preventDefault();
                    this.triggerLike(post);
                    this.showHeartAnimation(e.clientX, e.clientY);
                }
                lastTap = currentTime;
            });
        });
    },

    triggerLike: function(postElement) {
        const likeBtn = postElement.querySelector('.action-btn-neo.like-btn');
        if (likeBtn) {
            likeBtn.click();
            this.showToast('Post Liked! ❤️');
        }
    },

    showHeartAnimation: function(x, y) {
        const heart = document.createElement('div');
        heart.innerHTML = '❤️';
        heart.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            transform: translate(-50%, -50%) scale(0);
            font-size: 80px;
            pointer-events: none;
            z-index: 9999;
            transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            text-shadow: 0 10px 20px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(heart);

        requestAnimationFrame(() => {
            heart.style.transform = 'translate(-50%, -50%) scale(1.5) rotate(-15deg)';
            heart.style.opacity = '1';
        });

        setTimeout(() => {
            heart.style.transform = 'translate(-50%, -150%) scale(0) rotate(15deg)';
            heart.style.opacity = '0';
            setTimeout(() => heart.remove(), 500);
        }, 800);
    },

    // Copy Link
    initCopyLink: function() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.share-btn-neo')) {
                e.preventDefault();
                const btn = e.target.closest('.share-btn-neo');
                const postId = btn.dataset.postId || window.location.pathname.split('/').pop();
                const url = `${window.location.origin}/posts/${postId}`;

                navigator.clipboard.writeText(url).then(() => {
                    this.showToast('Link copied to clipboard! 🔗');
                }).catch(() => {
                    this.showToast('Failed to copy link', 'error');
                });
            }
        });
    },

    // Fix Chat Styling on Mobile/Desktop
    fixChatStyling: function() {
        if (window.location.pathname.includes('/chat')) {
            document.body.style.backgroundColor = '#050505'; // Force dark background
            const container = document.querySelector('.chat-inbox-container');
            if (container) {
                container.style.background = 'rgba(10, 10, 10, 0.6)';
                container.style.backdropFilter = 'blur(20px)';
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Interactions.init();
});
