# 🧪 UConnect Testing Plan

## ✅ **Current Tests (6 files, 33 tests)**

### **Passing Tests (31/33)** ✅
1. **admin.routes.test.js** - Admin access control
2. **app.sanity.test.js** - Homepage loads
3. **auth.routes.test.js** - Login/register pages
4. **chat.test.js** - Chat system (follow requests, messaging, spam detection) - 25+ tests
5. **user.model.test.js** - User CRUD ⚠️ (needs connection fix)
6. **post.model.test.js** - Post CRUD ⚠️ (needs connection fix)

### **Issues to Fix**
- ❌ **Memory leak**: Socket.IO server not closing properly
- ⚠️ **Model tests**: Mongoose connection conflicts (partially fixed)

---

## 📋 **Suggested New Test Files**

### **Priority 1: Critical Routes** 🔴

#### **1. tests/posts.routes.test.js** (NEW)
```javascript
// Test post creation, editing, deletion, likes
- POST /posts/create
- GET /posts/:id
- PUT /posts/:id/edit
- DELETE /posts/:id
- POST /posts/:id/like
- GET /posts/feed
```

#### **2. tests/friends.routes.test.js** (NEW)
```javascript
// Test friend system
- POST /friends/add/:userId
- GET /friends/list
- DELETE /friends/remove/:userId
- GET /friends/suggestions
- GET /friends/mutual/:userId
```

#### **3. tests/gossip.routes.test.js** (NEW)
```javascript
// Test anonymous gossip system
- POST /gossip/create (anonymous)
- GET /gossip/feed
- POST /gossip/:id/reply
- POST /gossip/:id/report
```

---

### **Priority 2: Feature Tests** 🟡

#### **4. tests/notifications.test.js** (NEW)
```javascript
// Test notification system
- GET /notifications
- POST /notifications/:id/read
- DELETE /notifications/:id
- GET /notifications/unread/count
```

#### **5. tests/settings.routes.test.js** (NEW)
```javascript
// Test user settings
- GET /settings
- POST /settings/profile
- POST /settings/password
- POST /settings/privacy
- POST /settings/avatar
```

#### **6. tests/gridfs.test.js** (NEW)
```javascript
// Test file upload/download
- POST /gridfs/upload
- GET /gridfs/:fileId
- DELETE /gridfs/:fileId
```

---

### **Priority 3: Integration Tests** 🟢

#### **7. tests/auth.integration.test.js** (NEW)
```javascript
// Full auth flow
- Register → Verify Email → Login → Logout
- Password reset flow
- Session persistence
```

#### **8. tests/chat.integration.test.js** (Enhancement)
```javascript
// Real-time chat features
- Socket.IO connection tests
- Real-time message delivery
- Typing indicators
- Online/offline status
```

#### **9. tests/post.integration.test.js** (NEW)
```javascript
// Full post lifecycle
- Create post → Like → Comment → Edit → Delete
- Post visibility (public/friends only)
- Post media upload
```

---

## 🎯 **Testing Coverage Goals**

### **Current Coverage: 22.92%**
- **Routes**: 15.62% ❌ (TARGET: 60%+)
- **Models**: 57.25% ✅ (Good)
- **Middleware**: 30.4% ⚠️ (TARGET: 50%+)
- **Services**: 15.53% ❌ (TARGET: 40%+)

### **Target Coverage by Priority**
1. **Routes** (15% → 60%): Add route tests
2. **Middleware** (30% → 50%): Test auth, error handling
3. **Services** (15% → 40%): Test email, Redis, Socket.IO

---

## 🚀 **Quick Wins** (Easy tests to add)

### **1. Middleware Tests**
```javascript
tests/middleware/auth.test.js
tests/middleware/errorHandler.test.js
tests/middleware/upload.test.js
```

### **2. Model Validation Tests**
```javascript
tests/models/user.validation.test.js
tests/models/post.validation.test.js
tests/models/message.validation.test.js
```

### **3. Utility Tests**
```javascript
tests/utils/anon.test.js
tests/utils/gridfs.test.js
```

---

## 📊 **Test Metrics to Track**

- **Total Tests**: 33 → Target: 100+
- **Coverage**: 23% → Target: 60%+
- **Test Speed**: ~90s → Keep under 120s
- **Pass Rate**: 93.9% (31/33) → Target: 100%

---

## 🔧 **Next Steps**

1. ✅ Fix model test connection issues
2. ✅ Fix Socket.IO memory leak
3. 📝 Add posts.routes.test.js
4. 📝 Add friends.routes.test.js
5. 📝 Add middleware tests
6. 📊 Generate coverage report
7. 🎯 Reach 60% coverage target

---

## 💡 **Testing Best Practices**

- ✅ Use `beforeAll/afterAll` for setup/cleanup
- ✅ Mock external services (email, Redis)
- ✅ Test both success and error cases
- ✅ Use factories for test data
- ✅ Keep tests independent
- ✅ Name tests descriptively
- ✅ Group related tests with `describe()`
