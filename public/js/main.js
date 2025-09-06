/**
 * UConnect - Main JavaScript
 * Core functionality and interactions
 */

// Global state
const CampusConnect = {
  user: null,
  config: {
    apiBaseUrl: '/api',
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  }
};

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
});

/**
 * Initialize the application
 */
function initializeApp() {
  // Initialize navigation
  initializeNavigation();

  // Initialize forms
  initializeForms();

  // Initialize tooltips and popovers
  initializeTooltips();

  // Initialize lazy loading
  initializeLazyLoading();

  // Initialize keyboard shortcuts
  initializeKeyboardShortcuts();

  console.log('🚀 UConnect initialized');
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
  }

  // User dropdown
  const userBtn = document.querySelector('.user-btn');
  const userDropdown = document.querySelector('.dropdown-menu');

  if (userBtn && userDropdown) {
    userBtn.addEventListener('click', toggleUserMenu);

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (!userBtn.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown.classList.remove('show');
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

  if (mobileMenu) {
    mobileMenu.classList.toggle('show');

    // Update button icon
    const icon = mobileMenuBtn.querySelector('i');
    if (icon) {
      icon.className = mobileMenu.classList.contains('show')
        ? 'fas fa-times'
        : 'fas fa-bars';
    }
  }
}

/**
 * Toggle user dropdown menu
 */
function toggleUserMenu() {
  const userDropdown = document.querySelector('.dropdown-menu');
  if (userDropdown) {
    userDropdown.classList.toggle('show');
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
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
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
        <i class="fas fa-times"></i> Remove
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

/**
 * Close all open dropdowns
 */
function closeAllDropdowns() {
  const dropdowns = document.querySelectorAll('.dropdown-menu.show');
  dropdowns.forEach(dropdown => dropdown.classList.remove('show'));

  const mobileMenu = document.querySelector('.mobile-menu.show');
  if (mobileMenu) {
    mobileMenu.classList.remove('show');
    const icon = document.querySelector('.mobile-menu-btn i');
    if (icon) {
      icon.className = 'fas fa-bars';
    }
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
    <button onclick="this.parentElement.remove()" class="flash-close">
      <i class="fas fa-times"></i>
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
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
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
    icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
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