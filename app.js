const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// ==========================================
// CONFIGURATION MODULES
// ==========================================
const { connectDB } = require('./config/database');
const { configureSession } = require('./config/session');
const { configureCORS } = require('./config/cors');
const { configureHelmet } = require('./config/helmet');
const { configureAppMiddleware } = require('./middleware/appMiddleware');
const { configureServer } = require('./startup/server');

// ==========================================
// ROUTES
// ==========================================
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const settingsRoutes = require('./routes/settings');
// const chatRoutes = require('./routes/chat');

// ==========================================
// MIDDLEWARE
// ==========================================
const { requireAuth, requireAdmin } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
// const { urlDetectorMiddleware, createUrlTestRoute } = require('./utils/smartUrl');

// ==========================================
// EXPRESS APP SETUP
// ==========================================
const app = express();
const PORT = process.env.PORT || 4000;

// Database connection
connectDB();

// Security middleware
configureHelmet(app);

// Session configuration (MUST be before appMiddleware)
configureSession(app);

// Flash messages (needs session)
app.use(require('connect-flash')());

// Application middleware
configureAppMiddleware(app);

// CORS configuration
configureCORS(app);

// Server and Socket.IO setup
const { server, io } = configureServer(app);

// ==========================================
// ROUTES SETUP
// ==========================================
app.use('/auth', authRoutes);
app.use('/posts', postRoutes);
app.use('/users', userRoutes);
app.use('/admin', adminRoutes);
app.use('/settings', settingsRoutes);
// app.use('/chat', chatRoutes);

// URL test route for debugging 🔧
// app.use('/debug', createUrlTestRoute());

// ==========================================
// BASIC ROUTES
// ==========================================

// Home route
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/posts');
  } else {
    res.render('index', {
      title: 'UConnect - Connect with your campus community',
      description: 'Join your campus community. Share, connect, and stay updated with fellow students.'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    error: {
      status: 404,
      message: 'The page you are looking for does not exist.'
    },
    showStack: null,
    user: req.user || null,
    bodyTemplate: null
  });
});

// Error handling middleware
app.use(errorHandler);

// Make io accessible to routes
app.set('io', io);

// ==========================================
// SERVER MANAGEMENT
// ==========================================

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 UConnect server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📱 Access the app at: http://localhost:${PORT}`);
  console.log(`⚡ Socket.IO enabled for real-time features!`);
});

module.exports = app;