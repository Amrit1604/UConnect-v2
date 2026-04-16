/**
 * Email Service - UConnect 🔥
 * Hybrid Email System: Brevo API (Production) + SMTP (Local)
 *
 * LOCAL DEV  → Gmail SMTP (your gmail app password)
 * PRODUCTION → Brevo API (300 emails/day FREE - works on Render!)
 *
 * Super cool Red/White/Black branded emails! 🎨
 */

const nodemailer = require('nodemailer');
const { Resend } = require('resend');

class EmailService {
  constructor() {
    this.transporter = null;
    this.resend = null;
    this.isConfigured = false;
    this.provider = 'none';
    this.maxRetries = 3;
    this.smtpConfig = this.resolveSmtpConfig();
    this.brevoApiKey = process.env.BREVO_API_KEY || '';
    this.brevoFrom = process.env.BREVO_FROM || process.env.EMAIL_FROM || this.smtpConfig.fromEmail || '';
    this.resendApiKey = process.env.RESEND_API_KEY || '';
    this.resendFrom = process.env.RESEND_FROM || process.env.EMAIL_FROM || this.smtpConfig.fromEmail || 'onboarding@resend.dev';
    this.initialize();
  }

  mask(value, keep = 4) {
    if (!value) return 'MISSING';
    return '***' + String(value).slice(-keep);
  }

  parseBoolean(value, fallback = false) {
    if (typeof value === 'undefined') return fallback;
    const v = String(value).trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
  }

  resolveSmtpConfig() {
    const user = process.env.EMAIL_USER || process.env.GMAIL_USER || '';
    const rawPass = process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || '';
    const pass = rawPass ? rawPass.replace(/\s+/g, '') : '';
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.EMAIL_PORT || '465', 10);
    const secure = this.parseBoolean(process.env.EMAIL_SECURE, port === 465);
    const fromName = process.env.EMAIL_FROM_NAME || 'UConnect';
    const fromEmail = process.env.EMAIL_FROM || user;

    return {
      host,
      port,
      secure,
      user,
      pass,
      fromName,
      fromEmail
    };
  }

  canUseSMTP() {
    return !!(this.smtpConfig.user && this.smtpConfig.pass);
  }

  canUseBrevo() {
    return !!this.brevoApiKey;
  }

  canUseResend() {
    return !!this.resendApiKey;
  }

  /**
   * Initialize email service based on environment
   */
  initialize() {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          🔥 UCONNECT EMAIL SERVICE INITIALIZING 🔥         ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('🌐 Environment:', process.env.NODE_ENV || 'development');

    const preferred = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();

    if (preferred === 'smtp') {
      this.initializeSMTP();
    } else if (preferred === 'brevo') {
      this.initializeBrevo();
    } else if (preferred === 'resend') {
      this.initializeResend();
    } else if ((process.env.NODE_ENV || 'development') === 'development' && this.canUseSMTP()) {
      // In development, prefer SMTP if available so local testing is predictable.
      this.initializeSMTP();
    } else if (this.canUseBrevo()) {
      this.initializeBrevo();
    } else if (this.canUseResend()) {
      this.initializeResend();
    } else if (this.canUseSMTP()) {
      this.initializeSMTP();
    } else {
      console.warn('⚠️ No email provider configured!');
      console.warn('💡 Set one of: BREVO_API_KEY, RESEND_API_KEY, or EMAIL_USER/EMAIL_PASS (or GMAIL_USER/GMAIL_APP_PASSWORD)');
      this.provider = 'none';
      this.isConfigured = false;
    }
    console.log('');
  }

  /**
   * Initialize Brevo API for production (Render)
   * Brevo offers 300 emails/day FREE - perfect for startups! 🚀
   */
  initializeBrevo() {
    try {
      console.log('📧 Mode: BREVO API (Production - 300 emails/day FREE!)');
      console.log('🔑 API Key:', this.mask(this.brevoApiKey, 8));

      if (!this.canUseBrevo()) {
        console.error('❌ BREVO_API_KEY is missing in environment variables!');
        this.isConfigured = false;
        return;
      }

      this.provider = 'brevo';
      this.isConfigured = true;

      console.log('✅ Brevo API initialized successfully! 🚀');
      console.log('📬 From:', this.brevoFrom || 'noreply@uconnect.com');
    } catch (error) {
      console.error('❌ Brevo initialization failed:', error.message);
      this.isConfigured = false;
    }
  }

  /**
   * Initialize Resend API
   */
  initializeResend() {
    try {
      console.log('📧 Mode: RESEND API');
      console.log('🔑 API Key:', this.mask(this.resendApiKey, 8));

      if (!this.canUseResend()) {
        console.error('❌ RESEND_API_KEY is missing in environment variables!');
        this.isConfigured = false;
        return;
      }

      this.resend = new Resend(this.resendApiKey);
      this.provider = 'resend';
      this.isConfigured = true;

      console.log('✅ Resend API initialized successfully! 🚀');
      console.log('📬 From:', this.resendFrom);
    } catch (error) {
      console.error('❌ Resend initialization failed:', error.message);
      this.isConfigured = false;
    }
  }

  /**
   * Initialize Gmail SMTP for local development
   */
  initializeSMTP() {
    try {
      console.log('📧 Mode: GMAIL SMTP (Development)');
      console.log('📧 Email User:', this.smtpConfig.user ? this.smtpConfig.user.substring(0, 5) + '***' : 'MISSING');
      console.log('🔑 Email Pass:', this.smtpConfig.pass ? '****' + this.smtpConfig.pass.slice(-4) : 'MISSING');

      if (!this.canUseSMTP()) {
        console.warn('⚠️ SMTP credentials missing - emails will not work locally');
        console.warn('💡 Set EMAIL_USER/EMAIL_PASS or GMAIL_USER/GMAIL_APP_PASSWORD in your .env file');
        this.isConfigured = false;
        return;
      }

      const smtpOptions = {
        host: this.smtpConfig.host,
        port: this.smtpConfig.port,
        secure: this.smtpConfig.secure,
        auth: {
          user: this.smtpConfig.user,
          pass: this.smtpConfig.pass
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 60000
      };

      // Gmail-specific defaults when host points to Gmail.
      if (String(this.smtpConfig.host).includes('gmail')) {
        smtpOptions.service = 'gmail';
        smtpOptions.tls = { rejectUnauthorized: false };
      }

      this.transporter = nodemailer.createTransport({
        ...smtpOptions
      });

      this.provider = 'smtp';
      this.isConfigured = true;

      // Verify connection in background
      console.log('🔄 Verifying SMTP connection...');
      this.transporter.verify()
        .then(() => {
          console.log('✅ SMTP connection verified! 🚀');
        })
        .catch(err => {
          console.warn('⚠️ SMTP verification failed:', err.message);
          console.log('📧 Will retry when sending actual email');
        });

    } catch (error) {
      console.error('❌ SMTP initialization failed:', error.message);
      this.isConfigured = false;
    }
  }

  /**
   * Send verification email
   * Uses Brevo (production) or SMTP (development) automatically
   */
  async sendVerificationEmail({ to, username, name, verificationUrl }) {
    console.log('');
    console.log('📧 ═══════════════════════════════════════════════════════');
    console.log('📧 SENDING VERIFICATION EMAIL');
    console.log('📧 To:', to);
    console.log('📧 Provider:', this.provider || 'auto');
    console.log('📧 ═══════════════════════════════════════════════════════');

    const html = this.generateVerificationHTML({ name, username, verificationUrl, to });
    const text = this.generateVerificationText({ name, verificationUrl });

    return this.sendWithFallback({
      to,
      subject: '🔥 Verify Your UConnect Account',
      html,
      text
    });
  }

  /**
   * Send password reset email
   */
  async sendResetPasswordEmail({ to, username, name, resetUrl }) {
    console.log('');
    console.log('📧 ═══════════════════════════════════════════════════════');
    console.log('📧 SENDING PASSWORD RESET EMAIL');
    console.log('📧 To:', to);
    console.log('📧 Provider:', this.provider || 'auto');
    console.log('📧 ═══════════════════════════════════════════════════════');

    const html = this.generateResetPasswordHTML({ name, username, resetUrl, to });
    const text = this.generateResetPasswordText({ name, resetUrl });

    return this.sendWithFallback({
      to,
      subject: '🔐 Reset Your UConnect Password',
      html,
      text
    });
  }

  getProviderOrder() {
    const available = {
      brevo: this.canUseBrevo(),
      resend: this.canUseResend(),
      smtp: this.canUseSMTP()
    };

    const primary = this.provider && this.provider !== 'none' ? this.provider : null;
    const order = [];

    if (primary && available[primary]) {
      order.push(primary);
    }

    // Reasonable fallback preference for local/dev debugging.
    ['smtp', 'brevo', 'resend'].forEach((p) => {
      if (available[p] && !order.includes(p)) {
        order.push(p);
      }
    });

    return order;
  }

  async sendWithProvider(provider, payload) {
    if (provider === 'brevo') return this.sendWithBrevo(payload);
    if (provider === 'resend') return this.sendWithResend(payload);
    if (provider === 'smtp') return this.sendWithSMTP(payload);
    throw new Error(`Unknown email provider: ${provider}`);
  }

  async sendWithFallback(payload) {
    const order = this.getProviderOrder();
    if (order.length === 0) {
      throw new Error('No email provider configured. Set BREVO_API_KEY, RESEND_API_KEY, or SMTP credentials.');
    }

    const errors = [];
    for (const provider of order) {
      try {
        const result = await this.sendWithProvider(provider, payload);
        this.provider = provider;
        return result;
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        console.error(`❌ Provider ${provider} failed:`, msg);
        errors.push(`${provider}: ${msg}`);
      }
    }

    throw new Error(`All email providers failed. ${errors.join(' | ')}`);
  }

  /**
   * Send email using Brevo API
   */
  async sendWithBrevo({ to, subject, html, text }) {
    try {
      console.log('🚀 Sending via Brevo API...');

      const fromEmail = this.brevoFrom || this.smtpConfig.fromEmail || 'noreply@uconnect.com';
      const fromName = this.smtpConfig.fromName || 'UConnect';

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.brevoApiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ Brevo API error:', result);
        throw new Error(result.message || JSON.stringify(result) || 'Brevo API request failed');
      }

      console.log('✅ Email sent via Brevo!');
      console.log('📧 Message ID:', result.messageId || 'N/A');

      return {
        success: true,
        messageId: result.messageId,
        provider: 'brevo'
      };
    } catch (error) {
      throw new Error(`Failed to send email via Brevo: ${error.message}`);
    }
  }

  /**
   * Send email using Resend API
   */
  async sendWithResend({ to, subject, html, text }) {
    try {
      if (!this.resend) {
        this.resend = new Resend(this.resendApiKey);
      }

      console.log('🚀 Sending via Resend API...');
      const result = await this.resend.emails.send({
        from: this.resendFrom,
        to,
        subject,
        html,
        text
      });

      if (result && result.error) {
        throw new Error(result.error.message || JSON.stringify(result.error));
      }

      console.log('✅ Email sent via Resend!');
      console.log('📧 Message ID:', result && result.data && result.data.id ? result.data.id : 'N/A');

      return {
        success: true,
        messageId: result && result.data ? result.data.id : null,
        provider: 'resend'
      };
    } catch (error) {
      throw new Error(`Failed to send email via Resend: ${error.message}`);
    }
  }

  /**
   * Send email using Gmail SMTP (Development - Local)
   */
  async sendWithSMTP({ to, subject, html, text }) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`📮 Attempt ${attempt}/${this.maxRetries}: Sending via SMTP...`);

        if (!this.transporter) {
          console.log('🔄 Reinitializing SMTP transporter...');
          this.initializeSMTP();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const info = await this.transporter.sendMail({
          from: {
            name: this.smtpConfig.fromName || 'UConnect',
            address: this.smtpConfig.fromEmail || this.smtpConfig.user
          },
          to: to,
          subject: subject,
          html: html,
          text: text
        });

        console.log('✅ Email sent via SMTP!');
        console.log('📧 Message ID:', info.messageId);

        return {
          success: true,
          messageId: info.messageId,
          provider: 'smtp'
        };

      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt} failed:`, error.message);

        // Don't retry auth errors
        if (error.code === 'EAUTH' || error.responseCode === 535) {
          console.error('🔐 Authentication failed - check your Gmail App Password');
          break;
        }

        if (attempt < this.maxRetries) {
          const waitTime = attempt * 2000;
          console.log(`⏳ Waiting ${waitTime/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw new Error(`SMTP email failed: ${lastError?.message || 'Unknown error'}`);
  }

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║         🎨 SUPER COOL EMAIL TEMPLATES - RED/WHITE/BLACK THEME 🎨          ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  /**
   * Generate VERIFICATION email HTML - Red/White/Black Theme 🔥
   */
  generateVerificationHTML({ name, username, verificationUrl, to }) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your UConnect Account</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #111111; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px rgba(220, 38, 38, 0.15);">

          <!-- 🔥 HEADER - Bold Red Gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); padding: 50px 40px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">🔥</div>
              <h1 style="color: #FFFFFF; font-size: 36px; font-weight: 900; margin: 0; letter-spacing: -1px; text-transform: uppercase;">
                UCONNECT
              </h1>
              <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 10px 0 0 0; letter-spacing: 3px; text-transform: uppercase;">
                YOUR CAMPUS • YOUR COMMUNITY
              </p>
            </td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td style="padding: 50px 40px;">

              <!-- Welcome Message -->
              <h2 style="color: #FFFFFF; font-size: 28px; font-weight: 700; margin: 0 0 10px 0;">
                Welcome aboard, ${name || username}! 👋
              </h2>
              <p style="color: #9CA3AF; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                You're just one click away from joining the most exclusive campus community.
                Verify your email to unlock all features and start connecting!
              </p>

              <!-- 📊 Stats Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 30px;">
                <tr>
                  <td style="background-color: #1a1a1a; border-radius: 12px; padding: 25px; border-left: 4px solid #DC2626;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="33%" style="text-align: center; padding: 10px;">
                          <div style="color: #DC2626; font-size: 28px; font-weight: 900;">10K+</div>
                          <div style="color: #6B7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Students</div>
                        </td>
                        <td width="33%" style="text-align: center; padding: 10px; border-left: 1px solid #333; border-right: 1px solid #333;">
                          <div style="color: #DC2626; font-size: 28px; font-weight: 900;">50+</div>
                          <div style="color: #6B7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Campuses</div>
                        </td>
                        <td width="33%" style="text-align: center; padding: 10px;">
                          <div style="color: #DC2626; font-size: 28px; font-weight: 900;">24/7</div>
                          <div style="color: #6B7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Active</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- 🔴 CTA Button - Red Gradient -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); color: #FFFFFF; text-decoration: none; padding: 18px 50px; border-radius: 50px; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 2px; box-shadow: 0 10px 30px rgba(220, 38, 38, 0.4);">
                      ✅ VERIFY MY EMAIL
                    </a>
                  </td>
                </tr>
              </table>

              <!-- ⏰ Expiry Warning -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30px;">
                <tr>
                  <td style="background-color: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.3); border-radius: 8px; padding: 15px 20px;">
                    <p style="color: #DC2626; font-size: 14px; margin: 0; text-align: center;">
                      ⏰ This link expires in <strong>24 hours</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- 🔗 Alternative Link -->
              <div style="margin-top: 30px; padding: 20px; background-color: #1a1a1a; border-radius: 8px;">
                <p style="color: #6B7280; font-size: 12px; margin: 0 0 10px 0;">Can't click the button? Copy this link:</p>
                <p style="color: #9CA3AF; font-size: 11px; margin: 0; word-break: break-all; font-family: monospace; background: #0a0a0a; padding: 10px; border-radius: 4px;">
                  ${verificationUrl}
                </p>
              </div>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #0a0a0a; padding: 30px 40px; text-align: center; border-top: 1px solid #222;">
              <p style="color: #DC2626; font-size: 20px; font-weight: 900; margin: 0 0 5px 0; letter-spacing: 2px;">UCONNECT</p>
              <p style="color: #4B5563; font-size: 12px; margin: 0 0 20px 0;">Connect • Share • Thrive</p>
              <p style="color: #374151; font-size: 11px; margin: 0;">
                Sent to <span style="color: #6B7280;">${to}</span><br>
                If you didn't sign up, just ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Generate verification email plain text
   */
  generateVerificationText({ name, verificationUrl }) {
    return `
═══════════════════════════════════════
🔥 UCONNECT - VERIFY YOUR EMAIL
═══════════════════════════════════════

Welcome aboard, ${name}! 👋

You're just one click away from joining the most exclusive campus community.

Click here to verify: ${verificationUrl}

⏰ This link expires in 24 hours.

═══════════════════════════════════════
If you didn't create this account, ignore this email.

- The UConnect Team 🔥
═══════════════════════════════════════
    `.trim();
  }

  /**
   * Generate PASSWORD RESET email HTML - Red/White/Black Theme 🔐
   */
  generateResetPasswordHTML({ name, username, resetUrl, to }) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #111111; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px rgba(220, 38, 38, 0.15);">

          <!-- HEADER - Dark with Red Accent -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); padding: 50px 40px; text-align: center; border-bottom: 3px solid #DC2626;">
              <div style="font-size: 48px; margin-bottom: 10px;">🔐</div>
              <h1 style="color: #FFFFFF; font-size: 32px; font-weight: 900; margin: 0; letter-spacing: -1px;">
                PASSWORD RESET
              </h1>
              <p style="color: #DC2626; font-size: 14px; margin: 10px 0 0 0; letter-spacing: 2px; text-transform: uppercase;">
                Secure Account Recovery
              </p>
            </td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td style="padding: 50px 40px;">

              <h2 style="color: #FFFFFF; font-size: 24px; font-weight: 700; margin: 0 0 10px 0;">
                Hey ${name || username},
              </h2>
              <p style="color: #9CA3AF; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                We received a request to reset your password. No worries, it happens! Click the button below to create a new secure password.
              </p>

              <!-- 🛡️ Security Icon Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 30px;">
                <tr>
                  <td style="background-color: #1a1a1a; border-radius: 12px; padding: 25px; text-align: center; border-left: 4px solid #DC2626;">
                    <div style="font-size: 40px; margin-bottom: 15px;">🛡️</div>
                    <p style="color: #6B7280; font-size: 14px; margin: 0;">
                      For your security, this link will expire in <span style="color: #DC2626; font-weight: bold;">1 hour</span>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- 🔴 CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); color: #FFFFFF; text-decoration: none; padding: 18px 50px; border-radius: 50px; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 2px; box-shadow: 0 10px 30px rgba(220, 38, 38, 0.4);">
                      🔑 RESET PASSWORD
                    </a>
                  </td>
                </tr>
              </table>

              <!-- ⚠️ Warning -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30px;">
                <tr>
                  <td style="background-color: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; padding: 15px 20px;">
                    <p style="color: #FBBF24; font-size: 13px; margin: 0;">
                      ⚠️ <strong>Didn't request this?</strong> Someone may have entered your email by mistake.
                      If you didn't request a password reset, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- 🔗 Alternative Link -->
              <div style="margin-top: 30px; padding: 20px; background-color: #1a1a1a; border-radius: 8px;">
                <p style="color: #6B7280; font-size: 12px; margin: 0 0 10px 0;">Can't click the button? Copy this link:</p>
                <p style="color: #9CA3AF; font-size: 11px; margin: 0; word-break: break-all; font-family: monospace; background: #0a0a0a; padding: 10px; border-radius: 4px;">
                  ${resetUrl}
                </p>
              </div>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #0a0a0a; padding: 30px 40px; text-align: center; border-top: 1px solid #222;">
              <p style="color: #DC2626; font-size: 20px; font-weight: 900; margin: 0 0 5px 0; letter-spacing: 2px;">UCONNECT</p>
              <p style="color: #4B5563; font-size: 12px; margin: 0 0 20px 0;">Your Security Matters 🔒</p>
              <p style="color: #374151; font-size: 11px; margin: 0;">
                Sent to <span style="color: #6B7280;">${to}</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Generate password reset plain text
   */
  generateResetPasswordText({ name, resetUrl }) {
    return `
═══════════════════════════════════════
🔐 UCONNECT - PASSWORD RESET
═══════════════════════════════════════

Hey ${name},

We received a request to reset your password. No worries!

Click here to reset: ${resetUrl}

⏰ This link expires in 1 hour.

═══════════════════════════════════════
⚠️ If you didn't request this, please ignore this email.

- The UConnect Team 🔥
═══════════════════════════════════════
    `.trim();
  }

  /**
   * Send welcome email (optional - for future use)
   */
  async sendWelcomeEmail({ to, username, name }) {
    console.log('📧 Welcome email feature - Coming soon!');
    return { success: true };
  }

  /**
   * Verify email service connection
   */
  async verifyConnection() {
    if (this.provider === 'brevo' && this.canUseBrevo()) {
      console.log('✅ Brevo API is configured');
      return true;
    }

    if (this.provider === 'resend' && this.canUseResend()) {
      console.log('✅ Resend API is configured');
      return true;
    }

    if (this.transporter) {
      try {
        await this.transporter.verify();
        console.log('✅ SMTP connection verified');
        return true;
      } catch (error) {
        console.error('❌ SMTP verification failed:', error.message);
        return false;
      }
    }

    return false;
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;
