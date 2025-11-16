/**
 * Basic auth endpoint smoke tests (mounts the auth router on a fresh Express app)
 */
const path = require('path');
const express = require('express');
const request = require('supertest');
const dotenv = require('dotenv');

// Ensure test mode and skip email verification to avoid background SMTP checks
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.SKIP_EMAIL_VERIFY = 'true';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Require the router after environment is set
const authRouter = require('../routes/auth');

let app;

beforeAll(() => {
  app = express();
  // Basic middleware that auth routes expect (sessions + flash + body parser + view engine)
  const session = require('express-session');
  const flash = require('connect-flash');

  app.set('view engine', 'ejs');
  app.set('views', path.resolve(__dirname, '..', 'views'));

  app.use(express.urlencoded({ extended: false }));
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: true }));
  app.use(flash());

  // Stub res.render to avoid dependency on full view rendering in unit tests
  app.use((req, res, next) => {
    res.render = function(view, locals, cb) {
      // If a callback is provided, call it with a simple HTML string
      if (typeof locals === 'function') {
        cb = locals;
        locals = {};
      }
      if (typeof cb === 'function') return cb(null, '<html>ok</html>');
      return res.status(200).send('<html>ok</html>');
    };
    next();
  });

  app.use('/auth', authRouter);
});

test('GET /auth/register returns 200', async () => {
  const res = await request(app).get('/auth/register');
  expect([200,302]).toContain(res.statusCode); // app may redirect if session shows logged-in
});

test('GET /auth/login returns 200', async () => {
  const res = await request(app).get('/auth/login');
  expect([200,302]).toContain(res.statusCode);
});
