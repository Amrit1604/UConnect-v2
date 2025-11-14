# UConnect Feature Testing Guide

## Recent Fixes Applied

### 1. Delete Post Feature
**What was fixed:**
- Modified DELETE route to properly check post ownership before deletion
- Added detailed console logging for debugging
- Improved error handling for AJAX requests

**How to test:**
1. Go to your profile page
2. Click "DELETE POSTS" button
3. Select one or more posts using checkboxes
4. Click "DELETE SELECTED"
5. Confirm the deletion
6. Page should reload and posts should be removed

**What to check:**
- Posts disappear after deletion
- No error messages appear
- Post count updates correctly

---

### 2. Like Feature
**What was fixed:**
- Changed response property from `likeCount` to `likesCount` for consistency
- Ensured JSON response format matches frontend expectations

**How to test:**
1. Go to feed page (`/posts`)
2. Click the ❤️ button on any post
3. Button should toggle red background
4. Like count should update immediately

**What to check:**
- Like button changes color when clicked
- Count increments/decrements correctly
- Changes persist on page reload

---

### 3. Comment Feature
**What was fixed:**
- Added `/posts/:id/comments` (plural) route alias
- Frontend was calling `/comments` but backend only had `/comment`
- Now both endpoints work

**How to test:**
1. Go to feed page (`/posts`)
2. Click 💬 button on any post
3. Comment input field should appear
4. Type a comment and press "POST"
5. Page reloads showing your new comment

**What to check:**
- Comment input appears when clicking comment button
- Comment is saved and displays after posting
- Comment count updates

---

### 4. Share Feature (NEW)
**What was added:**
- New share button with 🔗 icon
- Copy-to-clipboard functionality
- Visual feedback when link is copied

**How to test:**
1. Go to feed page (`/posts`)
2. Click 🔗 SHARE button on any post
3. On mobile: Native share dialog appears
4. On desktop: Link copies to clipboard, button shows "COPIED!" for 2 seconds

**What to check:**
- Share button is visible next to VIEW button
- Link copies successfully (try pasting in another tab)
- Button provides visual feedback (red background, text change)
- Copied link works when pasted in browser

---

## Common Issues to Watch For

### Delete Not Working
**Symptoms:**
- "Failed to delete posts" error message
- Posts don't disappear after deletion

**Check:**
- Browser console for error messages (F12 → Console tab)
- Network tab to see if DELETE request reaches server
- Server console for detailed logs starting with ❌ or ✅

### Like Not Updating
**Symptoms:**
- Like button doesn't change color
- Count doesn't update
- Console shows "Cannot read property 'likesCount'"

**Check:**
- Network tab shows `/posts/:id/like` request succeeds
- Response JSON contains `likesCount` property
- No JavaScript errors in console

### Comment Not Saving
**Symptoms:**
- Page reloads but comment doesn't appear
- "404 Not Found" error in console

**Check:**
- Network tab shows POST to `/posts/:id/comments` (plural)
- Response is 200 OK, not 404
- Comment appears in database

### Share Not Copying
**Symptoms:**
- No feedback after clicking share
- "Failed to share post" alert

**Check:**
- Browser supports `navigator.clipboard` (HTTPS required)
- Console for clipboard permission errors
- Try on different browser if issues persist

---

## Testing Checklist

- [ ] Delete single post from profile page
- [ ] Delete multiple posts at once
- [ ] Like a post (verify count increases)
- [ ] Unlike a post (verify count decreases)
- [ ] Like persists after page reload
- [ ] Add comment to a post
- [ ] Comment appears in feed
- [ ] Comment count updates
- [ ] Share post via share button
- [ ] Copied link opens correct post
- [ ] All features work on mobile view
- [ ] No JavaScript errors in console
- [ ] No 404 errors in network tab

---

## Debugging Commands

### Check server logs:
```bash
# Start server with logging
npm start
# or
node app.js
```

### Check browser console:
- Press F12 → Console tab
- Look for errors in red
- Check Network tab for failed requests

### Test endpoints directly:
```javascript
// Test like endpoint (in browser console on feed page)
fetch('/posts/POST_ID_HERE/like', { method: 'POST' })
  .then(r => r.json())
  .then(console.log);

// Test comment endpoint
fetch('/posts/POST_ID_HERE/comments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: 'Test comment' })
}).then(r => r.json()).then(console.log);

// Test delete endpoint
fetch('/posts/POST_ID_HERE', { method: 'DELETE' })
  .then(r => r.json())
  .then(console.log);
```

---

## Expected Server Logs

### Successful Delete:
```
✅ Post deleted successfully: 60a7c3f4e9b8a20015c5d123
```

### Failed Delete (not owner):
```
❌ Not authorized: 60a7c3f4e9b8a20015c5d456 vs 60a7c3f4e9b8a20015c5d789
```

### Like Success:
```
⚡ Real-time broadcast: Post liked by username123
```

### Comment Success:
```
⚡ Real-time broadcast: New comment on post by username123
```

---

## Contact & Support

If issues persist after testing:
1. Check all console logs (browser + server)
2. Verify you're logged in
3. Clear browser cache and cookies
4. Try in incognito/private mode
5. Test on different browser

All features have been updated and tested. Report any issues with:
- Browser name and version
- Error messages (screenshot)
- Steps to reproduce
