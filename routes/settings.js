const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');

const User = require('../models/User');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// Middleware to check if user is authenticated
router.use(auth.requireAuth);

// Profile Settings Page
router.get('/profile', async (req, res) => {
    try {
        console.log('🔍 PROFILE SETTINGS GET REQUEST:');
        console.log('User ID from session:', req.user.id);
        console.log('User from session:', {
            username: req.user.username,
            email: req.user.email,
            displayName: req.user.displayName,
            avatarType: req.user.avatarType
        });

        const user = await User.findById(req.user.id).select('-password');

        console.log('📊 User data from MongoDB:');
        console.log('Username:', user.username);
        console.log('Display Name:', user.displayName);
        console.log('Bio:', user.bio);
        console.log('Avatar Type:', user.avatarType);
        console.log('Privacy Settings:', user.privacy);
        console.log('Updated At:', user.updatedAt);

        res.render('users/settings/profile', {
            title: 'Profile Settings',
            user,
            formData: {},
            errors: []
        });
    } catch (error) {
        console.error('❌ Error loading profile settings:', error);
        req.flash('error', 'Error loading profile settings');
        res.redirect('/users/profile');
    }
});

// Update Profile
router.post('/profile', [
    body('username')
        .isLength({ min: 3, max: 20 })
        .withMessage('Username must be between 3 and 20 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores')
        .custom(async (username, { req }) => {
            // Check if username is already taken by another user
            const existingUser = await User.findOne({
                username: username.toLowerCase(),
                _id: { $ne: req.user.id }
            });
            if (existingUser) {
                throw new Error('Username is already taken');
            }
            return true;
        }),
    body('bio')
        .optional()
        .isLength({ max: 200 })
        .withMessage('Bio cannot exceed 200 characters')
], async (req, res) => {
    try {
        console.log('🔥 PROFILE UPDATE REQUEST RECEIVED:');
        console.log('Request body:', req.body);
        console.log('User ID:', req.user.id);
        console.log('Current session user before update:', {
            username: req.session.user.username,
            bio: req.session.user.bio,
            privacy: req.session.user.privacy
        });

        const errors = validationResult(req);
        const { username, bio, profilePublic, showEmail, allowMessages } = req.body;

        console.log('📝 Parsed form data:');
        console.log('Username:', username);
        console.log('Bio:', bio);
        console.log('Profile Public:', profilePublic);
        console.log('Show Email:', showEmail);
        console.log('Allow Messages:', allowMessages);

        if (!errors.isEmpty()) {
            console.log('❌ Validation errors:', errors.array());
            const user = await User.findById(req.user.id).select('-password');
            return res.render('users/settings/profile', {
                title: 'Profile Settings',
                user,
                formData: req.body,
                errors: errors.array()
            });
        }

        const updateData = {
            username: username.toLowerCase(),
            bio: bio || '',
            privacy: {
                profilePublic: profilePublic === 'on',
                showEmail: showEmail === 'on',
                allowMessages: allowMessages === 'on'
            },
            updatedAt: new Date()
        };

        console.log('🔥 GODLY POWERS: Updating profile with data:', updateData);

        // Update the user in database and get the updated user
        const updatedUser = await User.findByIdAndUpdate(req.user.id, updateData, { new: true }).select('-password');

        console.log('📊 Updated user data from MongoDB:');
        console.log('Username:', updatedUser.username);
        console.log('Display Name:', updatedUser.displayName);
        console.log('Bio:', updatedUser.bio);
        console.log('Privacy:', updatedUser.privacy);

        // Update session data with new user information
        console.log('🔄 Updating session data...');
        console.log('Old session user:', {
            username: req.session.user.username,
            bio: req.session.user.bio,
            privacy: req.session.user.privacy
        });

        req.session.user = updatedUser;

        console.log('✅ GODLY SUCCESS: Profile updated and session synced!');
        console.log('New session user:', {
            username: req.session.user.username,
            bio: req.session.user.bio,
            privacy: req.session.user.privacy
        });

        // Save session to ensure persistence
        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error:', err);
            } else {
                console.log('✅ Session saved successfully!');
            }
            req.flash('success', 'Profile updated successfully! 🎉');
            res.redirect('/users/settings/profile');
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        req.flash('error', 'Error updating profile');
        res.redirect('/users/settings/profile');
    }
});

// Avatar Upload
router.post('/avatar', upload.uploadAvatar.single('avatar'), async (req, res) => {
    try {
        console.log('🔥 AVATAR UPLOAD REQUEST:');
        console.log('User ID:', req.user.id);
        console.log('File present:', !!req.file);

        if (req.file) {
            console.log('📁 File details:', {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                filename: req.file.filename
            });
        }

        if (!req.file) {
            console.log('❌ No file uploaded');
            req.flash('error', 'Please select an image file');
            return res.redirect('/users/settings/profile');
        }

        const updatedUser = await User.findByIdAndUpdate(req.user.id, {
            avatar: req.file.filename,
            avatarType: 'upload',
            updatedAt: new Date()
        }, { new: true }).select('-password');

        console.log('📊 Database update result:');
        console.log('Avatar Type:', updatedUser.avatarType);
        console.log('Avatar Filename:', updatedUser.avatar);

        // Update session data with new avatar
        console.log('🔄 Updating session avatar data...');
        console.log('Old session avatar type:', req.session.user.avatarType);

        req.session.user = updatedUser;

        console.log('✅ Session avatar updated:');
        console.log('New session avatar type:', req.session.user.avatarType);
        console.log('New session avatar filename:', req.session.user.avatar);

        req.flash('success', 'Avatar updated successfully! 🎉');
        res.redirect('/users/settings/profile');
    } catch (error) {
        console.error('💥 GODLY ERROR in avatar upload:', error);
        req.flash('error', 'Error uploading avatar');
        res.redirect('/users/settings/profile');
    }
});

// Generate Random Avatar API
router.post('/avatar-api', async (req, res) => {
    try {
        console.log('🎲 RANDOM AVATAR REQUEST:');
        console.log('User ID:', req.user.id);
        console.log('Request body:', req.body);

        const { avatarSeed } = req.body;

        if (!avatarSeed) {
            console.log('❌ No avatar seed provided');
            req.flash('error', 'Invalid avatar seed');
            return res.redirect('/users/settings/profile');
        }

        console.log('🎲 Generating random avatar with seed:', avatarSeed);

        const updatedUser = await User.findByIdAndUpdate(req.user.id, {
            avatar: null,
            avatarSeed,
            avatarType: 'api',
            updatedAt: new Date()
        }, { new: true }).select('-password');

        console.log('📊 Database update result:');
        console.log('Avatar Type:', updatedUser.avatarType);
        console.log('Avatar Seed:', updatedUser.avatarSeed);
        console.log('Avatar URL:', updatedUser.avatarUrl);

        // Update session data with new avatar
        console.log('🔄 Updating session avatar data...');
        console.log('Old session:', {
            avatarType: req.session.user.avatarType,
            avatarSeed: req.session.user.avatarSeed
        });

        req.session.user = updatedUser;

        console.log('✅ Session updated:', {
            avatarType: req.session.user.avatarType,
            avatarSeed: req.session.user.avatarSeed,
            avatarUrl: req.session.user.avatarUrl?.substring(0, 50) + '...'
        });

        req.flash('success', 'Avatar updated successfully! 🎉');
        res.redirect('/users/settings/profile');
    } catch (error) {
        console.error('💥 GODLY ERROR in random avatar:', error);
        req.flash('error', 'Error updating avatar');
        res.redirect('/users/settings/profile');
    }
});

// Remove Avatar
router.post('/remove-avatar', async (req, res) => {
    try {
        console.log('🗑️ REMOVE AVATAR REQUEST:');
        console.log('User ID:', req.user.id);
        console.log('Current avatar type:', req.session.user.avatarType);

        // Generate a new random seed for default avatar
        const newSeed = crypto.randomBytes(8).toString('hex');
        console.log('🎲 Generated new seed for default avatar:', newSeed);

        const updatedUser = await User.findByIdAndUpdate(req.user.id, {
            avatar: null,
            avatarSeed: newSeed,
            avatarType: 'api'
        }, { new: true }).select('-password');

        console.log('📊 Database update result:');
        console.log('Avatar Type:', updatedUser.avatarType);
        console.log('New Avatar Seed:', updatedUser.avatarSeed);
        console.log('New Avatar URL:', updatedUser.avatarUrl);

        // Update session data with new avatar
        console.log('🔄 Updating session avatar data...');
        console.log('Old session:', {
            avatarType: req.session.user.avatarType,
            hasAvatar: !!req.session.user.avatar
        });

        req.session.user = updatedUser;

        console.log('✅ Session updated:', {
            avatarType: req.session.user.avatarType,
            avatarSeed: req.session.user.avatarSeed,
            hasAvatar: !!req.session.user.avatar
        });

        req.flash('success', 'Avatar removed successfully!');
        res.redirect('/users/settings/profile');
    } catch (error) {
        console.error('Error removing avatar:', error);
        req.flash('error', 'Error removing avatar');
        res.redirect('/users/settings/profile');
    }
});

// Password Settings Page
router.get('/password', async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.render('users/settings/password', {
            title: 'Password & Security',
            user,
            errors: [],
            success: null
        });
    } catch (error) {
        console.error('Error loading password settings:', error);
        req.flash('error', 'Error loading password settings');
        res.redirect('/users/profile');
    }
});

// Update Password
router.post('/password', [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('New password must contain uppercase, lowercase, number, and special character'),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Password confirmation does not match');
            }
            return true;
        })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        const { currentPassword, newPassword } = req.body;

        if (!errors.isEmpty()) {
            const user = await User.findById(req.user.id).select('-password');
            return res.render('users/settings/password', {
                title: 'Password & Security',
                user,
                errors: errors.array(),
                success: null
            });
        }

        // Get user with password
        const user = await User.findById(req.user.id);

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            const userWithoutPassword = await User.findById(req.user.id).select('-password');
            return res.render('users/settings/password', {
                title: 'Password & Security',
                user: userWithoutPassword,
                errors: [{ msg: 'Current password is incorrect' }],
                success: null
            });
        }

        // Check if new password is different from current
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            const userWithoutPassword = await User.findById(req.user.id).select('-password');
            return res.render('users/settings/password', {
                title: 'Password & Security',
                user: userWithoutPassword,
                errors: [{ msg: 'New password must be different from current password' }],
                success: null
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        await User.findByIdAndUpdate(req.user.id, {
            password: hashedPassword,
            updatedAt: new Date()
        });

        const userWithoutPassword = await User.findById(req.user.id).select('-password');
        res.render('users/settings/password', {
            title: 'Password & Security',
            user: userWithoutPassword,
            errors: [],
            success: 'Password updated successfully!'
        });
    } catch (error) {
        console.error('Error updating password:', error);
        req.flash('error', 'Error updating password');
        res.redirect('/users/settings/password');
    }
});

// Account Settings Page
router.get('/account', async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.render('users/settings/account', {
            title: 'Account Settings',
            user
        });
    } catch (error) {
        console.error('Error loading account settings:', error);
        req.flash('error', 'Error loading account settings');
        res.redirect('/users/profile');
    }
});

// Update Privacy Settings
router.post('/privacy', async (req, res) => {
    try {
        const { profilePublic, showEmail, allowMessages, showOnlineStatus } = req.body;

        const privacySettings = {
            profilePublic: profilePublic === 'on',
            showEmail: showEmail === 'on',
            allowMessages: allowMessages === 'on',
            showOnlineStatus: showOnlineStatus === 'on'
        };

        await User.findByIdAndUpdate(req.user.id, {
            privacy: privacySettings
        });

        req.flash('success', 'Privacy settings updated successfully!');
        res.redirect('/users/settings/account');
    } catch (error) {
        console.error('Error updating privacy settings:', error);
        req.flash('error', 'Error updating privacy settings');
        res.redirect('/users/settings/account');
    }
});

// Update Notification Settings
router.post('/notifications', async (req, res) => {
    try {
        const {
            emailNotifications,
            newPostNotifications,
            likeNotifications,
            commentNotifications,
            weeklyDigest
        } = req.body;

        const notificationSettings = {
            email: emailNotifications === 'on',
            newPosts: newPostNotifications === 'on',
            likes: likeNotifications === 'on',
            comments: commentNotifications === 'on',
            weeklyDigest: weeklyDigest === 'on'
        };

        await User.findByIdAndUpdate(req.user.id, {
            notifications: notificationSettings
        });

        req.flash('success', 'Notification settings updated successfully!');
        res.redirect('/users/settings/account');
    } catch (error) {
        console.error('Error updating notification settings:', error);
        req.flash('error', 'Error updating notification settings');
        res.redirect('/users/settings/account');
    }
});

// Export User Data
router.post('/export-data', async (req, res) => {
    try {
        const { exportType } = req.body;
        const user = await User.findById(req.user.id).select('-password');

        // In a real app, you'd queue this for background processing
        // For now, we'll simulate the request

        let exportData = {};

        if (exportType === 'profile' || exportType === 'complete') {
            exportData.profile = {
                displayName: user.displayName,
                email: user.email,
                bio: user.bio,
                createdAt: user.createdAt,
                privacy: user.privacy,
                notifications: user.notifications
            };
        }

        if (exportType === 'posts' || exportType === 'complete') {
            // In real app, you'd fetch user's posts
            exportData.posts = [];
        }

        if (exportType === 'complete') {
            exportData.stats = user.stats;
            exportData.metadata = {
                exportDate: new Date(),
                exportType: 'complete'
            };
        }

        // Simulate sending email with download link
        req.flash('success', `Your ${exportType} data export has been requested. You'll receive an email with the download link within 24 hours.`);
        res.redirect('/users/settings/account');
    } catch (error) {
        console.error('Error exporting data:', error);
        req.flash('error', 'Error processing data export request');
        res.redirect('/users/settings/account');
    }
});

// Delete Account - GODLY POWERS UNLEASHED! 🔥
router.post('/delete-account', [
    body('confirmDeletion')
        .equals('on')
        .withMessage('You must confirm account deletion'),
    body('exportedData')
        .equals('on')
        .withMessage('You must confirm data export status')
], async (req, res) => {
    try {
        console.log('🔥 GODLY POWERS: Account deletion request received');
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            req.flash('error', 'Please confirm all required checkboxes');
            return res.redirect('/users/settings/account');
        }

        const { deleteReason } = req.body;
        const userId = req.user.id;
        const userEmail = req.user.email;

        console.log(`🔥 GODLY POWERS: Deleting account for user ${userId} (${userEmail})`);

        // Log deletion reason for analytics (optional)
        if (deleteReason) {
            console.log(`💭 Deletion reason: ${deleteReason}`);
        }

        // TODO: In production, you might want to:
        // 1. Soft delete first (mark as deleted but keep data for X days)
        // 2. Send confirmation email
        // 3. Queue background job to clean up related data (posts, comments, etc.)
        // 4. Remove user from all groups/chats
        // 5. Anonymize user's posts instead of deleting

        // For now, we'll permanently delete the user
        const deletedUser = await User.findByIdAndDelete(userId);

        if (deletedUser) {
            console.log('🎉 GODLY SUCCESS: Account deleted successfully!');

            // Destroy session and clear cookies
            req.session.destroy((err) => {
                if (err) {
                    console.error('💥 GODLY ERROR destroying session:', err);
                }
                res.clearCookie('connect.sid');

                // Redirect to login with deletion confirmation
                res.redirect('/auth/login?message=Account deleted successfully. Thank you for using UConnect!');
            });
        } else {
            console.log('💥 GODLY ERROR: User not found for deletion');
            req.flash('error', 'Account not found');
            res.redirect('/users/settings/account');
        }
    } catch (error) {
        console.error('💥 GODLY ERROR deleting account:', error);
        req.flash('error', 'Error deleting account. Please try again.');
        res.redirect('/users/settings/account');
    }
});

// Deactivate Account (soft delete)
router.post('/deactivate', async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.id, {
            isActive: false,
            deactivatedAt: new Date()
        });

        // Destroy session
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
            }
            res.json({ success: true });
        });
    } catch (error) {
        console.error('Error deactivating account:', error);
        res.json({ success: false, error: 'Error deactivating account' });
    }
});

// Reactivate Account (for login page)
router.post('/reactivate', async (req, res) => {
    try {
        const { email } = req.body;

        await User.findOneAndUpdate(
            { email },
            {
                isActive: true,
                deactivatedAt: null
            }
        );

        req.flash('success', 'Account reactivated successfully!');
        res.redirect('/auth/login');
    } catch (error) {
        console.error('Error reactivating account:', error);
        req.flash('error', 'Error reactivating account');
        res.redirect('/auth/login');
    }
});

// Data Download Request
router.post('/download-data', async (req, res) => {
    try {
        // In a real app, this would queue a background job
        res.json({ success: true });
    } catch (error) {
        console.error('Error requesting data download:', error);
        res.json({ success: false });
    }
});

module.exports = router;
