const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/me - current logged-in business's own info
router.get('/', requireAuth, (req, res) => {
  const b = db.prepare('SELECT id, email, biz_name, slug, question, plan FROM businesses WHERE id = ?').get(req.businessId);
  if (!b) return res.status(404).json({ error: 'Business not found' });
  res.json({
    id: b.id, email: b.email, bizName: b.biz_name, slug: b.slug, question: b.question, plan: b.plan
  });
});

// PATCH /api/me - update business name / question asked on the form
router.patch('/', requireAuth, (req, res) => {
  const { bizName, question } = req.body;
  const current = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.businessId);
  if (!current) return res.status(404).json({ error: 'Business not found' });

  db.prepare('UPDATE businesses SET biz_name = ?, question = ? WHERE id = ?').run(
    bizName || current.biz_name,
    question || current.question,
    req.businessId
  );

  res.json({ ok: true });
});

module.exports = router;
