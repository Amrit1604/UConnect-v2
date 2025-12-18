// debugPostMedia.js
// Usage: node scripts/debugPostMedia.js <username>

const mongoose = require('mongoose');
// Load .env if present
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
// Ensure MONGODB_URI is set so utils/gridfs doesn't throw when required
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_connect';
const { connectDB } = require('../config/database');
const User = require('../models/User');
const Post = require('../models/Post');
const { getFileInfo } = require('../utils/gridfs');

async function run() {
  const username = process.argv[2];
  if (!username) {
    console.error('Usage: node scripts/debugPostMedia.js <username>');
    process.exit(2);
  }

  await connectDB();

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      console.error('User not found:', username);
      process.exit(1);
    }

    console.log('Found user:', user.username, 'id=', user._id);

    const posts = await Post.find({ author: user._id, isActive: true }).sort({ createdAt: -1 }).limit(10).lean();
    if (!posts || posts.length === 0) {
      console.log('No posts found for user');
      process.exit(0);
    }

    for (const post of posts) {
      console.log('--- Post:', post._id.toString(), 'createdAt:', post.createdAt);
      console.log('Content:', (post.content || '').slice(0, 200));
      console.log('Images:', (post.images || []).map(i => ({ filename: i.filename, url: i.url, gridFSId: i.gridFSId })));
      console.log('Media:', (post.media || []).map(m => ({ type: m.type, filename: m.filename, url: m.url, gridFSId: m.gridFSId, mimetype: m.mimetype })));

      // If media contains gridFSId or a url with id, try to fetch file info across common buckets
      for (const m of (post.media || [])) {
        let idCandidate = m.gridFSId;
        if (!idCandidate && m.url) {
          // extract last path segment
          try {
            const parts = m.url.split('/').filter(Boolean);
            const last = parts[parts.length - 1];
            // remove querystring
            idCandidate = last.split('?')[0];
          } catch (e) {
            // ignore
          }
        }

        if (idCandidate) {
          try {
            // try multiple buckets
            const db = mongoose.connection.db;
            const buckets = ['uploads', 'avatars', 'posts', 'videos'];
            let found = null;
            const objectId = mongoose.Types.ObjectId.isValid(idCandidate) ? new mongoose.Types.ObjectId(idCandidate) : null;
            for (const bucket of buckets) {
              const col = `${bucket}.files`;
              const q = objectId ? { _id: objectId } : { filename: idCandidate };
              const files = await db.collection(col).find(q).toArray();
              if (files.length > 0) {
                found = files[0];
                console.log('GridFS', bucket, 'file info for', idCandidate, ':', {
                  filename: found.filename,
                  contentType: found.contentType,
                  length: found.length,
                  uploadDate: found.uploadDate,
                  metadata: found.metadata
                });
                break;
              }
            }
            if (!found) {
              console.error('❌ Error getting media file info: File not found for', idCandidate);
            }
          } catch (e) {
            console.error('Failed to get media info for', idCandidate, e.message);
          }
        } else {
          console.log('No gridFS id or url to inspect for media item:', m);
        }
      }

      // Also check images gridFS (search across buckets if needed)
      for (const img of (post.images || [])) {
        let idCandidate = img.gridFSId;
        if (!idCandidate && img.url) {
          try {
            const parts = img.url.split('/').filter(Boolean);
            const last = parts[parts.length - 1];
            idCandidate = last.split('?')[0];
          } catch (e) {}
        }

        if (idCandidate) {
          try {
            const db = mongoose.connection.db;
            const buckets = ['uploads', 'avatars', 'posts', 'videos'];
            let found = null;
            const objectId = mongoose.Types.ObjectId.isValid(idCandidate) ? new mongoose.Types.ObjectId(idCandidate) : null;
            for (const bucket of buckets) {
              const col = `${bucket}.files`;
              const q = objectId ? { _id: objectId } : { filename: idCandidate };
              const files = await db.collection(col).find(q).toArray();
              if (files.length > 0) {
                found = files[0];
                console.log('GridFS', bucket, 'image info for', idCandidate, ':', {
                  filename: found.filename,
                  contentType: found.contentType,
                  length: found.length,
                  uploadDate: found.uploadDate,
                  metadata: found.metadata
                });
                break;
              }
            }
            if (!found) {
              console.error('❌ Error getting image file info: File not found for', idCandidate);
            }
          } catch (e) {
            console.error('Failed to get image info for', idCandidate, e.message);
          }
        } else {
          console.log('No gridFS id or url to inspect for image item:', img);
        }
      }

      console.log('\n');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error in debug script:', err);
    process.exit(1);
  }
}

run();
