/**
 * Test script for Brevo email integration
 * Run with: node test-brevo.js
 */

require('dotenv').config();
const emailService = require('./services/emailService');

async function testBrevoEmail() {
  console.log('🧪 Testing Brevo Email Integration...\n');

  try {
    // Test verification email
    const testResult = await emailService.sendVerificationEmail({
      to: 'gurman2109@gmail.com', // Using your actual email for testing
      username: 'testuser',
      name: 'Test User',
      verificationUrl: 'https://uconnect-campus.com/auth/verify-email?token=test-token'
    });

    console.log('✅ Test email sent successfully!');
    console.log('📧 Provider used:', testResult.provider);
    console.log('📧 Message ID:', testResult.messageId);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testBrevoEmail();
