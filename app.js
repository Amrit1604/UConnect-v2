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

// Import routes
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const settingsRoutes = require('./routes/settings');
const chatRoutes = require('./routes/chat');

// Import middleware
const { requireAuth, requireAdmin } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const { urlDetectorMiddleware, createUrlTestRoute } = require('./utils/smartUrl');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 4000;

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_connect', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting - COMMENTED OUT FOR TESTING
/*
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);
*/

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://your-domain.com' : 'http://localhost:4000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(methodOverride('_method'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_connect',
    touchAfter: 24 * 3600 // lazy session update
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  }
}));

// Flash messages
app.use(flash());

// Smart URL detection middleware 🌍
app.use(urlDetectorMiddleware);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Global middleware to pass user data to all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.messages = {
    success: req.flash('success'),
    error: req.flash('error'),
    warning: req.flash('warning'),
    info: req.flash('info')
  };
  res.locals.currentPath = req.path;
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/posts', postRoutes);
app.use('/users', userRoutes);
app.use('/admin', adminRoutes);
app.use('/settings', settingsRoutes);
app.use('/chat', chatRoutes);

// URL test route for debugging 🔧
app.use('/debug', createUrlTestRoute());

// Root route

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

// 🔥 SOCKET.IO REAL-TIME FEATURES ⚡
io.on('connection', (socket) => {
  console.log('🚀 User connected:', socket.id);

  // Join user to their campus room
  socket.on('join-campus', (campus) => {
    socket.join(campus);
    console.log(`👥 User joined campus: ${campus}`);
  });

  // Handle new post creation
  socket.on('new-post', (postData) => {
    console.log('📝 New post created:', postData.content?.substring(0, 30) + '...');
    // Broadcast to all users in the same campus
    socket.to(postData.campus).emit('post-created', postData);
  });

  // Handle real-time likes
  socket.on('like-post', (data) => {
    socket.to(data.campus).emit('post-liked', data);
  });

  // Handle real-time comments
  socket.on('new-comment', (data) => {
    socket.to(data.campus).emit('comment-added', data);
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    socket.to(data.campus).emit('user-typing', data);
  });

  // 🔐 SECRET CHAT FUNCTIONALITY 🔐

  // Join private room
  socket.on('joinPrivateRoom', (data) => {
    const { roomId } = data;
    socket.join(roomId);
    console.log(`🔒 User joined private room: ${roomId}`);
  });

  // Handle private messages
  socket.on('sendPrivateMessage', async (data) => {
    const { roomId, message } = data;

    try {
      // Save message to database
      const PrivateChat = require('./models/PrivateChat');
      const newMessage = new PrivateChat({
        roomId: roomId,
        sender: socket.userId,
        message: message,
        timestamp: new Date()
      });

      await newMessage.save();
      await newMessage.populate('sender', 'name username avatarUrl');

      // Emit to all users in the private room
      const messageData = {
        sender: {
          id: newMessage.sender._id,
          name: newMessage.sender.name,
          username: newMessage.sender.username,
          avatarUrl: newMessage.sender.avatarUrl
        },
        message: newMessage.message,
        timestamp: newMessage.timestamp.toLocaleTimeString()
      };

      io.to(roomId).emit('newPrivateMessage', messageData);
      console.log(`💬 Private message sent in room: ${roomId}`);
    } catch (error) {
      console.error('Error sending private message:', error);
      socket.emit('messageError', { error: 'Failed to send message' });
    }
  });

  // Handle typing in private rooms
  socket.on('privateTyping', (data) => {
    const { roomId, isTyping } = data;
    socket.to(roomId).emit('userTyping', {
      userId: socket.userId,
      isTyping: isTyping
    });
  });

  // Store user ID when they connect (set by auth middleware)
  socket.on('setUserId', (userId) => {
    socket.userId = userId;
    console.log(`🔑 User ID set for socket: ${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('👋 User disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

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