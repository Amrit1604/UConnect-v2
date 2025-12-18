const PQueue = require('p-queue').default;
const mongoose = require('mongoose');
const Post = require('../models/Post');
const { transcodeGridFsToMp4 } = require('./transcode');

// Simple queue using p-queue for concurrency control
const queue = new PQueue({ concurrency: parseInt(process.env.TRANSCODE_CONCURRENCY || '2', 10) });

async function processJob(job) {
  const { postId, mediaIndex, gridFsId, originalName } = job;
  try {
    console.log('🔁 [Queue] Starting transcode job for post', postId, 'mediaIndex', mediaIndex, 'file', gridFsId);

    const newId = await transcodeGridFsToMp4(gridFsId, { originalName });

    if (!newId) throw new Error('Transcode returned no id');

    // Update Post: clear transcoding flag on original media and push mp4 entry
    const post = await Post.findById(postId);
    if (!post) throw new Error('Post not found: ' + postId);

    // Clear transcoding flag if present
    if (post.media && post.media[mediaIndex]) {
      post.media[mediaIndex].transcoding = false;
      post.media[mediaIndex].transcodeAttempts = (post.media[mediaIndex].transcodeAttempts || 0) + 1;
    }

    // Add mp4 entry
    post.media.push({
      type: 'video',
      filename: '',
      originalName: (originalName || 'transcoded') + '.mp4',
      size: null,
      mimetype: 'video/mp4',
      url: `/gridfs/file/${newId}`,
      gridFSId: newId,
      transcoded: true
    });

    await post.save();

    console.log('✅ [Queue] Transcode complete and saved for post', postId, 'newId', newId.toString());
    return { success: true, newId };
  } catch (err) {
    console.error('❌ [Queue] Transcode job failed:', err.message || err);

    // Increment attempt counter on post media item
    try {
      const post = await Post.findById(job.postId);
      if (post && post.media && post.media[job.mediaIndex]) {
        post.media[job.mediaIndex].transcodeAttempts = (post.media[job.mediaIndex].transcodeAttempts || 0) + 1;
        if (post.media[job.mediaIndex].transcodeAttempts >= (parseInt(process.env.TRANSCODE_MAX_ATTEMPTS || '3', 10))) {
          post.media[job.mediaIndex].transcoding = false; // give up
        }
        await post.save();
      }
    } catch (e) {
      console.error('Error updating post transcodeAttempts', e.message || e);
    }

    throw err;
  }
}

function enqueueTranscode({ postId, mediaIndex, gridFsId, originalName }) {
  const job = { postId, mediaIndex, gridFsId, originalName };
  // Wrap in a function that supports retry semantics using queue.add
  queue.add(() => processJob(job)).catch(err => {
    console.error('Job failed after retries (logged once):', err.message || err);
  });
}

module.exports = { enqueueTranscode, _queue: queue };
