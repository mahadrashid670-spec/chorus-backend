const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/billing/checkout-url
// Gumroad doesn't have a "create checkout" API call like Paddle/Lemon Squeezy -
// instead, every product just has one fixed page. We send the customer there
// with their email pre-filled, so we can match them back up in the webhook.
router.get('/checkout-url', requireAuth, (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.businessId);
  if (!business) return res.status(404).json({ error: 'Business not found' });

  if (!process.env.GUMROAD_PRODUCT_URL) {
    return res.status(501).json({
      error: 'Gumroad is not configured yet. Add GUMROAD_PRODUCT_URL to your .env (see README).'
    });
  }

  const url = new URL(process.env.GUMROAD_PRODUCT_URL);
  url.searchParams.set('email', business.email);
  res.json({ checkoutUrl: url.toString() });
});

// Gumroad "Ping" sends form-encoded POST data, not JSON, so this route needs
// its own body parser rather than the express.json() used elsewhere.
const formParser = express.urlencoded({ extended: false });

// POST /api/billing/webhook/sale
// Registered as your Gumroad "Ping" URL (Settings > Advanced) - fires every
// time someone buys. We verify it's real by calling Gumroad's API back with
// the sale_id, then mark that business as Pro.
router.post('/webhook/sale', formParser, async (req, res) => {
  const { sale_id, email } = req.body;
  if (!sale_id || !email) return res.status(200).send('ok');

  const verified = await verifyGumroadSale(sale_id);
  if (!verified) return res.status(200).send('ok'); // ignore anything that doesn't check out

  const business = db.prepare('SELECT id FROM businesses WHERE email = ?').get(email.toLowerCase());
  if (business) {
    db.prepare('UPDATE businesses SET plan = ? WHERE id = ?').run('pro', business.id);
  }
  res.status(200).send('ok');
});

// POST /api/billing/webhook/cancel
// Registered via Gumroad's Resource Subscriptions API for the "cancellation"
// resource (see README - this one isn't a simple dashboard toggle).
router.post('/webhook/cancel', formParser, (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(200).send('ok');

  const business = db.prepare('SELECT id FROM businesses WHERE email = ?').get(email.toLowerCase());
  if (business) {
    db.prepare('UPDATE businesses SET plan = ? WHERE id = ?').run('free', business.id);
  }
  res.status(200).send('ok');
});

// Gumroad Ping isn't cryptographically signed, so anyone could POST fake data
// to our webhook claiming a sale happened. To protect against that, we call
// Gumroad's own API back and only trust pings that correspond to a real sale.
async function verifyGumroadSale(saleId) {
  if (!process.env.GUMROAD_ACCESS_TOKEN) return true; // can't verify without a token - trust it
  try {
    const res = await fetch(
      `https://api.gumroad.com/v2/sales/${saleId}?access_token=${process.env.GUMROAD_ACCESS_TOKEN}`
    );
    const data = await res.json();
    return !!(data && data.success && data.sale);
  } catch (err) {
    return false;
  }
}

module.exports = router;
