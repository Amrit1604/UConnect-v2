/**
 * Account Settings - Deactivate & Delete Functionality
 */

console.log('🛡️ Account Settings JS Loaded');

function deactivateAccount() {
    console.log('🔒 Deactivate button clicked');
    
    if (confirm('Are you sure you want to deactivate your account? You can reactivate it later by logging in.')) {
        console.log('✅ User confirmed deactivation');
        console.log('📡 Sending deactivation request...');
        
        fetch('/users/settings/deactivate', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin'
        })
        .then(response => {
            console.log('📥 Response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('📦 Response data:', data);
            if (data.success) {
                alert('✅ Account deactivated successfully! You can reactivate by logging in again.');
                console.log('🚀 Redirecting to login...');
                window.location.href = data.redirect || '/auth/login?deactivated=true';
            } else {
                alert('❌ Failed to deactivate account: ' + (data.error || 'Unknown error'));
                console.error('❌ Deactivation failed:', data.error);
            }
        })
        .catch(error => {
            console.error('💥 Fetch error:', error);
            alert('❌ Network error: ' + error.message);
        });
    } else {
        console.log('❌ User cancelled deactivation');
    }
}

function showDeleteModal() {
    console.log('🗑️ Opening delete modal');
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        console.error('❌ Delete modal not found!');
    }
}

function hideDeleteModal() {
    console.log('❌ Closing delete modal');
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const deactivateBtn = document.getElementById('deactivateAccountBtn');
    const openDeleteModalBtn = document.getElementById('openDeleteAccountModalBtn');
    const cancelDeleteModalBtn = document.getElementById('cancelDeleteAccountModalBtn');

    if (!deactivateBtn) {
        console.error('❌ deactivateAccountBtn not found');
    } else {
        deactivateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            deactivateAccount();
        });
    }

    if (!openDeleteModalBtn) {
        console.error('❌ openDeleteAccountModalBtn not found');
    } else {
        openDeleteModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showDeleteModal();
        });
    }

    if (!cancelDeleteModalBtn) {
        console.error('❌ cancelDeleteAccountModalBtn not found');
    } else {
        cancelDeleteModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            hideDeleteModal();
        });
    }

    console.log('✅ Account settings listeners attached');
});

// Optional: expose for debugging from console
window.deactivateAccount = deactivateAccount;
window.showDeleteModal = showDeleteModal;
window.hideDeleteModal = hideDeleteModal;
