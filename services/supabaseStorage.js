/**
 * Supabase Storage Service
 * Handles file uploads, deletions, and URL generation for images/videos
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role for admin access
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'media';

/**
 * Upload file to Supabase Storage
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {String} filePath - Path in bucket (e.g., 'avatars/user123/avatar.jpg')
 * @param {String} contentType - MIME type (e.g., 'image/jpeg')
 * @returns {Promise<Object>} { url, path, error }
 */
async function uploadFile(fileBuffer, filePath, contentType) {
  try {
    console.log(`📤 Uploading to Supabase: ${filePath}`);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType,
        upsert: true, // Replace if exists
        cacheControl: '31536000', // Cache for 1 year
        duplex: 'half' // Fix for streaming
      });

    if (error) {
      console.error('❌ Supabase upload error:', error);
      return { error: error.message };
    }

    // Get public URL with transform options
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath, {
        download: false // Stream, don't force download
      });

    console.log(`✅ Uploaded successfully: ${urlData.publicUrl}`);

    return {
      url: urlData.publicUrl,
      path: filePath,
      error: null
    };
  } catch (error) {
    console.error('❌ Upload exception:', error);
    return { error: error.message };
  }
}

/**
 * Delete file from Supabase Storage
 * @param {String} filePath - Path in bucket
 * @returns {Promise<Object>} { success, error }
 */
async function deleteFile(filePath) {
  try {
    console.log(`🗑️ Deleting from Supabase: ${filePath}`);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('❌ Supabase delete error:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Deleted successfully: ${filePath}`);
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Delete exception:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get public URL for a file
 * @param {String} filePath - Path in bucket
 * @returns {String} Public URL
 */
function getPublicUrl(filePath) {
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Delete multiple files
 * @param {Array<String>} filePaths - Array of file paths
 * @returns {Promise<Object>} { success, error }
 */
async function deleteFiles(filePaths) {
  try {
    console.log(`🗑️ Deleting ${filePaths.length} files from Supabase`);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filePaths);

    if (error) {
      console.error('❌ Supabase batch delete error:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Deleted ${filePaths.length} files successfully`);
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Batch delete exception:', error);
    return { success: false, error: error.message };
  }
}

/**
 * List files in a folder (for debugging/admin)
 * @param {String} folder - Folder path (e.g., 'avatars/user123')
 * @returns {Promise<Array>} List of files
 */
async function listFiles(folder = '') {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(folder);

    if (error) {
      console.error('❌ List files error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ List files exception:', error);
    return [];
  }
}

/**
 * Generate unique file path
 * @param {String} folder - Folder name (avatars/posts/chat)
 * @param {String} userId - User ID
 * @param {String} filename - Original filename
 * @returns {String} Full path (e.g., 'avatars/123/1234567890-avatar.jpg')
 */
function generateFilePath(folder, userId, filename) {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${folder}/${userId}/${timestamp}-${sanitizedFilename}`;
}

module.exports = {
  uploadFile,
  deleteFile,
  deleteFiles,
  getPublicUrl,
  listFiles,
  generateFilePath,
  supabase
};
