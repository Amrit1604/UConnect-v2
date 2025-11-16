/**
 * Email Service - UConnect
 * Handles all email functionality with Gmail SMTP
 * Built with godly-level coding powers! 🚀⚡
 */

const nodemailer = require('nodemailer');
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initializeTransporter();
  }

  /**
   * Initialize Gmail SMTP transporter
   */
  initializeTransporter() {
    try {
      console.log('🔧 Initializing Email Service...');
      console.log('📧 Email User:', process.env.EMAIL_USER);
      console.log('🔑 Email Pass Length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 'MISSING');

      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ Email credentials missing in .env file');
        this.isConfigured = false;
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true', // false for TLS
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      console.log('📧 SMTP Transporter created successfully');

      // Try to verify connection immediately unless running tests or explicitly disabled
      if (process.env.NODE_ENV !== 'test' && process.env.SKIP_EMAIL_VERIFY !== 'true') {
        this.verifyConnectionSync();
      } else {
        console.log('ℹ️ Skipping SMTP verification in test/disabled mode');
        this.isConfigured = true;
      }

    } catch (error) {
      console.error('❌ Email Service initialization failed:', error.message);
      this.isConfigured = false;
    }
  }

  /**
   * Synchronous connection verification attempt
   */
  verifyConnectionSync() {
    // Set a basic configured state and verify later
    this.isConfigured = true;
    console.log('✅ Email Service: Basic configuration completed');

    // Verify connection in background
    this.verifyConnection().catch(error => {
      console.error('⚠️  Background SMTP verification failed:', error.message);
      // Don't set isConfigured to false here - let actual sending handle the error
    });
  }

  /**
   * Verify email service connection
   */
  async verifyConnection() {
    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ Email credentials missing in .env file');
        this.isConfigured = false;
        return;
      }

      await this.transporter.verify();
      console.log('✅ Email Service: Gmail SMTP connection verified successfully! 🚀');
      this.isConfigured = true;
    } catch (error) {
      console.error('❌ Email Service: SMTP connection failed:', error.message);
      console.error('🔧 Check your Gmail App Password and credentials in .env file');
      this.isConfigured = false;
    }
  }

  /**
   * Send email verification
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

    // If not configured, try to verify connection first
    if (!this.isConfigured) {
      console.log('� Attempting to verify SMTP connection...');
      try {
        await this.verifyConnection();
      } catch (verifyError) {
        console.error('❌ SMTP verification failed:', verifyError.message);
        throw new Error('Email service is not properly configured. Check your Gmail credentials in .env file.');
      }
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
      // Add some email headers for better deliverability
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    };

    try {
      console.log('📤 Sending email via Gmail SMTP...');
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Verification email sent successfully to ${to}! 🎉`);
      console.log(`📧 Message ID: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId,
        response: info.response
      };
    } catch (error) {
      console.error(`❌ Failed to send verification email to ${to}:`, error.message);
      console.error('🔧 Error code:', error.code);
      console.error('🔧 Error response:', error.response);

      // Provide specific error messages
      if (error.code === 'EAUTH') {
        throw new Error('Gmail authentication failed. Please check your App Password in .env file.');
      } else if (error.code === 'ECONNECTION') {
        throw new Error('Cannot connect to Gmail SMTP server. Check your internet connection.');
      } else {
        throw new Error(`Email sending failed: ${error.message}`);
      }
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
   * Send password reset email (for future use)
   */
  async sendPasswordResetEmail({ to, username, name, resetUrl }) {
    // Implementation for password reset emails
    // This is for future enhancement
    console.log('Password reset email functionality - Coming soon!');
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
