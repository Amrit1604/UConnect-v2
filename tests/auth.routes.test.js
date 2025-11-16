// Auth route tests (basic)
const request = require('supertest');
const app = require('../app');

describe('Auth Routes', () => {
  it('should show login page', async () => {
    const res = await request(app).get('/auth/login');
    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/login/i);
  });
  it('should show register page', async () => {
    const res = await request(app).get('/auth/register');
    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/register/i);
  });
});
