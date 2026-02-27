/**
 * Internal API for trusted services (e.g. FitDesk) to send SMS via this backend.
 * Used when the caller cannot reach Twilio directly (e.g. CloudFront 403).
 * Requires INTERNAL_SMS_SHARED_SECRET in .env and X-Internal-Auth header.
 */
const express = require('express');
const { sendSms } = require('../services/sms');

const router = express.Router();

router.post('/send-sms', async (req, res) => {
  try {
    const secret = process.env.INTERNAL_SMS_SHARED_SECRET;
    if (!secret) {
      return res.status(503).json({ error: 'Internal SMS proxy not configured' });
    }
    const authHeader = req.headers['x-internal-auth'];
    if (!authHeader || authHeader !== secret) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { to, body } = req.body || {};
    if (!to || typeof body !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid to/body' });
    }
    await sendSms(to, String(body));
    return res.json({ success: true });
  } catch (err) {
    console.error('Internal send-sms error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to send SMS',
    });
  }
});

module.exports = router;
