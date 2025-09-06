/**
 * Error Handler Middleware - UConnect
 * Centralized error handling for the application
 */

const errorHandler = (err, req, res, next) => {
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    user: req.user ? req.user.email : 'Anonymous'
  });

  // Default error values
  let error = { ...err };
  error.message = err.message;

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, status: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    let message = 'Duplicate field value entered';

    // More specific messages for common duplicates
    if (err.keyPattern && err.keyPattern.email) {
      message = 'An account with this email already exists';
    }

    error = { message, status: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, status: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, status: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, status: 401 };
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large. Maximum size is 5MB';
    error = { message, status: 400 };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    error = { message, status: 400 };
  }

  // Rate limiting errors
  if (err.status === 429) {
    const message = 'Too many requests. Please try again later';
    error = { message, status: 429 };
  }

  const statusCode = error.status || err.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Set flash message for redirects
  if (req.flash) {
    req.flash('error', message);
  }

  // API requests (JSON response)
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(statusCode).json({
      success: false,
      error: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }

  // Web requests (render error page)
  res.status(statusCode).render('error', {
    title: `Error ${statusCode}`,
    error: {
      status: statusCode,
      message: message
    },
    showStack: process.env.NODE_ENV === 'development' ? err.stack : null,
    user: req.user || null,
    bodyTemplate: null
  });
};

module.exports = errorHandler;