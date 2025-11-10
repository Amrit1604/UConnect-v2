# 🚀 UConnect v2 - Deployment Guide for Portfolio

## 📋 **DEPLOYMENT CHECKLIST**

### **Step 1: Prepare Your Project**

✅ **Files Created:**
- `vercel.json` - Vercel deployment configuration
- `.env.production` - Production environment template  
- `.github/workflows/deploy.yml` - CI/CD pipeline
- Updated README with portfolio-ready description

### **Step 2: Set Up MongoDB Atlas (Free)**

1. **Go to [MongoDB Atlas](https://cloud.mongodb.com/)**
2. **Create free cluster**
3. **Get connection string** (replace username/password)
4. **Whitelist IP**: `0.0.0.0/0` (all IPs)

### **Step 3: Deploy to Vercel**

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Add deployment configuration"
   git push origin master
   ```

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Connect your GitHub account
   - Import `UConnect-v2` repository
   - Deploy!

3. **Set Environment Variables in Vercel:**
   ```
   NODE_ENV=production
   MONGODB_URI=your_mongodb_atlas_connection_string
   SESSION_SECRET=your_32_char_secret
   JWT_SECRET=your_32_char_jwt_secret
   GMAIL_USER=your_email@gmail.com
   GMAIL_APP_PASSWORD=your_gmail_app_password
   ```

### **Step 4: Get Live URL for Portfolio**

After deployment, you'll get a live URL like:
**`https://uconnect-v2.vercel.app`**

---

## 🔗 **FOR YOUR RESUME & PORTFOLIO**

### **Project Description:**
```
UConnect v2 - Full-Stack Social Media Platform
• Built modern social networking app for university students using Node.js, Express, MongoDB
• Implemented JWT authentication, real-time features with Socket.io, responsive UI
• Features: User profiles, post management, campus-specific networking, admin dashboard
• Deployed with CI/CD pipeline using GitHub Actions and Vercel
• Tech Stack: Node.js, Express, MongoDB, EJS, Socket.io, Vercel
```

### **Live Demo Links:**
- **Website**: `https://your-app-url.vercel.app`
- **GitHub**: `https://github.com/Amrit1604/UConnect-v2`
- **Portfolio**: Add this URL to your portfolio

### **Key Technical Achievements:**
- ✅ Full-stack development with MVC architecture
- ✅ Real-time features using WebSocket (Socket.io)
- ✅ Secure authentication with JWT and email verification  
- ✅ RESTful API design with input validation
- ✅ Responsive design with mobile-first approach
- ✅ Production deployment with CI/CD automation
- ✅ Database design and optimization

---

## 🎯 **NEXT STEPS**

1. **Deploy to Vercel** (follow Step 3 above)
2. **Test your live app** (register, create posts, etc.)
3. **Add live URL to your resume**
4. **Update your portfolio** with project details
5. **Share on LinkedIn** with demo link

---

**Your app will be live at**: `https://your-app-name.vercel.app` 

Perfect for recruiters to see your full-stack skills! 🚀