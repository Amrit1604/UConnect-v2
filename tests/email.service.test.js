#!/usr/bin/env node

/**
 * Test script for Email Service
 * Tests both Resend and SMTP providers
 */

require('dotenv').config();
const emailService = require('../services/emailService');

async function testEmailService() {
  console.log('🧪 Testing Email Service Configuration...\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✅ Set' : '❌ Not set');
  console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Not set');
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Set' : '❌ Not set');
  console.log('');

  // Test basic configuration
  console.log('🔧 Service Configuration:');
  console.log('Primary Provider:', emailService.primaryProvider);
  console.log('Is Configured:', emailService.isConfigured);
  console.log('Resend Available:', emailService.resend !== null);
  console.log('SMTP Available:', emailService.transporter !== null);
  console.log('');

  // Test email sending (optional - comment out if you don't want to send test emails)
  if (process.argv.includes('--send-test')) {
    console.log('📧 Testing Email Sending...');

    try {
      const testResult = await emailService.sendVerificationEmail({
        to: process.env.EMAIL_USER || 'test@example.com', // Send to yourself for testing
        username: 'testuser',
        name: 'Test User',
        verificationUrl: 'https://example.com/verify/test'
      });

      console.log('✅ Test email sent successfully!');
      console.log('Provider used:', testResult.provider || 'unknown');
      console.log('Message ID:', testResult.messageId);

    } catch (error) {
      console.log('❌ Test email failed:', error.message);
      console.log('This is expected if no valid API keys are configured');
    }
  } else {
    console.log('💡 To send a test email, run: node tests/email.service.test.js --send-test');
    console.log('⚠️  Make sure to set a valid email address in EMAIL_USER');
  }

  console.log('\n🎯 Summary:');
  if (emailService.primaryProvider === 'resend' && emailService.resend) {
    console.log('✅ Resend is configured and will be used as primary provider');
  } else if (emailService.primaryProvider === 'smtp' && emailService.transporter) {
    console.log('✅ SMTP is configured and will be used as primary provider');
  } else {
    console.log('❌ No email providers are properly configured');
  }
}

// Run the test
testEmailService().catch(console.error);
