// Basic sanity test for the app
const request = require('supertest');
const app = require('../app');

describe('App Sanity', () => {
  it('should load the homepage', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/connect/i);
  });
});
