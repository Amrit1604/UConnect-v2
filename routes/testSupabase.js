/**
 * Supabase Test Route
 * Tests the storage connection and bucket configuration
 */

const express = require('express');
const router = express.Router();
const { supabase, uploadFile, listFiles, getPublicUrl, generateFilePath } = require('../services/supabaseStorage');

const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'media';

// GET /api/test-supabase - Test Supabase configuration
router.get('/test-supabase', async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    config: {
      SUPABASE_URL: process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing',
      SUPABASE_BUCKET: BUCKET_NAME
    },
    tests: {}
  };

  try {
    // Test 1: Check if bucket exists and is accessible
    console.log('🧪 Testing Supabase bucket access...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      results.tests.listBuckets = { status: '❌ Failed', error: bucketsError.message };
    } else {
      const targetBucket = buckets.find(b => b.name === BUCKET_NAME);
      if (targetBucket) {
        results.tests.listBuckets = { 
          status: '✅ Success', 
          bucket: {
            name: targetBucket.name,
            public: targetBucket.public,
            created_at: targetBucket.created_at
          }
        };
        
        // Check if bucket is public
        if (!targetBucket.public) {
          results.tests.bucketPublic = { 
            status: '⚠️ Warning', 
            message: 'Bucket is NOT public. Images may not be accessible without authentication.' 
          };
        } else {
          results.tests.bucketPublic = { status: '✅ Bucket is public' };
        }
      } else {
        results.tests.listBuckets = { 
          status: '❌ Failed', 
          error: `Bucket '${BUCKET_NAME}' not found. Available buckets: ${buckets.map(b => b.name).join(', ')}` 
        };
      }
    }

    // Test 2: List files in posts folder
    console.log('🧪 Listing files in posts folder...');
    const files = await listFiles('posts');
    results.tests.listFiles = { 
      status: '✅ Success', 
      filesCount: files.length,
      recentFiles: files.slice(0, 5).map(f => ({ name: f.name, created: f.created_at }))
    };

    // Test 3: Test upload with a small test file
    console.log('🧪 Testing file upload...');
    const testContent = Buffer.from('Test image content ' + Date.now());
    const testPath = generateFilePath('test', 'system', 'test.txt');
    const uploadResult = await uploadFile(testContent, testPath, 'text/plain');
    
    if (uploadResult.error) {
      results.tests.testUpload = { status: '❌ Failed', error: uploadResult.error };
    } else {
      results.tests.testUpload = { 
        status: '✅ Success', 
        url: uploadResult.url,
        path: uploadResult.path
      };

      // Test 4: Verify URL is accessible
      console.log('🧪 Verifying URL accessibility...');
      try {
        const response = await fetch(uploadResult.url, { method: 'HEAD' });
        results.tests.urlAccessible = { 
          status: response.ok ? '✅ URL is accessible' : '❌ URL not accessible', 
          httpStatus: response.status,
          headers: {
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length')
          }
        };
      } catch (fetchError) {
        results.tests.urlAccessible = { 
          status: '❌ Failed to fetch', 
          error: fetchError.message 
        };
      }

      // Cleanup test file
      try {
        const { error: delError } = await supabase.storage.from(BUCKET_NAME).remove([testPath]);
        results.tests.cleanup = delError ? { status: '⚠️ Cleanup failed' } : { status: '✅ Cleaned up' };
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // Overall status
    const allPassed = Object.values(results.tests).every(t => 
      t.status && (t.status.includes('✅') || t.status.includes('⚠️'))
    );
    results.overallStatus = allPassed ? '✅ Supabase is configured correctly!' : '❌ Some tests failed';

  } catch (error) {
    console.error('❌ Supabase test error:', error);
    results.error = error.message;
    results.overallStatus = '❌ Test failed with exception';
  }

  res.json(results);
});

// GET /api/debug-posts - Show recent posts with media info
router.get('/debug-posts', async (req, res) => {
  try {
    const Post = require('../models/Post');
    const posts = await Post.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('content images media videos createdAt author')
      .populate('author', 'username');

    const debugData = posts.map(p => ({
      id: p._id,
      author: p.author?.username || 'Unknown',
      content: (p.content || '').substring(0, 50) + '...',
      createdAt: p.createdAt,
      images: (p.images || []).map(img => ({
        hasUrl: !!img.url,
        url: img.url,
        filename: img.filename,
        storageType: img.storageType
      })),
      media: (p.media || []).map(m => ({
        type: m.type,
        hasUrl: !!m.url,
        url: m.url,
        filename: m.filename,
        storageType: m.storageType
      })),
      videos: (p.videos || []).length
    }));

    res.json({
      postsCount: posts.length,
      posts: debugData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
