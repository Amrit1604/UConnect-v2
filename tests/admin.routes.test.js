// Admin route test (locked by default)
const request = require('supertest');
const app = require('../app');

describe('Admin Routes', () => {
  it('should block access to /admin when not unlocked', async () => {
    const res = await request(app).get('/admin');
    expect(res.statusCode).toBe(302); // redirect to login or home
  });
});
