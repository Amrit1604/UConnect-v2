# 🎓 UConnect v2

A modern, real-time social media platform exclusively for Indian university students with .edu.in email verification. Built with Node.js, Express, MongoDB, and Socket.IO for seamless real-time interactions.

## 🌟 Features

### ✅ Core Features Implemented
- **🔐 Secure Authentication**: .edu.in email verification with session management
- **👤 Advanced User Profiles**: Custom avatars, bio, privacy settings, campus affiliation
- **📝 Rich Posts System**: Create, like, comment, and interact with posts in real-time
- **️ Content Moderation**: Report system, admin controls, and user management
- **📱 Responsive Design**: Mobile-first modern UI with professional styling
- **🔔 Flash Notifications**: Success/error messaging throughout the app
- **📊 Admin Dashboard**: User management, content moderation, and analytics

### 🎨 Design System
- **Colors**: Crimson Red (#B22222) + Off-White (#FAF9F6) + Deep Gray (#2E2E2E)
- **Typography**: Inter font family for modern, clean appearance
- **Style**: Professional, student-friendly interface with smooth animations

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd BackendPro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```

   Configure your `.env` file with these variables:
   ```env
   # Server Configuration
   PORT=4000
   NODE_ENV=development

   # Database Configuration
   MONGODB_URI=mongodb://localhost:27017/campus_connect

   # Security Keys (Generate strong keys for production)
   JWT_SECRET=your_super_secure_jwt_secret_key_here_minimum_32_characters
   SESSION_SECRET=your_super_secure_session_secret_key_here_minimum_32_characters

   # Email Configuration (for .edu.in verification)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   EMAIL_FROM=your_email@gmail.com
   EMAIL_FROM_NAME=UConnect Campus

   # Rate Limiting (optional - currently disabled)
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
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
   npm run seed
   ```

6. **Start the application**
   ```bash
   # Development mode (with auto-restart)
   npm run dev

   # Production mode
   npm start
   ```

7. **Access the application**
   Open your browser and navigate to `http://localhost:4000`

## 🔧 Configuration

### Email Setup
For email verification to work properly:

1. **Gmail Setup** (Recommended):
   - Enable 2-factor authentication on your Gmail account
   - Generate an App Password: https://support.google.com/accounts/answer/185833
   - Use your Gmail address for `EMAIL_USER`
   - Use the App Password for `EMAIL_PASS`

2. **Other SMTP Providers**:
   - Update `EMAIL_HOST` and `EMAIL_PORT` accordingly
   - Set `EMAIL_SECURE=true` for SSL connections

### Security Configuration
- Generate strong, unique secrets for `JWT_SECRET` and `SESSION_SECRET`
- Use environment variables for all sensitive data
- Enable HTTPS in production with proper SSL certificates

## 📁 Project Structure

```
BackendPro/
├── app.js                    # Main application entry point
├── package.json             # Dependencies and scripts
├── .env.example             # Environment variables template
├── config/                  # Configuration modules
│   ├── database.js         # MongoDB connection setup
│   ├── session.js          # Session configuration
│   ├── cors.js             # CORS settings
│   └── helmet.js           # Security headers
├── models/                  # Database models
│   ├── User.js             # User model with authentication
│   ├── Post.js             # Post model with interactions
├── routes/                  # Express route handlers
│   ├── auth.js             # Authentication routes
│   ├── posts.js            # Posts CRUD operations
│   ├── users.js            # User profile management
│   ├── admin.js            # Admin panel routes
│   └── settings.js         # User settings routes
├── middleware/              # Custom middleware
│   ├── auth.js             # Authentication middleware
│   ├── errorHandler.js     # Error handling
│   ├── upload.js           # File upload handling
│   └── uploadImages.js     # Image processing
├── services/                # Business logic services
│   └── emailService.js     # Email sending service
├── startup/                 # Application startup
│   └── server.js           # HTTP server & Socket.IO setup
├── utils/                   # Utility functions
│   └── smartUrl.js         # URL detection utilities
├── views/                   # EJS templates
│   ├── layout.ejs          # Main layout template
│   ├── index.ejs           # Landing page
│   ├── error.ejs           # Error pages
│   ├── auth/               # Authentication pages
│   │   ├── login.ejs
│   │   ├── register.ejs
│   │   └── verify-email.ejs
│   ├── posts/              # Posts-related pages
│   │   ├── feed.ejs
│   │   ├── create.ejs
│   │   ├── single.ejs
│   │   └── categories.ejs
│   ├── users/              # User profile pages
│   │   ├── profile.ejs
│   │   └── settings/
│   │       ├── profile.ejs
│   │       ├── account.ejs
│   │       └── password.ejs
│   ├── admin/              # Admin pages
│   └── partials/           # Reusable components
│       ├── navbar.ejs
│       ├── flash-messages.ejs
│       ├── footer.ejs
│       └── default-body.ejs
├── public/                  # Static assets
│   ├── css/                # Stylesheets
│   ├── js/                 # Client-side JavaScript
│   ├── images/             # Static images
│   ├── uploads/            # User uploaded files
│   │   ├── avatars/
│   │   └── posts/
│   └── videos/             # Video assets
└── scripts/                 # Utility scripts
    └── seedDatabase.js     # Database seeding
```

## 🎯 Usage

### For Students

1. **Registration & Verification**:
   - Use your .edu.in email address
   - Complete email verification process
   - Set up your profile with avatar and bio

2. **Creating & Interacting with Posts**:
   - Share thoughts, questions, or announcements
   - Like and comment on posts in real-time
   - Use rich text formatting

3. **Profile Management**:
   - Customize your avatar (upload or generate)
   - Manage privacy settings
   - Update personal information

### For Administrators

1. **Access Admin Panel** (`/admin`):
   - Login with admin credentials
   - Monitor platform activity

2. **User Management**:
   - View all registered users
   - Activate/deactivate accounts
   - Manually verify users if needed

3. **Content Moderation**:
   - Review reported posts
   - Remove inappropriate content
   - Monitor real-time activity

## 🔒 Security Features

- **Email Domain Verification**: Only .edu.in addresses accepted
- **Password Security**: Strong password requirements with bcrypt hashing
- **Session Management**: Secure session handling with MongoDB store
- **Rate Limiting**: Configurable protection against abuse (currently disabled)
- **Input Validation**: Comprehensive validation using express-validator
- **File Upload Security**: Image processing and size limits
- **Content Security Policy**: XSS protection via Helmet
- **Data Sanitization**: HTML sanitization for user content

## 🧪 Testing & Development

### Available Scripts
```bash
npm start          # Start production server
npm run dev        # Start development server (with nodemon)
npm run seed       # Seed database with sample data
npm test           # Run tests with coverage
npm run lint       # Run ESLint for code quality
```

### Sample Accounts (After Seeding)
**Admin Account**:
- Email: `admin@iitdelhi.edu.in`
- Password: `AdminPass123!`

**Student Accounts**:
- Email: `student1@iitdelhi.edu.in`
- Password: `StudentPass123!`
- Email: `student2@iitdelhi.edu.in`
- Password: `StudentPass123!`

## 🚀 Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Use strong, unique secrets for JWT and session
- [ ] Configure HTTPS with SSL certificates
- [ ] Set up MongoDB Atlas or production database
- [ ] Configure production email service
- [ ] Set up monitoring and logging
- [ ] Configure reverse proxy (nginx/Apache)
- [ ] Enable rate limiting
- [ ] Set up backup strategies

### Environment Variables for Production
```env
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/campus_connect
JWT_SECRET=your_production_jwt_secret_minimum_32_chars
SESSION_SECRET=your_production_session_secret_minimum_32_chars
EMAIL_HOST=your_smtp_host
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_production_email
EMAIL_PASS=your_production_email_password
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=UConnect Campus
```

## 🛣️ Roadmap

### Phase 2: Enhanced Engagement (In Progress)
- [x] Advanced user profiles
- [ ] Post categories and filtering
- [ ] Push notifications
- [ ] Mobile app (React Native)

### Phase 3: Campus Ecosystem
- [ ] Events system with RSVP
- [ ] Official announcements from universities
- [ ] Club and organization pages
- [ ] Study group formation
- [ ] Resource sharing

### Phase 4: Advanced Features
- [ ] Search and hashtags
- [ ] Voice notes and audio posts
- [ ] Anonymous posting mode
- [ ] Advanced analytics dashboard
- [ ] API for third-party integrations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style and modular structure
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Use the established config/middleware pattern

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](../../issues) page on GitHub
2. Create a new issue with detailed information
3. Include error logs and steps to reproduce
4. Contact the development team

## 🙏 Acknowledgments

- Built with Node.js, Express.js, MongoDB, and Socket.IO
- Real-time features powered by Socket.IO
- Security best practices from OWASP guidelines
- UI design inspired by modern social platforms
- Community feedback from Indian university students

---

**UConnect v2** - Connecting students, fostering community, building the future. 🎓⚡"# UConnect-v2"