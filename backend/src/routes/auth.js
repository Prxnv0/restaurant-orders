// Authentication routes.
//
// POST /api/auth/login   — validate credentials, issue JWT cookie
// POST /api/auth/logout  — clear the JWT cookie
// GET  /api/auth/me      — return the current user (from JWT)
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const prisma = require('../db');
const AppError = require('../utils/errors');
const auth = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

// Cookie options — httpOnly so the token can't be stolen by JS,
// SameSite=Lax so it survives top-level navigations (needed for the
// frontend → backend flow) while still blocking most CSRF.
function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  };
}

// ── Validation schemas ──────────────────────────────────────────────
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
});

// ── POST /api/auth/login ────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return next(AppError.BAD_REQUEST(error.details.map((d) => d.message).join('; ')));
    }

    const user = await prisma.user.findUnique({
      where: { email: value.email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
      },
    });

    if (!user) {
      // Use a generic message to avoid leaking whether an email is registered.
      return next(AppError.UNAUTHORIZED('Invalid email or password'));
    }

    const valid = await bcrypt.compare(value.password, user.passwordHash);
    if (!valid) {
      return next(AppError.UNAUTHORIZED('Invalid email or password'));
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.cookie('token', token, cookieOptions());

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/logout ───────────────────────────────────────────
router.post('/logout', (_req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
  res.json({ ok: true });
});

// ── GET /api/auth/me ────────────────────────────────────────────────
router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    if (!user) {
      return next(AppError.NOT_FOUND('User'));
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;