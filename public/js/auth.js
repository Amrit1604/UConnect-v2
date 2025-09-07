/**
 * Authentication JavaScript - UConnect
 * Handles auth form interactions
 */

/**
 * Toggle password visibility
 */
function togglePassword(fieldId) {
  const field = document.getElementById(fieldId);
  const icon = field.nextElementSibling.querySelector('span');

  if (field.type === 'password') {
    field.type = 'text';
    icon.textContent = '🙈';
  } else {
    field.type = 'password';
    icon.textContent = '👁️';
  }
}

/**
 * Form validation helpers
 */
function validatePasswordStrength(password) {
  const strengthIndicator = document.getElementById('passwordStrength');
  if (!strengthIndicator) return;

  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[@$!%*?&]/.test(password)
  };

  const score = Object.values(requirements).filter(Boolean).length;
  const strength = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][Math.min(score, 4)];
  const colors = ['#ff4757', '#ff6b7a', '#ffa502', '#2ed573', '#20bf6b'];

  strengthIndicator.innerHTML = `
    <div class="strength-bar">
      <div class="strength-fill" style="width: ${score * 20}%; background-color: ${colors[score - 1] || colors[0]}"></div>
    </div>
    <span class="strength-text" style="color: ${colors[score - 1] || colors[0]}">${strength}</span>
  `;
}

function checkPasswordMatch() {
  const password = document.getElementById('password');
  const confirmPassword = document.getElementById('confirmPassword');
  const matchIndicator = document.getElementById('passwordMatch');

  if (!password || !confirmPassword || !matchIndicator) return;

  if (confirmPassword.value.length === 0) {
    matchIndicator.innerHTML = '';
    return;
  }

  if (password === confirmPassword && password.length > 0) {
        matchIndicator.innerHTML = '<span class="match-success"><span style="margin-right: 5px;">✅</span> Passwords match</span>';
    } else if (confirmPassword.length > 0) {
        matchIndicator.innerHTML = '<span class="match-error"><span style="margin-right: 5px;">❌</span> Passwords do not match</span>';
    }
}

/**
 * Username validation
 */
function validateUsername(username) {
  const isValid = /^[a-zA-Z0-9_]+$/.test(username) && username.length >= 3 && username.length <= 20;
  const usernameField = document.getElementById('username');

  if (usernameField) {
    if (isValid) {
      usernameField.classList.remove('error');
      usernameField.classList.add('success');
    } else {
      usernameField.classList.remove('success');
      usernameField.classList.add('error');
    }
  }

  return isValid;
}

/**
 * Avatar functionality - Global variables and functions
 */
let currentAvatarSeed = 'default';

// Make functions globally available
window.generateRandomAvatar = function() {
  try {
    console.log('generateRandomAvatar called');

    // Add rotation animation to dice icon
    const diceIcon = document.getElementById('diceIcon');
    if (diceIcon) {
      diceIcon.classList.add('dice-spin');

      // Remove animation class after animation completes
      setTimeout(() => {
        diceIcon.classList.remove('dice-spin');
      }, 600);
    }

    const seeds = [
      'happy', 'cool', 'awesome', 'fantastic', 'amazing', 'brilliant',
      'wonderful', 'incredible', 'outstanding', 'excellent', 'marvelous',
      'superb', 'stellar', 'fabulous', 'magnificent', 'charming', 'delightful',
      'extraordinary', 'remarkable', 'splendid', 'terrific', 'unique', 'vibrant'
    ];

    const randomSeed = seeds[Math.floor(Math.random() * seeds.length)] +
                       Math.random().toString(36).substring(2, 8);

    currentAvatarSeed = randomSeed;

    // Update hidden fields
    const avatarTypeField = document.getElementById('avatarType');
    const avatarSeedField = document.getElementById('avatarSeed');

    if (avatarTypeField) avatarTypeField.value = 'api';
    if (avatarSeedField) avatarSeedField.value = randomSeed;

    updateAvatarPreview();

    console.log('Generated new avatar with seed:', randomSeed);
  } catch (error) {
    console.error('Error generating random avatar:', error);
    alert('Error generating avatar. Please try again.');
  }
};

window.updateAvatarPreview = function() {
  try {
    const avatarPreview = document.getElementById('avatarPreview');
    if (!avatarPreview) {
      console.log('Avatar preview element not found');
      return;
    }

    const avatarUrl = `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(currentAvatarSeed)}`;
    console.log('Updating avatar preview with URL:', avatarUrl);

    avatarPreview.src = avatarUrl;

    // Update hidden field
    const avatarSeedField = document.getElementById('avatarSeed');
    if (avatarSeedField) {
      avatarSeedField.value = currentAvatarSeed;
    }
  } catch (error) {
    console.error('Error updating avatar preview:', error);
  }
};

window.handleAvatarUpload = function(event) {
  try {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      event.target.value = ''; // Clear the input
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      event.target.value = ''; // Clear the input
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      const avatarPreview = document.getElementById('avatarPreview');
      if (!avatarPreview) return;

      // Add fade animation
      avatarPreview.style.opacity = '0.5';
      avatarPreview.style.transition = 'opacity 0.3s ease-in-out';

      avatarPreview.src = e.target.result;

      // Restore opacity after image loads
      avatarPreview.onload = function() {
        this.style.opacity = '1';
      };

      // Update hidden fields
      const avatarTypeField = document.getElementById('avatarType');
      const avatarSeedField = document.getElementById('avatarSeed');

      if (avatarTypeField) avatarTypeField.value = 'upload';
      if (avatarSeedField) avatarSeedField.value = '';

      console.log('Avatar uploaded successfully');
    };

    reader.onerror = function() {
      console.error('Error reading uploaded file');
      alert('Error reading the uploaded file. Please try again.');
      event.target.value = ''; // Clear the input
    };

    reader.readAsDataURL(file);
  } catch (error) {
    console.error('Error handling avatar upload:', error);
    alert('Error uploading avatar. Please try again.');
  }
};

// Initialize auth page functionality
document.addEventListener('DOMContentLoaded', function() {
  console.log('Auth.js loaded and DOM ready');

  // Password strength validation
  const passwordField = document.getElementById('password');
  if (passwordField) {
    passwordField.addEventListener('input', function() {
      validatePasswordStrength(this.value);
      checkPasswordMatch();
    });
  }

  // Confirm password validation
  const confirmPasswordField = document.getElementById('confirmPassword');
  if (confirmPasswordField) {
    confirmPasswordField.addEventListener('input', checkPasswordMatch);
  }

  // Username validation
  const usernameField = document.getElementById('username');
  if (usernameField) {
    usernameField.addEventListener('input', function() {
      validateUsername(this.value);
      // Update avatar preview when username changes (only for API avatars)
      const avatarTypeField = document.getElementById('avatarType');
      if (avatarTypeField && avatarTypeField.value === 'api') {
        const usernameValue = this.value.trim();
        if (usernameValue) {
          currentAvatarSeed = usernameValue;
          updateAvatarPreview();
        }
      }
    });
  }

  // Initialize avatar functionality for register page
  if (document.getElementById('avatarPreview')) {
    console.log('Avatar functionality detected, initializing...');

    // Listener for random avatar button
    const randomAvatarButton = document.getElementById('randomAvatarBtn');
    if (randomAvatarButton) {
      randomAvatarButton.addEventListener('click', generateRandomAvatar);
    }

    // Listener for file upload
    const avatarFileInput = document.getElementById('avatarFile');
    const uploadAvatarButton = document.getElementById('uploadAvatarBtn');

    if (uploadAvatarButton && avatarFileInput) {
      uploadAvatarButton.addEventListener('click', () => {
        avatarFileInput.click();
      });
    }

    if (avatarFileInput) {
      avatarFileInput.addEventListener('change', handleAvatarUpload);
    }

    // Generate initial random avatar
    generateRandomAvatar();
    console.log('Avatar functionality initialized');
  }
});