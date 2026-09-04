// Express app entry. Routes are mounted here.
// Milestone 2: auth middleware and auth routes are now active.
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const app = express();

// Security and parsing middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true, // JWT lives in an httpOnly cookie
  })
);
app.use(express.json());
app.use(cookieParser());

// Health check — used by Render to confirm the process is up
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── Mount routes ────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));

app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/export', require('./routes/export'));

// Global error handler — catches AppError thrown by route handlers
const AppError = require('./utils/errors');
app.use((err, _req, res, _next) => {
  if (err instanceof AppError) {
    const body = { error: err.code, message: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
});

const PORT = process.env.PORT || 4000;

// Only start listening when this file is the entry point (node src/index.js).
// When required by tests (supertest), the app object is used directly without
// binding to a port — this prevents EADDRINUSE on subsequent requires.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;