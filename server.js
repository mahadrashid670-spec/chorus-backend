require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const businessRoutes = require('./routes/business');
const testimonialRoutes = require('./routes/testimonials');
const embedRoutes = require('./routes/embed');
const billingRoutes = require('./routes/billing');

const app = express();

// Billing webhook needs the raw body for signature verification, so it must
// be mounted BEFORE express.json() touches the request.
app.use('/api/billing/webhook', express.raw({ type: '*/*' }));

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));
app.use(express.json());

app.get('/', (req, res) => res.send('Chorus API is running.'));

app.use('/api/auth', authRoutes);
app.use('/api/me', businessRoutes);
app.use('/api', testimonialRoutes); // exposes /api/me/testimonials/* and /api/public/*
app.use('/embed', embedRoutes);
app.use('/api/billing', billingRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Chorus API listening on port ${PORT}`);
});
