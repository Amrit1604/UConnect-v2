# GridFS Migration Guide

## ✅ What Was Implemented

All image uploads (avatars and post images) now store directly in **MongoDB using GridFS** instead of local filesystem.

### Changes Made:

1. **Installed GridFS packages**
   - `multer-gridfs-storage` - Multer storage engine for GridFS
   - `gridfs-stream` - Stream files from GridFS

2. **Created GridFS utilities** (`utils/gridfs.js`)
   - `uploadAvatar` - Multer middleware for avatar uploads
   - `uploadPostImages` - Multer middleware for post images
   - `getFileStream()` - Stream files from GridFS
   - `deleteFile()` - Delete files from GridFS
   - `getFileMetadata()` - Get file info

3. **Added GridFS serving route** (`routes/gridfs.js`)
   - `GET /gridfs/:fileId` - Serves any file from MongoDB

4. **Updated Models**
   - **User**: Added `avatarGridFSId` and `'gridfs'` to `avatarType` enum
   - **Post**: Added `gridFSId` and `storageType` to images array

5. **Updated Routes**
   - **users.js**: Avatar upload now uses GridFS
   - **posts.js**: Ready for GridFS (will use when creating new posts)

6. **Created Migration Script** (`scripts/migrateToGridFS.js`)
   - Uploads all existing local files to GridFS
   - Updates User/Post records with GridFS file IDs
   - Keeps local files as backup

---

## 🚀 How to Migrate Your Existing Files

### Step 1: Run the migration script

```bash
npm run migrate:gridfs
```

Or directly:

```bash
node scripts/migrateToGridFS.js
```

### Step 2: What the script does

1. Connects to MongoDB
2. Finds all avatar files in `public/uploads/avatars/`
3. Uploads each to GridFS
4. Updates User records with GridFS file IDs
5. Finds all post images in `public/uploads/posts/`
6. Uploads each to GridFS
7. Updates Post records with GridFS file IDs

### Step 3: Verify migration

After running the script, you should see:
```
✅ Migrated avatar for user john_doe: avatar-123.jpg → GridFS ID: 507f1f77bcf86cd799439011
✅ Migrated post image: post-456.jpg → GridFS ID: 507f191e810c19729de860ea

📊 Avatar Migration Summary:
   Migrated: 2
   Skipped: 0

📊 Post Image Migration Summary:
   Migrated: 3
   Skipped: 0

🎉 === MIGRATION COMPLETE ===
```

---

## 🔍 How It Works

### Before (Local Storage):
```
User uploads avatar → Saved to public/uploads/avatars/avatar-123.jpg
                   → User.avatar = "avatar-123.jpg"
                   → Served via: /uploads/avatars/avatar-123.jpg
```

### After (GridFS):
```
User uploads avatar → Saved to MongoDB GridFS
                   → User.avatarGridFSId = ObjectId("507f...")
                   → User.avatarType = "gridfs"
                   → Served via: /gridfs/507f...
```

### Image URLs:
- **Local**: `/uploads/avatars/avatar-123.jpg`
- **GridFS**: `/gridfs/507f1f77bcf86cd799439011`

---

## 📝 Testing Checklist

After migration, test:

1. **View existing users**
   - Go to profile pages
   - Avatars should display correctly
   - Check browser console for 404 errors

2. **Upload new avatar**
   - Go to Settings → Profile
   - Upload new avatar
   - Should save to GridFS and display immediately

3. **View existing posts**
   - Go to feed
   - Post images should display correctly

4. **Create new post with images**
   - Create a post with images
   - Images should save to GridFS
   - Should display in feed

5. **Check database**
   ```bash
   # In MongoDB shell/Compass
   db.users.findOne({ avatarType: 'gridfs' })
   # Should have avatarGridFSId field
   
   db.uploads.files.find()
   # Should see uploaded files
   
   db.uploads.chunks.find()
   # Should see file chunks
   ```

---

## 🎯 Benefits of GridFS

✅ **All data in MongoDB** - No separate file storage service needed
✅ **Works on Render/Heroku** - Ephemeral filesystem doesn't matter
✅ **Persistent uploads** - Files survive server restarts
✅ **Backup with database** - Files included in MongoDB backups
✅ **No cloud service signup** - No Cloudinary/S3 needed
✅ **Access control** - Can add auth to file serving route

---

## ⚠️ Important Notes

1. **Local files are NOT deleted** - Migration keeps originals as backup
2. **New uploads go to GridFS** - All future uploads use GridFS automatically
3. **Old URLs still work** - If you didn't migrate, local files still serve
4. **You can delete local files** - After verifying migration, you can delete `public/uploads/` folder

---

## 🗑️ Optional: Clean Up Local Files

After verifying migration works:

```bash
# Windows
rmdir /s public\uploads\avatars
rmdir /s public\uploads\posts

# Linux/Mac
rm -rf public/uploads/avatars
rm -rf public/uploads/posts
```

**Only do this after 100% sure migration worked!**

---

## 🐛 Troubleshooting

### Images not displaying after migration

1. Check browser console for errors
2. Verify GridFS route is registered: `app.use('/gridfs', gridfsRoutes)`
3. Check database has files: `db.uploads.files.find()`
4. Verify User/Post records have `gridFSId` fields

### Migration script fails

1. Ensure MongoDB is running and connected
2. Check `.env` has correct `MONGODB_URI`
3. Verify local files exist in `public/uploads/`
4. Check file permissions

### New uploads fail

1. Restart server after code changes
2. Check GridFS initialized: Look for "✅ GridFS initialized" in logs
3. Verify multer middleware is using GridFS storage
4. Check MongoDB connection is stable

---

## 📊 Database Collections

GridFS creates two collections:

1. **uploads.files** - File metadata (filename, size, type, etc.)
2. **uploads.chunks** - File data in 255KB chunks

View in MongoDB Compass or shell:
```javascript
db.uploads.files.find().pretty()
db.uploads.chunks.count()
```

---

## 🚀 Deployment to Render

With GridFS, deploying to Render is simple:

1. Push code to GitHub
2. Set environment variables in Render:
   - `MONGODB_URI` (your MongoDB Atlas connection string)
   - `SESSION_SECRET`
   - `NODE_ENV=production`
3. Deploy!

All uploads will work immediately on Render because they're stored in MongoDB, not local filesystem.

---

## 🎉 Done!

Your UConnect app now stores all uploads in MongoDB GridFS. All users will see the same images regardless of which server instance handles their request.

Run the migration script when ready:
```bash
npm run migrate:gridfs
```
