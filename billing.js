const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/billing/checkout
// Returns a Paddle-hosted checkout URL for the logged-in business to upgrade to Pro.
// Paddle (not Stripe) is used here because Stripe does not support Pakistan-based
// sellers. Paddle acts as "merchant of record" - it handles the card payment and
// pays YOU out by bank transfer, which you receive into your Nsave USD account.
router.post('/checkout', requireAuth, async (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.businessId);
  if (!business) return res.status(404).json({ error: 'Business not found' });

  if (!process.env.PADDLE_API_KEY || !process.env.PADDLE_PRO_PRICE_ID) {
    return res.status(501).json({
      error: 'Paddle is not configured yet. Add PADDLE_API_KEY and PADDLE_PRO_PRICE_ID to your .env (see README).'
    });
  }

  try {
    const response = await fetch('https://api.paddle.com/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PADDLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [{ price_id: process.env.PADDLE_PRO_PRICE_ID, quantity: 1 }],
        custom_data: { businessId: business.id },
        customer: { email: business.email }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(502).json({ error: 'Paddle rejected the request', details: data });
    }

    // The frontend opens this with Paddle.js (Paddle's checkout overlay), or you can
    // redirect the user to a hosted checkout page - see README for both options.
    res.json({ transactionId: data.data.id });
  } catch (err) {
    res.status(502).json({ error: 'Could not reach Paddle', details: err.message });
  }
});

// POST /api/billing/webhook
// Paddle calls this automatically whenever a subscription is created, renewed,
// or cancelled. This is what actually flips a business from "free" to "pro".
router.post('/webhook', express.raw({ type: '*/*' }), (req, res) => {
  const signatureHeader = req.headers['paddle-signature'];
  const secret = process.env.PADDLE_WEBHOOK_SECRET;

  if (!verifyPaddleSignature(req.body, signatureHeader, secret)) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(req.body.toString('utf8'));

  const businessId = event.data && event.data.custom_data && event.data.custom_data.businessId;
  if (!businessId) return res.status(200).send('ok'); // nothing to do

  if (event.event_type === 'transaction.completed' || event.event_type === 'subscription.activated') {
    db.prepare('UPDATE businesses SET plan = ?, paddle_subscription_id = ? WHERE id = ?')
      .run('pro', event.data.subscription_id || event.data.id, businessId);
  }

  if (event.event_type === 'subscription.canceled' || event.event_type === 'subscription.paused') {
    db.prepare('UPDATE businesses SET plan = ? WHERE id = ?').run('free', businessId);
  }

  res.status(200).send('ok');
});

function verifyPaddleSignature(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader) return false;
  try {
    const parts = Object.fromEntries(
      signatureHeader.split(';').map(p => p.split('='))
    );
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${parts.ts}:${rawBody}`)
      .digest('hex');
    return expected === parts.h1;
  } catch (err) {
    return false;
  }
}

module.exports = router;
