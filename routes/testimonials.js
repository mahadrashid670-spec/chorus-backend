const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const FREE_PLAN_LIMIT = 15;

// ---------- Protected: dashboard side ----------

// GET /api/me/testimonials
router.get('/me/testimonials', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM testimonials WHERE business_id = ? ORDER BY created_at DESC'
  ).all(req.businessId);
  res.json(rows.map(formatTestimonial));
});

// PATCH /api/me/testimonials/:id  { approved: true|false }
router.patch('/me/testimonials/:id', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM testimonials WHERE id = ? AND business_id = ?')
    .get(req.params.id, req.businessId);
  if (!t) return res.status(404).json({ error: 'Testimonial not found' });

  db.prepare('UPDATE testimonials SET approved = ? WHERE id = ?')
    .run(req.body.approved ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/me/testimonials/:id
router.delete('/me/testimonials/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM testimonials WHERE id = ? AND business_id = ?')
    .run(req.params.id, req.businessId);
  if (result.changes === 0) return res.status(404).json({ error: 'Testimonial not found' });
  res.json({ ok: true });
});

// ---------- Public: the collection form + widget data ----------

// GET /api/public/:slug - business info needed to render the collection form
router.get('/public/:slug', (req, res) => {
  const b = db.prepare('SELECT biz_name, slug, question FROM businesses WHERE slug = ?').get(req.params.slug);
  if (!b) return res.status(404).json({ error: 'No business found for this link' });
  res.json({ bizName: b.biz_name, slug: b.slug, question: b.question });
});

// GET /api/public/:slug/testimonials - only approved ones (used by the embed widget)
router.get('/public/:slug/testimonials', (req, res) => {
  const b = db.prepare('SELECT id FROM businesses WHERE slug = ?').get(req.params.slug);
  if (!b) return res.status(404).json({ error: 'No business found for this link' });

  const rows = db.prepare(
    'SELECT name, role, quote, rating FROM testimonials WHERE business_id = ? AND approved = 1 ORDER BY created_at DESC'
  ).all(b.id);
  res.json(rows);
});

// POST /api/public/:slug/testimonials - a customer submits a testimonial
router.post('/public/:slug/testimonials', (req, res) => {
  const b = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(req.params.slug);
  if (!b) return res.status(404).json({ error: 'No business found for this link' });

  const { name, role, quote, rating } = req.body;
  if (!name || !quote) {
    return res.status(400).json({ error: 'name and quote are required' });
  }

  if (b.plan === 'free') {
    const count = db.prepare('SELECT COUNT(*) AS c FROM testimonials WHERE business_id = ?').get(b.id).c;
    if (count >= FREE_PLAN_LIMIT) {
      return res.status(403).json({ error: 'This business has reached its free plan limit' });
    }
  }

  const id = nanoid();
  db.prepare(`
    INSERT INTO testimonials (id, business_id, name, role, quote, rating, approved)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(id, b.id, name, role || null, quote, Math.min(5, Math.max(1, Number(rating) || 5)));

  res.status(201).json({ ok: true });
});

function formatTestimonial(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    quote: row.quote,
    rating: row.rating,
    approved: !!row.approved,
    createdAt: row.created_at
  };
}

module.exports = router;
