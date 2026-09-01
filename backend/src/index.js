// Express app entry. The skeleton is intentionally minimal in milestone 1;
// routes are added in subsequent milestones.
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

// TODO: mount route modules here in subsequent milestones
// app.use('/api/auth', require('./routes/auth'));
// app.use('/api/menu', require('./routes/menu'));
// app.use('/api/orders', require('./routes/orders'));
// app.use('/api/alerts', require('./routes/alerts'));
// app.use('/api/dashboard', require('./routes/dashboard'));
// app.use('/api/export', require('./routes/export'));

// Global error handler — catches AppError thrown by route handlers
// (added in milestone 2 alongside auth).
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.code || 'INTERNAL_ERROR',
    message: err.message || 'An unexpected error occurred',
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;
