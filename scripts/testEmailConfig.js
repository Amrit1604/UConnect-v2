require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmailConfig() {
    console.log('\n📧 Email Configuration Test');
    console.log('========================');
    
    // Check if credentials are set
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ ERROR: EMAIL_USER or EMAIL_PASS not set in .env file');
        console.log('\nPlease update your .env file with real credentials:');
        console.log('EMAIL_USER=your.email@gmail.com');
        console.log('EMAIL_PASS=your-16-char-app-password');
        process.exit(1);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(process.env.EMAIL_USER)) {
        console.error('❌ ERROR: EMAIL_USER is not a valid email address');
        console.log(`Current value: ${process.env.EMAIL_USER}`);
        process.exit(1);
    }

    // Check password length (Gmail App Passwords are 16 characters)
    if (process.env.EMAIL_PASS.length !== 16) {
        console.error('⚠️  WARNING: EMAIL_PASS length is not 16 characters');
        console.log('Gmail App Passwords should be exactly 16 characters');
        console.log(`Current length: ${process.env.EMAIL_PASS.length} characters`);
    }

    console.log('\n📤 Testing SMTP Connection...');
    console.log(`Host: ${process.env.EMAIL_HOST}`);
    console.log(`Port: ${process.env.EMAIL_PORT}`);
    console.log(`User: ${process.env.EMAIL_USER}`);
    console.log(`Pass: ${'*'.repeat(process.env.EMAIL_PASS.length)}`);

    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        await transporter.verify();
        console.log('\n✅ SUCCESS: SMTP connection verified successfully!');
        console.log('Your email configuration is working correctly.');
    } catch (error) {
        console.error('\n❌ ERROR: SMTP connection failed');
        console.error('Error details:', error.message);
        
        if (error.message.includes('535-5.7.8')) {
            console.log('\n🔧 This error usually means:');
            console.log('1. You\'re using a regular Gmail password (not supported)');
            console.log('2. The App Password is incorrect');
            console.log('\n📝 To fix this:');
            console.log('1. Enable 2-Step Verification: https://myaccount.google.com/security');
            console.log('2. Generate an App Password: https://myaccount.google.com/apppasswords');
            console.log('3. Select "Mail" and your device type');
            console.log('4. Copy the 16-character password to EMAIL_PASS in .env');
        }
        process.exit(1);
    }
}

testEmailConfig().catch(console.error);