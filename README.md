# 🎓 UConnect

A secure, student-focused social media platform designed exclusively for Indian university students with .edu.in email addresses.

## 🌟 Features

### Phase 1 (MVP) - ✅ Implemented
- **🔐 Secure Authentication**: .edu.in email verification only
- **👤 User Profiles**: Display names, avatars, and basic information
- **📝 Posts System**: Create, like, and comment on posts
- **🛡️ Content Moderation**: Report system and admin controls
- **📱 Responsive Design**: Mobile-first approach with modern UI

### 🎨 Design System
- **Colors**: Crimson Red (#B22222) + Off-White (#FAF9F6) + Deep Gray (#2E2E2E)
- **Typography**: Poppins for headings, Open Sans for body text
- **Style**: Modern, clean, student-friendly interface

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd campus-connect
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Database
   MONGODB_URI=mongodb://localhost:27017/campus_connect

   # Security Keys (Generate strong keys for production)
   JWT_SECRET=your_super_secure_jwt_secret_key_here_minimum_32_characters
   SESSION_SECRET=your_super_secure_session_secret_key_here_minimum_32_characters

   # Email Configuration (for .edu.in verification)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   EMAIL_FROM=noreply@campusconnect.edu
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
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

7. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## 🔧 Configuration

### Email Setup
For email verification to work, you need to configure SMTP settings:

1. **Gmail Setup** (Recommended for development):
   - Enable 2-factor authentication
   - Generate an App Password
   - Use the App Password in `EMAIL_PASS`

2. **Other SMTP Providers**:
   - Update `EMAIL_HOST` and `EMAIL_PORT`
   - Provide appropriate credentials

### Security Configuration
- Generate strong secrets for `JWT_SECRET` and `SESSION_SECRET`
- Use environment variables for all sensitive data
- Enable HTTPS in production

## 📁 Project Structure

```
campus-connect/
├── app.js                 # Main application file
├── package.json          # Dependencies and scripts
├── .env.example          # Environment variables template
├── models/               # Database models
│   ├── User.js          # User model with authentication
│   └── Post.js          # Post model with interactions
├── routes/               # Express routes
│   ├── auth.js          # Authentication routes
│   ├── posts.js         # Posts CRUD operations
│   ├── users.js         # User management
│   └── admin.js         # Admin panel routes
├── middleware/           # Custom middleware
│   ├── auth.js          # Authentication middleware
│   └── errorHandler.js  # Error handling
├── views/                # EJS templates
│   ├── layout.ejs       # Main layout template
│   ├── index.ejs        # Landing page
│   ├── auth/            # Authentication pages
│   ├── posts/           # Posts-related pages
│   └── users/           # User profile pages
├── public/               # Static assets
│   ├── css/             # Stylesheets
│   ├── js/              # Client-side JavaScript
│   └── images/          # Static images
└── scripts/              # Utility scripts
    └── seedDatabase.js  # Database seeding
```

## 🎯 Usage

### For Students

1. **Registration**:
   - Use your .edu.in email address
   - Create a strong password
   - Verify your email address

2. **Creating Posts**:
   - Share thoughts, questions, or announcements
   - Use the rich text editor
   - Add images (coming in Phase 2)

3. **Engaging with Content**:
   - Like posts from fellow students
   - Comment on interesting discussions
   - Report inappropriate content

### For Administrators

1. **Access Admin Panel**:
   - Login with admin credentials
   - Navigate to `/admin`

2. **User Management**:
   - View all registered users
   - Activate/deactivate accounts
   - Manually verify users

3. **Content Moderation**:
   - Review reported posts
   - Remove inappropriate content
   - Monitor platform activity

## 🔒 Security Features

- **Email Verification**: Only .edu.in addresses accepted
- **Password Security**: Strong password requirements with hashing
- **Session Management**: Secure session handling with MongoDB store
- **Rate Limiting**: Protection against brute force attacks
- **Input Validation**: Comprehensive validation and sanitization
- **CSRF Protection**: Built-in CSRF protection
- **Content Security Policy**: XSS protection headers

## 🧪 Testing

### Sample Accounts (After seeding)

**Admin Account**:
- Email: `admin@iitdelhi.edu.in`
- Password: `AdminPass123!`

**Student Account**:
- Email: `priya.sharma@iitdelhi.edu.in`
- Password: `StudentPass123!`

### Running Tests
```bash
npm test
```

## 🚀 Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Use strong, unique secrets
- [ ] Configure HTTPS
- [ ] Set up MongoDB Atlas or production database
- [ ] Configure email service
- [ ] Set up monitoring and logging
- [ ] Configure reverse proxy (nginx)

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/campus_connect
JWT_SECRET=your_production_jwt_secret
SESSION_SECRET=your_production_session_secret
EMAIL_HOST=your_smtp_host
EMAIL_USER=your_email_user
EMAIL_PASS=your_email_password
```

## 🛣️ Roadmap

### Phase 2: Engagement Boost
- [ ] Post categories (Fun, Academics, Events, Placements, Clubs)
- [ ] Polls system
- [ ] Trending/Popular feed
- [ ] Push notifications
- [ ] Anonymous posting option

### Phase 3: Campus Ecosystem
- [ ] Events system with RSVP
- [ ] Official announcements
- [ ] Reputation and badges system
- [ ] Progressive Web App (PWA)

### Phase 4: Advanced Features
- [ ] Search and hashtags
- [ ] Club pages
- [ ] Anonymous confessions mode
- [ ] Voice notes/audio posts
- [ ] Advanced analytics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow the existing code style
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](../../issues) page
2. Create a new issue with detailed information
3. Contact the development team

## 🙏 Acknowledgments

- Built with Node.js, Express, and MongoDB
- UI inspired by modern social media platforms
- Security best practices from OWASP guidelines
- Community feedback from Indian university students

---

**UConnect** - Connecting students, fostering community, building the future. 🎓✨