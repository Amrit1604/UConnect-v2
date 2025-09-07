# 🎓 UConnect - Campus Social Platform

A comprehensive, secure social media platform designed exclusively for Indian university students with .edu.in email addresses. UConnect provides a safe space for students to connect, share ideas, and communicate privately within their campus community.

## 🌟 Core Features

### 🔐 Authentication & Security
- **Secure Email Verification**: Exclusive .edu.in email authentication
- **Campus-Based Access**: Students can only interact within their own campus
- **Password Security**: Bcrypt hashing with strong password requirements
- **Session Management**: Secure MongoDB-based session storage
- **Rate Limiting**: Protection against brute force attacks

### 👤 User Management
- **Profile System**: Customizable profiles with avatar upload
- **Campus Assignment**: Automatic campus detection from email domain
- **Settings Management**: Account, password, and profile customization
- **Avatar System**: Secure image upload with file validation

### 📝 Social Features
- **Posts System**: Create, edit, and delete posts with rich content
- **Engagement**: Like and comment on posts
- **Feed System**: Chronological feed with user interactions
- **Content Organization**: Clean, responsive post display

### 💬 Secret Messaging System - ⭐ NEW!
- **Sneaky Chat Requests**: Hover-based secret icons (🔐) on usernames in comments
- **Private Chat Rooms**: Time-limited (24-hour) private messaging rooms
- **Request Management**: Send, receive, accept/reject chat requests
- **Real-time Notifications**: Socket.IO powered instant notifications
- **Room Expiry**: Automatic room cleanup after 24 hours
- **Message Features**: Real-time messaging with reactions and editing support

### 🎨 Design System
- **Colors**: Crimson Red (#B22222) + Off-White (#FAF9F6) + Deep Gray (#2E2E2E)
- **Typography**: Poppins for headings, Open Sans for body text
- **Style**: Modern, clean, student-friendly interface
- **Responsive Design**: Mobile-first approach with CSS Grid and Flexbox
- **Interactive Elements**: Hover effects, modals, and smooth animations

### 🛡️ Admin Features
- **Content Moderation**: Admin panel for managing posts and users
- **User Management**: View, activate, and manage student accounts
- **Analytics Dashboard**: Monitor platform activity and engagement

## 🔧 Technical Architecture

### Backend Stack
- **Node.js + Express**: RESTful API with middleware architecture
- **MongoDB + Mongoose**: NoSQL database with ODM
- **Socket.IO**: Real-time bidirectional communication
- **Multer**: File upload handling for avatars
- **Nodemailer**: Email verification system
- **bcrypt**: Password hashing and security

### Frontend Stack
- **EJS Templates**: Server-side rendering with partials
- **Vanilla JavaScript**: Client-side interactivity and AJAX
- **CSS3**: Modern styling with animations and responsive design
- **Socket.IO Client**: Real-time messaging and notifications

### Key Middleware
- **Authentication**: `requireAuth` middleware for protected routes
- **File Upload**: `upload` middleware for avatar handling
- **Error Handling**: Comprehensive error catching and user feedback
- **Session Management**: Express-session with MongoDB store

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Amrit1604/UConnect-v2.git
   cd UConnect-v2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=4000
   NODE_ENV=development

   # Database
   MONGODB_URI=mongodb://localhost:27017/uconnect

   # Security Keys (Generate strong keys for production)
   JWT_SECRET=your_super_secure_jwt_secret_key_here_minimum_32_characters
   SESSION_SECRET=your_super_secure_session_secret_key_here_minimum_32_characters

   # Email Configuration (for .edu.in verification)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   EMAIL_FROM=noreply@uconnect.edu
   ```

4. **Start MongoDB**
   ```bash
   # On Windows
   net start MongoDB

   # On macOS/Linux
   sudo systemctl start mongod
   ```

5. **Seed the database (optional)**
   ```bash
   node scripts/seedDatabase.js
   ```

6. **Start the application**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

7. **Access the application**
   Open your browser and navigate to `http://localhost:4000`

## 🎯 How to Use UConnect

### 👥 For Students

#### Getting Started
1. **Registration**:
   - Visit the registration page
   - Use your .edu.in email address (e.g., `yourname@iitdelhi.edu.in`)
   - Create a strong password
   - Verify your email address via the verification link

2. **Profile Setup**:
   - Upload a profile avatar
   - Set your display name
   - Configure your profile settings

#### Social Features
3. **Creating Posts**:
   - Navigate to the feed page
   - Click "Create Post"
   - Share thoughts, questions, or announcements
   - Posts are visible to students from your campus only

4. **Engaging with Content**:
   - **Like Posts**: Click the ❤️ button to like posts
   - **Comment**: Add thoughtful comments to posts
   - **View Profiles**: Click on usernames to view profiles

#### Secret Messaging - 🔐
5. **Initiating Secret Chats**:
   - **Hover over usernames** in post comments to reveal the secret 🔐 icon
   - Click the 🔐 icon to send a private chat request
   - Add a personal message explaining why you want to chat
   - Wait for the other student to accept your request

6. **Managing Chat Requests**:
   - Click "Secret Chats" in the navbar to view your requests dashboard
   - **Received Tab**: See incoming chat requests from other students
   - **Sent Tab**: Track your outgoing requests and their status
   - **Active Tab**: Access your active private chat rooms

7. **Private Messaging**:
   - Once a request is accepted, you'll get a private chat room
   - Rooms automatically expire after 24 hours for privacy
   - Real-time messaging with typing indicators
   - Message reactions and editing support (coming soon)

### 🛡️ For Administrators

#### Admin Panel Access
1. **Login with Admin Account**:
   - Use admin credentials to access `/admin`
   - Admin accounts are created via database seeding

2. **User Management**:
   - View all registered students
   - Activate/deactivate accounts
   - Monitor user activity and engagement

3. **Content Moderation**:
   - Review reported posts and comments
   - Remove inappropriate content
   - Monitor secret chat activity (metadata only, not messages)

## 🔧 Technical Deep Dive

### Secret Messaging System Architecture

#### Backend Models
```javascript
// ChatRequest Model
{
  sender: ObjectId,           // User sending the request
  recipient: ObjectId,        // User receiving the request
  message: String,           // Optional message with request
  status: enum,              // pending | accepted | rejected | expired
  roomId: String,            // Unique room identifier when accepted
  roomExpiry: Date,          // 24-hour expiration timestamp
  createdAt: Date
}

// PrivateChat Model
{
  roomId: String,            // Links to ChatRequest roomId
  participants: [ObjectId], // Array of participant user IDs
  messages: [{               // Array of chat messages
    sender: ObjectId,
    content: String,
    timestamp: Date,
    edited: Boolean,
    reactions: Map           // User reactions to messages
  }],
  isActive: Boolean,         // Room status
  expiresAt: Date           // Auto-deletion timestamp
}
```

#### Frontend JavaScript Integration

**Sneaky UI Implementation** (`posts.js`):
```javascript
// Hover detection for secret chat icons
document.addEventListener('mouseenter', (e) => {
  if (e.target.classList.contains('username')) {
    showSecretChatIcon(e.target);
  }
}, true);

// AJAX request sending
function sendChatRequest(recipientId, message) {
  fetch('/chat/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipientId, message })
  });
}
```

**Real-time Notifications** (`main.js`):
```javascript
// Socket.IO integration for instant notifications
const socket = io();

socket.on('newChatRequest', (data) => {
  showNotification(`New secret chat request from ${data.senderName}`);
  updateRequestCounter();
});

socket.on('chatRequestResponse', (data) => {
  if (data.status === 'accepted') {
    showNotification('Chat request accepted! Room is ready.');
  }
});
```

### API Endpoints

#### Authentication Routes (`/auth`)
- `POST /auth/register` - Student registration with .edu.in verification
- `POST /auth/login` - Secure login with session creation
- `GET /auth/verify-email/:token` - Email verification handling
- `POST /auth/logout` - Session destruction and cleanup

#### Posts & Social (`/posts`)
- `GET /posts/feed` - Main social feed with secret chat integration
- `POST /posts/create` - Create new posts with content validation
- `POST /posts/:id/like` - Like/unlike posts with AJAX
- `POST /posts/:id/comment` - Add comments with real-time updates

#### Secret Messaging (`/chat`) - ⭐ Core Feature
- `POST /chat/request` - Send secret chat requests
- `GET /chat/requests` - Dashboard for managing requests
- `POST /chat/request/respond` - Accept/reject incoming requests
- `GET /chat/room/:roomId` - Access private chat rooms
- `POST /chat/room/:roomId/message` - Send messages in private rooms

#### User Management (`/users`)
- `GET /users/profile/:id` - View user profiles
- `POST /users/avatar` - Upload profile pictures
- `GET /settings/*` - Various settings management pages

### Security Implementation

#### Campus-Based Access Control
```javascript
// Middleware ensures same-campus interactions
const requireSameCampus = (req, res, next) => {
  const userCampus = req.user.email.split('@')[1];
  const targetCampus = targetUser.email.split('@')[1];

  if (userCampus !== targetCampus) {
    return res.status(403).json({ error: 'Cross-campus interaction not allowed' });
  }
  next();
};
```

#### File Upload Security
```javascript
// Multer configuration with validation
const upload = multer({
  dest: 'public/uploads/avatars/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});
```

## 🧪 Testing & Development

### Sample Accounts (After seeding)

**Admin Account**:
- Email: `admin@iitdelhi.edu.in`
- Password: `AdminPass123!`
- Access: Full admin panel and moderation tools

**Student Accounts**:
- Email: `priya.sharma@iitdelhi.edu.in`
- Password: `StudentPass123!`
- Campus: IIT Delhi

**Testing Secret Messaging**:
1. Create two student accounts from the same campus
2. Have one student comment on a post
3. Hover over their username to reveal the 🔐 icon
4. Send a secret chat request
5. Login as the other student and check `/chat/requests`
6. Accept the request and start chatting!

### Development Tools
```bash
# Database seeding
node scripts/seedDatabase.js

# Avatar debugging
node debug-avatar.js

# Avatar fixes
node fix-avatar.js
```

## 🚀 Deployment

### Production Environment Setup
```env
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/uconnect
JWT_SECRET=your_production_jwt_secret_64_characters_minimum
SESSION_SECRET=your_production_session_secret_64_characters_minimum
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your_production_email@gmail.com
EMAIL_PASS=your_production_app_password
EMAIL_FROM=noreply@uconnect.edu
```

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Use strong, unique secrets (64+ characters)
- [ ] Configure HTTPS/SSL certificates
- [ ] Set up MongoDB Atlas or production database
- [ ] Configure production email service (SendGrid/AWS SES)
- [ ] Set up monitoring and logging (PM2, Winston)
- [ ] Configure reverse proxy (nginx/Apache)
- [ ] Set up SSL/TLS termination
- [ ] Configure CORS for production domains
- [ ] Set up backup strategies for database
- [ ] Configure rate limiting for production traffic

## 🛣️ Future Roadmap

### Phase 2: Enhanced Engagement ⏳
- [ ] **Post Categories**: Fun, Academics, Events, Placements, Clubs
- [ ] **Polls System**: Interactive polling in posts
- [ ] **Trending Feed**: Algorithm-based popular content
- [ ] **Push Notifications**: Browser notifications for interactions
- [ ] **Anonymous Posting**: Option for anonymous posts

### Phase 3: Campus Ecosystem 🎯
- [ ] **Events System**: Campus events with RSVP functionality
- [ ] **Official Announcements**: Verified admin announcements
- [ ] **Reputation System**: User karma and badges
- [ ] **Progressive Web App**: Offline functionality and app-like experience
- [ ] **Mobile App**: React Native mobile application

### Phase 4: Advanced Features 🚀
- [ ] **Search & Hashtags**: Advanced content discovery
- [ ] **Club Pages**: Official club representation
- [ ] **Voice Messages**: Audio posts and chat messages
- [ ] **Advanced Analytics**: User engagement insights
- [ ] **AI Content Moderation**: Automated inappropriate content detection

### Secret Messaging Enhancements 💬
- [ ] **Message Reactions**: Emoji reactions to messages
- [ ] **Message Editing**: Edit sent messages with history
- [ ] **Message Deletion**: Delete messages with notifications
- [ ] **Typing Indicators**: Real-time typing status
- [ ] **File Sharing**: Share documents and images in chat
- [ ] **Voice Messages**: Audio messages in private chats
- [ ] **Message Encryption**: End-to-end encryption for privacy
- [ ] **Group Chats**: Multi-user secret chat rooms

## 🔒 Security Features & Best Practices

### Authentication Security
- **bcrypt Password Hashing**: Industry-standard password protection
- **Session Management**: Secure MongoDB session storage
- **Email Verification**: Mandatory .edu.in email verification
- **Rate Limiting**: Protection against brute force attacks
- **CSRF Protection**: Built-in cross-site request forgery protection

### Data Protection
- **Input Validation**: Comprehensive validation using Joi/express-validator
- **XSS Protection**: Content Security Policy headers
- **SQL Injection Prevention**: MongoDB ODM prevents injection attacks
- **File Upload Security**: Strict file type and size validation
- **Campus Isolation**: Users can only interact within their campus

### Privacy Features
- **Time-Limited Chat Rooms**: Automatic 24-hour expiry for privacy
- **Request-Based Messaging**: No unsolicited messages
- **Secure File Storage**: Uploaded files stored with secure naming
- **Session Security**: Automatic session expiry and secure cookies

## 📊 Technical Performance

### Backend Performance
- **Async/Await**: Non-blocking I/O operations
- **Database Indexing**: Optimized MongoDB queries
- **Caching Strategy**: Session and static asset caching
- **Error Handling**: Comprehensive error catching and logging

### Frontend Optimization
- **Responsive Design**: Mobile-first CSS approach
- **Lazy Loading**: Efficient resource loading
- **AJAX Operations**: Seamless user interactions
- **Real-time Updates**: Socket.IO for instant communication

### Scalability Considerations
- **Modular Architecture**: Separation of concerns
- **Database Schema**: Optimized for read/write operations
- **Middleware Pattern**: Reusable request processing
- **Static Asset Serving**: Efficient file delivery

## 🤝 Contributing

We welcome contributions from the student developer community! Here's how you can help:

### Development Guidelines
1. **Fork the repository** and create a feature branch
2. **Follow the existing code style** and conventions
3. **Write meaningful commit messages** (use conventional commits)
4. **Add tests** for new features
5. **Update documentation** as needed
6. **Test thoroughly** before submitting

### Code Style
- **JavaScript**: ES6+ features, async/await for promises
- **CSS**: Mobile-first responsive design
- **EJS Templates**: Semantic HTML with proper accessibility
- **MongoDB**: Proper schema design with validation

### Pull Request Process
1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'feat: add amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request with detailed description

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Troubleshooting

### Common Issues

**"Cannot connect to MongoDB"**
- Ensure MongoDB is running: `net start MongoDB` (Windows)
- Check connection string in `.env` file
- Verify MongoDB is installed and configured

**"Email verification not working"**
- Check email service configuration in `.env`
- Verify Gmail app password if using Gmail
- Check spam/junk folder for verification emails

**"Secret chat icons not appearing"**
- Ensure JavaScript is enabled in browser
- Check browser console for errors
- Verify users are from the same campus

**"File upload failures"**
- Check file size (must be under 5MB)
- Verify file type (only images allowed)
- Ensure `uploads/avatars/` directory exists

### Getting Help

1. **Check the [Issues](../../issues)** page for known problems
2. **Search existing issues** before creating a new one
3. **Create a detailed issue** with:
   - Steps to reproduce the problem
   - Expected vs actual behavior
   - Browser and OS information
   - Console error messages (if any)

### Contact Information
- **Project Maintainer**: [Amrit1604](https://github.com/Amrit1604)
- **Repository**: [UConnect-v2](https://github.com/Amrit1604/UConnect-v2)
- **Issues**: [Report a Bug](../../issues/new)

## 🙏 Acknowledgments

### Technology Stack
- **Backend**: Node.js, Express.js, MongoDB, Mongoose
- **Frontend**: EJS templates, Vanilla JavaScript, CSS3
- **Real-time**: Socket.IO for live messaging
- **Authentication**: bcrypt, express-session
- **File Upload**: Multer middleware
- **Email**: Nodemailer with SMTP

### Inspiration & Resources
- **UI/UX**: Inspired by modern social media platforms with student-focused design
- **Security**: Following OWASP security guidelines and best practices
- **Community**: Built based on feedback from Indian university students
- **Privacy**: Designed with student privacy and safety as core principles

### Special Thanks
- Indian university students who provided feedback and testing
- Open source community for excellent tools and libraries
- Campus administrators who supported the development
- Beta testers who helped identify and fix bugs

---

**🎓 UConnect** - Connecting students, fostering community, building the future.
*A secure, campus-exclusive social platform with secret messaging capabilities.*

**Made with ❤️ for Indian University Students**

---

### Quick Links
- 🚀 [Live Demo](https://uconnect-v2.onrender.com) (Coming Soon)
- 📚 [Documentation](../../wiki) (Coming Soon)
- 🐛 [Report Issues](../../issues)
- 💡 [Feature Requests](../../issues/new?template=feature_request.md)
- 📧 [Contact Developer](mailto:amrit.student@email.com)

### Project Stats
- **Languages**: JavaScript, HTML, CSS, EJS
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.IO WebSocket communication
- **Security**: Campus-restricted, encrypted sessions
- **Mobile**: Responsive design for all devices

---

*Last Updated: September 2025*
