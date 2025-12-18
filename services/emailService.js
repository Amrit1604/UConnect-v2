/**
 * Email Service - UConnect
 * Handles all email functionality with Gmail SMTP
 * Optimized for cloud deployment (Render, Vercel, etc.) 🚀⚡
 */

const nodemailer = require('nodemailer');
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.initializeTransporter();
  }

  /**
   * Initialize Gmail SMTP transporter with cloud-optimized settings
   */
  initializeTransporter() {
    try {
      console.log('🔧 Initializing Email Service...');
      console.log('📧 Email User:', process.env.EMAIL_USER ? process.env.EMAIL_USER.substring(0, 5) + '***' : 'MISSING');
      console.log('🔑 Email Pass:', process.env.EMAIL_PASS ? '****' + process.env.EMAIL_PASS.slice(-4) : 'MISSING');
      console.log('🌐 Environment:', process.env.NODE_ENV || 'development');

      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ Email credentials missing in environment variables');
        this.isConfigured = false;
        return;
      }

      // Cloud-optimized Gmail SMTP configuration
      // Works with Render, Vercel, Railway, Heroku, etc.
      this.transporter = nodemailer.createTransport({
        service: 'gmail', // Use 'gmail' service for automatic config
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // Use SSL (more reliable on cloud platforms)
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS // Must be Gmail App Password (16 chars)
        },
        // Cloud-specific settings for reliability
        pool: true, // Use pooled connections
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 5, // Max 5 emails per second
        // TLS settings for cloud environments
        tls: {
          rejectUnauthorized: true, // Verify SSL certificates
          minVersion: 'TLSv1.2'
        },
        // Timeout settings (important for cloud)
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,
        socketTimeout: 30000, // 30 seconds for sending
        // Debug in development
        debug: process.env.NODE_ENV === 'development',
        logger: process.env.NODE_ENV === 'development'
      });

      console.log('📧 SMTP Transporter created with cloud-optimized settings');

      // Skip verification in test mode
      if (process.env.NODE_ENV !== 'test' && process.env.SKIP_EMAIL_VERIFY !== 'true') {
        this.verifyConnectionAsync();
      } else {
        console.log('ℹ️ Skipping SMTP verification in test mode');
        this.isConfigured = true;
      }

    } catch (error) {
      console.error('❌ Email Service initialization failed:', error.message);
      this.isConfigured = false;
    }
  }

  /**
   * Async connection verification (non-blocking)
   */
  verifyConnectionAsync() {
    this.isConfigured = true; // Optimistically set to true
    console.log('✅ Email Service: Configuration accepted, verifying in background...');

    // Verify in background without blocking app startup
    setTimeout(() => {
      this.verifyConnection().catch(error => {
        console.error('⚠️ Background SMTP verification issue:', error.message);
        console.log('📧 Email sending will retry on first actual send attempt');
      });
    }, 2000); // Delay verification to not block startup
  }

  /**
   * Verify email service connection with retry logic
   */
  async verifyConnection() {
    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ Email credentials missing');
        this.isConfigured = false;
        return false;
      }

      await this.transporter.verify();
      console.log('✅ Email Service: SMTP connection verified! 🚀');
      this.isConfigured = true;
      this.retryCount = 0;
      return true;
    } catch (error) {
      console.error('❌ SMTP verification failed:', error.message);
      
      // Provide helpful error messages
      if (error.code === 'EAUTH' || error.responseCode === 535) {
        console.error('');
        console.error('🔐 AUTHENTICATION ERROR - Common fixes:');
        console.error('1. Make sure you are using a Gmail APP PASSWORD (not your regular password)');
        console.error('2. App Password is exactly 16 characters (no spaces): xxxx xxxx xxxx xxxx');
        console.error('3. Enable 2-Step Verification first: https://myaccount.google.com/security');
        console.error('4. Generate App Password: https://myaccount.google.com/apppasswords');
        console.error('5. On Render: Set EMAIL_USER and EMAIL_PASS in Environment Variables');
        console.error('');
      } else if (error.code === 'ESOCKET' || error.code === 'ECONNECTION') {
        console.error('');
        console.error('🌐 CONNECTION ERROR - The server cannot reach Gmail SMTP');
        console.error('This is normal during startup. Emails will work when actually sent.');
        console.error('');
      }
      
      this.isConfigured = false;
      return false;
    }
  }

  /**
   * Recreate transporter (for retry logic)
   */
  recreateTransporter() {
    console.log('🔄 Recreating SMTP transporter...');
    this.initializeTransporter();
  }

  /**
   * Send email verification with retry logic for cloud environments
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} options.username - User's username
   * @param {string} options.displayName - User's display name
   * @param {string} options.verificationUrl - Verification URL
   */
  async sendVerificationEmail({ to, username, name, verificationUrl }) {
    console.log('📧 Attempting to send verification email...');
    console.log('🎯 Recipient:', to);
    console.log('🔧 Service configured:', this.isConfigured);
    console.log('🌐 Environment:', process.env.NODE_ENV || 'development');

    // Retry logic for cloud environments
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // If not configured or transporter is null, try to reinitialize
        if (!this.isConfigured || !this.transporter) {
          console.log(`🔄 Attempt ${attempt}: Reinitializing email transporter...`);
          this.recreateTransporter();
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
        }

        const htmlContent = this.generateVerificationEmailHTML({
          username,
          name,
          verificationUrl,
          to
        });

        const textContent = this.generateVerificationEmailText({
          username,
          name,
          verificationUrl
        });

        const mailOptions = {
          from: {
            name: process.env.EMAIL_FROM_NAME || 'UConnect Campus',
            address: process.env.EMAIL_FROM || process.env.EMAIL_USER
          },
          to: to,
          subject: '🎓 Verify Your UConnect Account - Welcome to Campus!',
          text: textContent,
          html: htmlContent,
          headers: {
            'X-Priority': '1',
            'X-MSMail-Priority': 'High',
            'Importance': 'high'
          }
        };

        console.log(`📤 Attempt ${attempt}: Sending email via Gmail SMTP...`);
        const info = await this.transporter.sendMail(mailOptions);
        
        console.log(`✅ Verification email sent successfully to ${to}! 🎉`);
        console.log(`📧 Message ID: ${info.messageId}`);
        
        this.isConfigured = true; // Mark as working
        this.retryCount = 0;
        
        return {
          success: true,
          messageId: info.messageId,
          response: info.response
        };

      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt}/${this.maxRetries} failed:`, error.message);
        
        // Check if error is recoverable
        if (error.code === 'EAUTH' || error.responseCode === 535) {
          // Auth errors are not recoverable by retry
          console.error('🔐 Authentication error - check your Gmail App Password');
          break;
        }
        
        if (attempt < this.maxRetries) {
          const waitTime = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
          console.log(`⏳ Waiting ${waitTime/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          // Recreate transporter for next attempt
          this.recreateTransporter();
        }
      }
    }

    // All retries failed
    console.error(`❌ All ${this.maxRetries} attempts failed to send email to ${to}`);
    console.error('🔧 Last error:', lastError?.message);
    
    // Provide specific error messages
    if (lastError?.code === 'EAUTH' || lastError?.responseCode === 535) {
      throw new Error('Gmail authentication failed. Please verify your App Password is correct. Go to https://myaccount.google.com/apppasswords to generate a new one.');
    } else if (lastError?.code === 'ECONNECTION' || lastError?.code === 'ESOCKET') {
      throw new Error('Cannot connect to Gmail SMTP server. This may be a temporary network issue. Please try again.');
    } else if (lastError?.code === 'ETIMEDOUT') {
      throw new Error('Connection to Gmail timed out. Please try again in a moment.');
    } else {
      throw new Error(`Email sending failed after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate HTML email template for verification
   */
  generateVerificationEmailHTML({ username, name, verificationUrl, to }) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your UConnect Account</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f8f9fa;
            }

            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            }

            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 40px 30px;
                text-align: center;
            }

            .header h1 {
                font-size: 28px;
                margin-bottom: 10px;
                font-weight: 700;
            }

            .header .subtitle {
                font-size: 16px;
                opacity: 0.9;
            }

            .content {
                padding: 40px 30px;
            }

            .welcome {
                font-size: 18px;
                margin-bottom: 20px;
                color: #2c3e50;
            }

            .message {
                font-size: 16px;
                margin-bottom: 30px;
                color: #555;
                line-height: 1.7;
            }

            .verify-button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-decoration: none;
                padding: 16px 32px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 16px;
                margin: 20px 0;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            }

            .verify-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
            }

            .alternative-link {
                background-color: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 6px;
                padding: 15px;
                margin: 25px 0;
                word-break: break-all;
                font-size: 14px;
                color: #6c757d;
            }

            .security-notice {
                background-color: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 15px;
                margin: 25px 0;
                border-radius: 4px;
            }

            .security-notice strong {
                color: #856404;
            }

            .footer {
                background-color: #f8f9fa;
                padding: 30px;
                text-align: center;
                border-top: 1px solid #e9ecef;
            }

            .footer p {
                color: #6c757d;
                font-size: 14px;
                margin: 5px 0;
            }

            .social-links {
                margin: 20px 0;
            }

            .social-links a {
                display: inline-block;
                margin: 0 10px;
                color: #667eea;
                text-decoration: none;
                font-weight: 500;
            }

            @media (max-width: 600px) {
                .container {
                    margin: 0;
                    border-radius: 0;
                }

                .header, .content, .footer {
                    padding: 25px 20px;
                }

                .verify-button {
                    display: block;
                    text-align: center;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎓 UConnect</h1>
                <p class="subtitle">Your Campus Community Platform</p>
            </div>

            <div class="content">
                <div class="welcome">
                    Welcome to UConnect, ${name}! 👋
                </div>

                <div class="message">
                    Thanks for joining our campus community! We're excited to have you connect with fellow students
                    from your university. To complete your registration and start exploring, please verify your email address.
                </div>

                <div style="text-align: center;">
                    <a href="${verificationUrl}" class="verify-button">
                        ✅ Verify My Email Address
                    </a>
                </div>

                <div class="message">
                    This verification link will expire in <strong>24 hours</strong> for security reasons.
                </div>

                <div class="security-notice">
                    <strong>🔒 Security Notice:</strong> If you didn't create an account with UConnect,
                    please ignore this email. Your email address will not be used without verification.
                </div>

                <div class="alternative-link">
                    <strong>Having trouble with the button?</strong> Copy and paste this link into your browser:
                    <br><br>
                    ${verificationUrl}
                </div>
            </div>

            <div class="footer">
                <p><strong>UConnect Campus Community</strong></p>
                <p>Connecting students, building communities</p>
                <div class="social-links">
                    <a href="#">About</a> •
                    <a href="#">Privacy</a> •
                    <a href="#">Support</a>
                </div>
                <p style="margin-top: 20px; font-size: 12px;">
                    This email was sent to ${to} because you signed up for UConnect.<br>
                    If you have any questions, please contact our support team.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate text email template for verification (fallback)
   */
  generateVerificationEmailText({ username, name, verificationUrl }) {
    return `
🎓 Welcome to UConnect, ${name}!

Thanks for joining our campus community! We're excited to have you connect with fellow students from your university.

To complete your registration and start exploring, please verify your email address by clicking the link below:

${verificationUrl}

This verification link will expire in 24 hours for security reasons.

🔒 Security Notice: If you didn't create an account with UConnect, please ignore this email. Your email address will not be used without verification.

---
UConnect Campus Community
Connecting students, building communities

If you have any questions, please contact our support team.
    `.trim();
  }

  /**
   * Send password reset email with retry logic
   */
  async sendResetPasswordEmail({ to, username, name, resetUrl }) {
    console.log('📧 Sending password reset email to:', to);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
          </div>
          <div class="content">
            <p>Hello ${name || username},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset My Password</a>
            </p>
            <p>This link will expire in <strong>1 hour</strong> for security reasons.</p>
            <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
            <p style="margin-top: 30px; padding: 15px; background: #fff3cd; border-radius: 5px; font-size: 14px;">
              <strong>⚠️ Security Tip:</strong> Never share this link with anyone. UConnect staff will never ask for your password.
            </p>
          </div>
          <div class="footer">
            <p>UConnect Campus Community</p>
            <p>This email was sent to ${to}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Password Reset Request

Hello ${name || username},

We received a request to reset your password. Visit the link below to create a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.

- UConnect Team
    `.trim();

    // Retry logic for cloud environments
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        if (!this.isConfigured || !this.transporter) {
          console.log(`🔄 Attempt ${attempt}: Reinitializing email transporter...`);
          this.recreateTransporter();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`📤 Attempt ${attempt}: Sending password reset email...`);
        const info = await this.transporter.sendMail({
          from: {
            name: process.env.EMAIL_FROM_NAME || 'UConnect Campus',
            address: process.env.EMAIL_FROM || process.env.EMAIL_USER
          },
          to,
          subject: "🔐 Reset Your UConnect Password",
          text,
          html
        });

        console.log(`✅ Password reset email sent to ${to}!`);
        return { success: true, messageId: info.messageId };

      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt}/${this.maxRetries} failed:`, error.message);
        
        if (error.code === 'EAUTH') break; // Don't retry auth errors
        
        if (attempt < this.maxRetries) {
          const waitTime = attempt * 2000;
          console.log(`⏳ Waiting ${waitTime/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          this.recreateTransporter();
        }
      }
    }

    throw new Error(`Password reset email failed: ${lastError?.message || 'Unknown error'}`);
  }


  /**
   * Send welcome email after successful verification
   */
  async sendWelcomeEmail({ to, username, name }) {
    // Implementation for welcome emails
    // This is for future enhancement
    console.log('Welcome email functionality - Coming soon!');
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;
