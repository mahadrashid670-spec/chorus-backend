require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const businessRoutes = require('./routes/business');
const testimonialRoutes = require('./routes/testimonials');
const embedRoutes = require('./routes/embed');
const billingRoutes = require('./routes/billing');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/me', businessRoutes);
app.use('/api', testimonialRoutes); // exposes /api/me/testimonials/* and /api/public/*
app.use('/embed', embedRoutes);
app.use('/api/billing', billingRoutes);

// Serves public/index.html (the Chorus app) at the root URL, and any other
// static assets placed in /public.
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Chorus API listening on port ${PORT}`);
});
