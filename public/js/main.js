/**
 * UConnect - Main JavaScript
 * Core functionality and interactions
 */

console.log('🚀 main.js loaded successfully!');

// Global state
const CampusConnect = {
  user: null,
  config: {
    apiBaseUrl: '/api',
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  }
};

const COLOR_THEME_STORAGE_KEY = 'theme';

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 DOM Content Loaded - Initializing UConnect');
  initializeApp();
});

/**
 * Initialize the application
 */
function initializeApp() {
  // Initialize navigation
  initializeNavigation();

  // Initialize global color theme toggle
  initializeColorThemeToggle();

  // Initialize forms
  initializeForms();

  // Initialize tooltips and popovers
  initializeTooltips();

  // Initialize lazy loading
  initializeLazyLoading();

  // Initialize keyboard shortcuts
  initializeKeyboardShortcuts();

  initializeFlashMessages();

  console.log('🚀 UConnect initialized - All functions loaded');
  console.log('🔍 Available functions:', {
    toggleLike: typeof toggleLike,
    toggleComments: typeof toggleComments,
    sharePost: typeof sharePost,
    addComment: typeof addComment,
    toggleBrutalistTheme: typeof toggleBrutalistTheme
  });
}

function initializeColorThemeToggle() {
  console.log('🎨 Initializing theme toggle...');

  const themeToggles = document.querySelectorAll('[data-theme-toggle="landing"]');
  console.log('🎨 Found theme toggles:', themeToggles.length);

  if (!themeToggles.length) {
    console.log('🎨 No theme toggles found with [data-theme-toggle="landing"]');
    return;
  }

  const themeIcons = document.querySelectorAll('[data-theme-icon]');
  const root = document.documentElement;

  const applyTheme = theme => {
    console.log('🎨 Applying theme:', theme);

    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
      document.body.classList.remove('light-theme');
      console.log('🎨 Set data-theme="dark" and removed light-theme class from body');
    } else {
      root.removeAttribute('data-theme');
      document.body.classList.add('light-theme');
      console.log('🎨 Removed data-theme attribute and added light-theme class to body');
    }

    localStorage.setItem(COLOR_THEME_STORAGE_KEY, theme);
    console.log('🎨 Saved to localStorage:', theme);

    // Icons are now controlled by CSS - no need to change textContent
    console.log('🎨 Icons controlled by CSS');

    themeToggles.forEach(toggle => {
      toggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      console.log('🎨 Updated aria-pressed to:', toggle.getAttribute('aria-pressed'));
    });
  };

  // Check for saved theme preference or default to 'light'
  const savedTheme = localStorage.getItem(COLOR_THEME_STORAGE_KEY) || 'light';
  console.log('🎨 Saved theme from localStorage:', savedTheme);
  applyTheme(savedTheme);

  themeToggles.forEach(toggle => {
    console.log('🎨 Adding click listener to toggle');
    toggle.addEventListener('click', () => {
      console.log('🎨 Theme toggle clicked!');
      const currentTheme = root.getAttribute('data-theme') || 'light';
      console.log('🎨 Current theme:', currentTheme);
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      console.log('🎨 New theme will be:', newTheme);
      applyTheme(newTheme);

      // Add animation feedback
      toggle.style.transform = 'scale(0.9)';
      setTimeout(() => {
        toggle.style.transform = '';
      }, 200);
    });
  });

  console.log('🎨 Theme toggle initialization complete');
}

/**
 * Navigation functionality
 */
function initializeNavigation() {
  // Mobile menu toggle
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const mobileMenu = document.querySelector('.mobile-menu');

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);

    if (mobileMenu.id && !mobileMenuBtn.hasAttribute('aria-controls')) {
      mobileMenuBtn.setAttribute('aria-controls', mobileMenu.id);
    }

    const isOpen = mobileMenu.classList.contains('show');
    updateMobileMenuButtonState(isOpen);
  }

  // Brutalist theme toggle buttons (layout-level feature)
  const brutalistToggles = document.querySelectorAll('[data-theme-toggle="brutalist"]');
  brutalistToggles.forEach(button => {
    button.addEventListener('click', toggleBrutalistTheme);
  });

  // User dropdown
  const userBtn = document.querySelector('.user-btn');
  const userDropdown = document.querySelector('.dropdown-menu');

  if (userBtn && userDropdown) {
    userBtn.addEventListener('click', toggleUserMenu);

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (!userBtn.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown.classList.remove('show');
        userBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Active navigation highlighting
  highlightActiveNavigation();
}

/**
 * Toggle mobile menu
 */
function toggleMobileMenu() {
  const mobileMenu = document.querySelector('.mobile-menu');
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');

  if (!mobileMenu || !mobileMenuBtn) {
    return;
  }

  const isOpen = mobileMenu.classList.toggle('show');
  updateMobileMenuButtonState(isOpen);
}

function updateMobileMenuButtonState(isOpen) {
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  if (!mobileMenuBtn) {
    return;
  }

  mobileMenuBtn.classList.toggle('is-open', isOpen);
  mobileMenuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

  const iconTarget = mobileMenuBtn.querySelector('[data-menu-icon]')
    || mobileMenuBtn.querySelector('i')
    || mobileMenuBtn;

  if (iconTarget) {
    const openIcon = mobileMenuBtn.getAttribute('data-menu-open-icon') || '❌';
    const closedIcon = mobileMenuBtn.getAttribute('data-menu-closed-icon') || '☰';
    iconTarget.textContent = isOpen ? openIcon : closedIcon;
  }
}

/**
 * Toggle user dropdown menu
 */
function toggleUserMenu() {
  const userDropdown = document.querySelector('.dropdown-menu');
  const userBtn = document.querySelector('.user-btn');

  if (userDropdown) {
    const isOpen = userDropdown.classList.toggle('show');
    if (userBtn) {
      userBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
  }
}

/**
 * Highlight active navigation item
 */
function highlightActiveNavigation() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && currentPath.startsWith(href) && href !== '/') {
      link.classList.add('active');
    } else if (href === '/' && currentPath === '/') {
      link.classList.add('active');
    }
  });
}

/**
 * Form enhancements
 */
function initializeForms() {
  // Auto-resize textareas
  const textareas = document.querySelectorAll('textarea');
  textareas.forEach(textarea => {
    autoResizeTextarea(textarea);
    textarea.addEventListener('input', () => autoResizeTextarea(textarea));
  });

  // Form validation
  const forms = document.querySelectorAll('form[data-validate]');
  forms.forEach(form => {
    form.addEventListener('submit', handleFormSubmit);
  });

  // File upload previews
  const fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach(input => {
    input.addEventListener('change', handleFileUpload);
  });

  // Character counters
  const textInputs = document.querySelectorAll('[data-max-length]');
  textInputs.forEach(input => {
    addCharacterCounter(input);
    input.addEventListener('input', updateCharacterCounter);
  });
}

/**
 * Auto-resize textarea based on content
 */
function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

/**
 * Handle form submission with validation
 */
function handleFormSubmit(e) {
  const form = e.target;
  const isValid = validateForm(form);

  if (!isValid) {
    e.preventDefault();
    return false;
  }

  // Show loading state
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    showButtonLoading(submitBtn);
  }
}

/**
 * Validate form fields
 */
function validateForm(form) {
  let isValid = true;
  const fields = form.querySelectorAll('[required]');

  fields.forEach(field => {
    if (!field.value.trim()) {
      showFieldError(field, 'This field is required');
      isValid = false;
    } else {
      clearFieldError(field);
    }
  });

  return isValid;
}

/**
 * Show field error
 */
function showFieldError(field, message) {
  clearFieldError(field);

  field.classList.add('error');
  const errorDiv = document.createElement('div');
  errorDiv.className = 'field-error';
  errorDiv.textContent = message;

  field.parentNode.appendChild(errorDiv);
}

/**
 * Clear field error
 */
function clearFieldError(field) {
  field.classList.remove('error');
  const existingError = field.parentNode.querySelector('.field-error');
  if (existingError) {
    existingError.remove();
  }
}

/**
 * Show button loading state
 */
function showButtonLoading(button) {
  const originalText = button.innerHTML;
  button.innerHTML = '<span style="margin-right: 5px;">⏳</span> Loading...';
  button.disabled = true;

  // Store original text for restoration
  button.dataset.originalText = originalText;
}

/**
 * Hide button loading state
 */
function hideButtonLoading(button) {
  if (button.dataset.originalText) {
    button.innerHTML = button.dataset.originalText;
    button.disabled = false;
    delete button.dataset.originalText;
  }
}

/**
 * Handle file upload with preview
 */
function handleFileUpload(e) {
  const input = e.target;
  const files = input.files;

  // Skip global handling for advanced media inputs that manage their own previews
  if (input.classList && input.classList.contains('media-input')) {
    console.log('📁 Skipping global file handler for media-input:', input.id || input.name);
    return;
  }

  if (files.length === 0) return;

  const file = files[0];

  // Validate file size
  if (file.size > CampusConnect.config.maxFileSize) {
    showNotification('File size must be less than 5MB', 'error');
    input.value = '';
    return;
  }

  // Validate file type for images
  if (input.accept && input.accept.includes('image/')) {
    if (!CampusConnect.config.allowedImageTypes.includes(file.type)) {
      showNotification('Please select a valid image file', 'error');
      input.value = '';
      return;
    }

    // Show image preview
    showImagePreview(input, file);
  }
}

/**
 * Show image preview
 */
function showImagePreview(input, file) {
  const reader = new FileReader();

  reader.onload = function(e) {
    let preview = input.parentNode.querySelector('.image-preview');

    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'image-preview';
      input.parentNode.appendChild(preview);
    }

    preview.innerHTML = `
      <img src="${e.target.result}" alt="Preview" style="max-width: 200px; max-height: 200px; border-radius: 8px;">
      <button type="button" class="btn btn-small btn-ghost" onclick="clearImagePreview(this)">
        <span style="margin-right: 5px;">❌</span> Remove
      </button>
    `;
  };

  reader.readAsDataURL(file);
}

/**
 * Clear image preview
 */
function clearImagePreview(button) {
  const preview = button.parentNode;
  const input = preview.parentNode.querySelector('input[type="file"]');

  if (input) {
    input.value = '';
  }

  preview.remove();
}

/**
 * Add character counter to input
 */
function addCharacterCounter(input) {
  const maxLength = parseInt(input.dataset.maxLength);
  const counter = document.createElement('div');
  counter.className = 'character-counter';
  counter.innerHTML = `<span class="current">0</span>/<span class="max">${maxLength}</span>`;

  input.parentNode.appendChild(counter);
}

/**
 * Update character counter
 */
function updateCharacterCounter(e) {
  const input = e.target;
  const counter = input.parentNode.querySelector('.character-counter .current');
  const maxLength = parseInt(input.dataset.maxLength);
  const currentLength = input.value.length;

  if (counter) {
    counter.textContent = currentLength;

    // Update color based on usage
    const counterContainer = counter.parentNode;
    counterContainer.classList.remove('warning', 'danger');

    if (currentLength > maxLength * 0.9) {
      counterContainer.classList.add('danger');
    } else if (currentLength > maxLength * 0.8) {
      counterContainer.classList.add('warning');
    }
  }
}

/**
 * Initialize tooltips
 */
function initializeTooltips() {
  const tooltipElements = document.querySelectorAll('[data-tooltip]');

  tooltipElements.forEach(element => {
    element.addEventListener('mouseenter', showTooltip);
    element.addEventListener('mouseleave', hideTooltip);
  });
}

/**
 * Show tooltip
 */
function showTooltip(e) {
  const element = e.target;
  const text = element.dataset.tooltip;

  if (!text) return;

  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  tooltip.textContent = text;

  document.body.appendChild(tooltip);

  // Position tooltip
  const rect = element.getBoundingClientRect();
  tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
  tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';

  // Show tooltip
  setTimeout(() => tooltip.classList.add('show'), 10);

  // Store reference for cleanup
  element._tooltip = tooltip;
}

/**
 * Hide tooltip
 */
function hideTooltip(e) {
  const element = e.target;
  const tooltip = element._tooltip;

  if (tooltip) {
    tooltip.classList.remove('show');
    setTimeout(() => {
      if (tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip);
      }
    }, 150);
    delete element._tooltip;
  }
}

/**
 * Initialize lazy loading for images
 */
function initializeLazyLoading() {
  const images = document.querySelectorAll('img[data-src]');

  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          imageObserver.unobserve(img);
        }
      });
    });

    images.forEach(img => imageObserver.observe(img));
  } else {
    // Fallback for older browsers
    images.forEach(img => {
      img.src = img.dataset.src;
      img.classList.remove('lazy');
    });
  }
}

/**
 * Initialize keyboard shortcuts
 */
function initializeKeyboardShortcuts() {
  document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + K for search (if search exists)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.querySelector('input[type="search"]');
      if (searchInput) {
        searchInput.focus();
      }
    }

    // Escape to close modals/dropdowns
    if (e.key === 'Escape') {
      closeAllDropdowns();
      closeAllModals();
    }
  });
}

function initializeFlashMessages() {
  const flashMessages = document.querySelectorAll('.flash-message');
  flashMessages.forEach(message => scheduleFlashMessageRemoval(message));

  document.addEventListener('click', function(e) {
    const closeBtn = e.target.closest('.flash-close');
    if (!closeBtn) return;
    const message = closeBtn.closest('.flash-message');
    if (message) {
      message.remove();
    }
  });
}

function scheduleFlashMessageRemoval(message, delay = 5000) {
  if (!message) {
    return;
  }

  if (message.dataset && message.dataset.autoHide === 'false') {
    return;
  }

  setTimeout(() => {
    if (!message.isConnected) {
      return;
    }

    message.style.opacity = '0';
    setTimeout(() => {
      if (message.isConnected) {
        message.remove();
      }
    }, 300);
  }, delay);
}

/**
 * Close all open dropdowns
 */
function closeAllDropdowns() {
  const dropdowns = document.querySelectorAll('.dropdown-menu.show');
  dropdowns.forEach(dropdown => dropdown.classList.remove('show'));

  const expandedUserButtons = document.querySelectorAll('.user-btn[aria-expanded="true"]');
  expandedUserButtons.forEach(button => button.setAttribute('aria-expanded', 'false'));

  const mobileMenu = document.querySelector('.mobile-menu.show');
  if (mobileMenu) {
    mobileMenu.classList.remove('show');
    updateMobileMenuButtonState(false);
  }
}

/**
 * Close all open modals
 */
function closeAllModals() {
  const modals = document.querySelectorAll('.modal.show');
  modals.forEach(modal => modal.classList.remove('show'));
}

/**
 * Show notification
 */
function showNotification(message, type = 'info', duration = 5000) {
  const notification = document.createElement('div');
  notification.className = `flash-message flash-${type}`;

  const icon = getNotificationIcon(type);
  notification.innerHTML = `
    <i class="${icon}"></i>
    <span>${message}</span>
    <button class="flash-close" type="button" aria-label="Dismiss notification">
      <span style="margin-right: 5px;">❌</span>
    </button>
  `;

  // Add to flash messages container or create one
  let container = document.querySelector('.flash-messages');
  if (!container) {
    container = document.createElement('div');
    container.className = 'flash-messages';
    document.body.appendChild(container);
  }

  container.appendChild(notification);

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }
}

/**
 * Get notification icon based on type
 */
function getNotificationIcon(type) {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: '💡'
  };

  return icons[type] || icons.info;
}

/**
 * Utility function to toggle password visibility
 */
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const button = input.parentNode.querySelector('.password-toggle');
  const icon = button.querySelector('i');

  if (input.type === 'password') {
    input.type = 'text';
    icon.textContent = '🙈';
  } else {
    input.type = 'password';
    icon.textContent = '👁️';
  }
}

/**
 * Utility function to format time ago
 */
function timeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - new Date(date)) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };

  for (const [unit, seconds] of Object.entries(intervals)) {
    const interval = Math.floor(diffInSeconds / seconds);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
    }
  }

  return 'Just now';
}

/**
 * Utility function to debounce function calls
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Utility function to throttle function calls
 */
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Export functions for global use
window.CampusConnect = CampusConnect;
window.toggleMobileMenu = toggleMobileMenu;
window.toggleUserMenu = toggleUserMenu;
window.togglePassword = togglePassword;
window.showNotification = showNotification;
window.clearImagePreview = clearImagePreview;
window.sharePost = sharePost;
window.toggleComments = toggleComments;
window.toggleLike = toggleLike;
window.addComment = addComment;
window.toggleBrutalistTheme = toggleBrutalistTheme;

function toggleComments(postId) {
  console.log('🔍 toggleComments called with postId:', postId);
  const commentsSection = document.getElementById(`comments-${postId}`);
  const commentBtn = document.querySelector(`[onclick="toggleComments('${postId}')"]`);

  console.log('🔍 Comments section element:', commentsSection);
  console.log('🔍 Comment button element:', commentBtn);

  if (commentsSection.style.display === 'none' || commentsSection.style.display === '') {
    // Show comments
    console.log('🔍 Showing comments section');
    commentsSection.style.display = 'block';
    commentsSection.style.maxHeight = '500px'; // Set max height for smooth animation
    if (commentBtn) {
      commentBtn.classList.add('active');
    }
  } else {
    // Hide comments
    console.log('🔍 Hiding comments section');
    commentsSection.style.maxHeight = '0';
    setTimeout(() => {
      commentsSection.style.display = 'none';
    }, 300); // Match transition duration
    if (commentBtn) {
      commentBtn.classList.remove('active');
    }
  }
}

/**
 * Toggle like on a post
 */
function toggleLike(postId) {
  console.log('❤️ toggleLike called with postId:', postId);
  const likeBtn = document.querySelector(`[onclick="toggleLike('${postId}')"]`);
  const likeIcon = likeBtn.querySelector('i');
  const likeCount = likeBtn.querySelector('span');

  console.log('❤️ Like button element:', likeBtn);
  console.log('❤️ Like icon element:', likeIcon);
  console.log('❤️ Like count element:', likeCount);

  // Optimistic update
  const isLiked = likeBtn.classList.contains('liked');
  const currentCount = parseInt(likeCount.textContent);

  console.log('❤️ Currently liked:', isLiked, 'Current count:', currentCount);

  if (isLiked) {
    // Unlike
    console.log('❤️ Unliking post');
    likeBtn.classList.remove('liked');
    likeIcon.className = 'far fa-heart';
    likeCount.textContent = currentCount - 1;
  } else {
    // Like
    console.log('❤️ Liking post');
    likeBtn.classList.add('liked');
    likeIcon.className = 'fas fa-heart';
    likeCount.textContent = currentCount + 1;
  }

  console.log('❤️ Sending like request to server...');
  // Send request to server
  fetch(`/posts/${postId}/like`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin'
  })
  .then(response => {
    console.log('❤️ Like request response status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('❤️ Like request response data:', data);
    if (data.success) {
      // Update with server response
      console.log('❤️ Updating UI with server response');
      likeCount.textContent = data.likesCount;
      if (data.isLiked) {
        likeBtn.classList.add('liked');
        likeIcon.className = 'fas fa-heart';
      } else {
        likeBtn.classList.remove('liked');
        likeIcon.className = 'far fa-heart';
      }
    } else {
      // Revert optimistic update on error
      console.error('❤️ Like request failed:', data.message);
      if (isLiked) {
        likeBtn.classList.add('liked');
        likeIcon.className = 'fas fa-heart';
        likeCount.textContent = currentCount;
      } else {
        likeBtn.classList.remove('liked');
        likeIcon.className = 'far fa-heart';
        likeCount.textContent = currentCount;
      }
      showNotification('Failed to update like', 'error');
    }
  })
  .catch(error => {
    console.error('❤️ Error toggling like:', error);
    // Revert optimistic update
    if (isLiked) {
      likeBtn.classList.add('liked');
      likeIcon.className = 'fas fa-heart';
      likeCount.textContent = currentCount;
    } else {
      likeBtn.classList.remove('liked');
      likeIcon.className = 'far fa-heart';
      likeCount.textContent = currentCount;
    }
    showNotification('Network error. Please try again.', 'error');
  });
}

/**
 * Share a post
 */
function sharePost(postId) {
  console.log('🔗 sharePost called with postId:', postId);
  const postUrl = `${window.location.origin}/posts/${postId}`;
  console.log('🔗 Generated post URL:', postUrl);

  if (navigator.share) {
    console.log('🔗 Using Web Share API');
    // Use Web Share API if available
    navigator.share({
      title: 'Check out this post',
      url: postUrl
    }).then(() => {
      console.log('🔗 Share successful');
    }).catch((error) => {
      console.error('🔗 Share failed:', error);
    });
  } else {
    console.log('🔗 Using clipboard fallback');
    // Fallback to clipboard
    navigator.clipboard.writeText(postUrl).then(() => {
      console.log('🔗 Link copied to clipboard');
      showNotification('Post link copied to clipboard!', 'success');
    }).catch((error) => {
      console.error('🔗 Clipboard copy failed:', error);
      // Final fallback - show the URL
      showNotification(`Share this link: ${postUrl}`, 'info', 10000);
    });
  }
}

/**
 * Add a new comment to a post
 */
function addComment(postId) {
  console.log('💬 addComment called with postId:', postId);
  const form = document.querySelector(`#comments-${postId} .comment-form`);
  const textarea = form.querySelector('textarea[name="content"]');
  const submitBtn = form.querySelector('button[type="submit"]');
  const content = textarea.value.trim();

  console.log('💬 Form element:', form);
  console.log('💬 Textarea element:', textarea);
  console.log('💬 Submit button element:', submitBtn);
  console.log('💬 Comment content:', content);

  if (!content) {
    console.log('💬 Comment is empty, showing warning');
    showNotification('Comment cannot be empty', 'warning');
    return;
  }

  console.log('💬 Showing loading state');
  // Show loading state
  showButtonLoading(submitBtn);

  console.log('💬 Sending comment request to server...');
  // Send comment to server
  fetch(`/posts/${postId}/comment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
    credentials: 'same-origin'
  })
  .then(response => {
    console.log('💬 Comment request response status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('💬 Comment request response data:', data);
    hideButtonLoading(submitBtn);

    if (data.success) {
      console.log('💬 Comment added successfully');
      // Clear form
      textarea.value = '';
      updateCommentCharCount(textarea, postId);

      // Add new comment to the list
      const commentsList = document.querySelector(`#comments-${postId} .comments-list`);
      const noCommentsMsg = commentsList.querySelector('.text-center');

      if (noCommentsMsg) {
        console.log('💬 Removing "no comments" message');
        noCommentsMsg.remove();
      }

      const commentHTML = `
        <div class="comment-item" style="display: flex; gap: 10px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #f3f4f6;">
          <img src="${data.comment.author.avatarUrl || '/images/default-avatar.png'}"
               alt="${data.comment.author.username}" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid #e5e7eb; flex-shrink: 0;">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <strong style="font-weight: 600; color: #1f2937;">${data.comment.author.username}</strong>
              <small style="color: #6b7280;">Just now</small>
            </div>
            <p style="color: #374151; line-height: 1.5; margin: 0;">${data.comment.content}</p>
          </div>
        </div>
      `;

      console.log('💬 Adding new comment to list');
      commentsList.insertAdjacentHTML('afterbegin', commentHTML);

      // Update comment count
      const commentBtn = document.querySelector(`[onclick="toggleComments('${postId}')"]`);
      if (commentBtn) {
        const commentCount = commentBtn.querySelector('span');
        commentCount.textContent = parseInt(commentCount.textContent) + 1;
        console.log('💬 Updated comment count');
      }

      showNotification('Comment added successfully!', 'success');
    } else {
      console.error('💬 Comment request failed:', data.message);
      showNotification(data.message || 'Failed to add comment', 'error');
    }
  })
  .catch(error => {
    console.error('💬 Error adding comment:', error);
    hideButtonLoading(submitBtn);
    showNotification('Network error. Please try again.', 'error');
  });
}

/**
 * Update comment character count
 */
function updateCommentCharCount(textarea, postId) {
  const counter = document.getElementById(`comment-char-${postId}`);
  if (counter) {
    counter.textContent = textarea.value.length;
  }
}

// Initialize comment character counting
document.addEventListener('DOMContentLoaded', function() {
  // Add character counting for comment textareas
  const commentTextareas = document.querySelectorAll('.comment-input');
  commentTextareas.forEach(textarea => {
    const postId = textarea.closest('.comments-section').id.replace('comments-', '');
    textarea.addEventListener('input', () => updateCommentCharCount(textarea, postId));
  });
});

/**
 * Toggle brutalist theme
 */
function toggleBrutalistTheme() {
  console.log('🎨 toggleBrutalistTheme called');
  const themeLink = document.getElementById('brutalist-theme');
  console.log('🎨 Theme link element:', themeLink);

  if (!themeLink) {
    console.error('🎨 Brutalist theme link not found!');
    return;
  }

  const isEnabled = !themeLink.disabled;
  console.log('🎨 Theme currently enabled:', isEnabled);

  if (isEnabled) {
    // Disable brutalist theme
    console.log('🎨 Disabling brutalist theme');
    themeLink.disabled = true;
    localStorage.setItem('brutalist-theme', 'disabled');
    showNotification('Switched to normal theme', 'info');
  } else {
    // Enable brutalist theme
    console.log('🎨 Enabling brutalist theme');
    themeLink.disabled = false;
    localStorage.setItem('brutalist-theme', 'enabled');
    showNotification('BRUTALIST MODE ACTIVATED! 💀', 'success');
  }
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', function() {
  const themeLink = document.getElementById('brutalist-theme');
  const savedTheme = localStorage.getItem('brutalist-theme');

  if (savedTheme === 'enabled') {
    themeLink.disabled = false;
  } else {
    themeLink.disabled = true;
  }
});