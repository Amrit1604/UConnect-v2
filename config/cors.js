const cors = require('cors');

/**
 * CORS Configuration
 * Sets up Cross-Origin Resource Sharing
 */
const configureCORS = (app) => {
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? 'https://your-domain.com' : 'http://localhost:4000',
    credentials: true
  }));
};

module.exports = { configureCORS };