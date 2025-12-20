/**
 * Media Proxy Route
 * Proxy Supabase videos through our server to fix CORS issues
 */

const express = require('express');
const router = express.Router();

// GET /media/proxy?url=<supabase_url>
router.get('/proxy', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || !url.includes('supabase.co')) {
      return res.status(400).send('Invalid URL');
    }

    // Fetch from Supabase (using native fetch in Node 18+)
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch media');
    }

    // Copy headers
    res.set({
      'Content-Type': response.headers.get('content-type'),
      'Content-Length': response.headers.get('content-length'),
      'Cache-Control': 'public, max-age=31536000',
      'Access-Control-Allow-Origin': '*'
    });

    // Stream the response (convert ReadableStream to Node stream)
    const reader = response.body.getReader();
    
    const stream = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    };
    
    stream().catch(err => {
      console.error('Stream error:', err);
      res.end();
    });

  } catch (error) {
    console.error('Media proxy error:', error);
    res.status(500).send('Media proxy failed');
  }
});

module.exports = router;
