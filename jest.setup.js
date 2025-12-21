// Jest setup file - runs before all tests
const mongoose = require('mongoose');

// Silence console logs during tests (keep errors though)
global.console = {
  ...console,
  log: jest.fn(), // Mock console.log
  debug: jest.fn(), // Mock console.debug  
  info: jest.fn(), // Mock console.info
  // Keep error and warn for debugging
  error: console.error,
  warn: console.warn,
};

// Increase test timeout for slow DB operations
jest.setTimeout(30000);

// Ensure mongoose connects before running tests
beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/uconnect_test';
    await mongoose.connect(mongoUri);
  }
});

// Close mongoose connection after all tests
afterAll(async () => {
  await mongoose.connection.close();
});

