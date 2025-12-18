const compression = require('compression');
const morgan = require('morgan');
const methodOverride = require('method-override');
const path = require('path');

/**
 * Application Middleware Configuration
 * Sets up various middleware for the Express app
 */
const configureAppMiddleware = (app) => {
  // Compression middleware
  app.use(compression());

  // Logging middleware
  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }

  // Body parsing middleware
  app.use(require('express').json({ limit: '10mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '10mb' }));

  // Method override middleware
  app.use(methodOverride('_method'));

  // View engine setup
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));

  // Static files
  app.use(require('express').static(path.join(__dirname, '../public')));
  // Note: Local uploads are no longer served; files are streamed via /gridfs routes

  // Global middleware to pass user data to all views
  app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.isAdminSession = req.session && req.session.isAdmin;
    res.locals.messages = {
      success: req.flash('success'),
      error: req.flash('error'),
      warning: req.flash('warning'),
      info: req.flash('info')
    };
    res.locals.currentPath = req.path;
    next();
  });
};

module.exports = { configureAppMiddleware };