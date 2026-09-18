const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');
const db = require('../db');

const router = express.Router();

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'business';
}

function makeUniqueSlug(bizName) {
  const base = slugify(bizName);
  let slug = base;
  let i = 1;
  const exists = db.prepare('SELECT id FROM businesses WHERE slug = ?');
  while (exists.get(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

function signToken(businessId) {
  return jwt.sign({ businessId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { email, password, bizName } = req.body;

  if (!email || !password || !bizName) {
    return res.status(400).json({ error: 'email, password and bizName are all required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = db.prepare('SELECT id FROM businesses WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const id = nanoid();
  const slug = makeUniqueSlug(bizName);
  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO businesses (id, email, password_hash, biz_name, slug)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, email.toLowerCase(), passwordHash, bizName, slug);

  const token = signToken(id);
  res.status(201).json({
    token,
    business: { id, email: email.toLowerCase(), bizName, slug, plan: 'free', question: 'How was your experience with us?' }
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const business = db.prepare('SELECT * FROM businesses WHERE email = ?').get(email.toLowerCase());
  if (!business || !bcrypt.compareSync(password, business.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }

  const token = signToken(business.id);
  res.json({
    token,
    business: {
      id: business.id,
      email: business.email,
      bizName: business.biz_name,
      slug: business.slug,
      plan: business.plan,
      question: business.question
    }
  });
});

module.exports = router;
