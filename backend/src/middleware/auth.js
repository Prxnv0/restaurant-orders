// Authentication middleware.
// Verifies the JWT cookie and attaches the decoded user payload to req.user.
// Throws 401 if the cookie is missing or the token is invalid/expired.
const jwt = require('jsonwebtoken');
const AppError = require('../utils/errors');

const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return next(AppError.UNAUTHORIZED('Authentication required'));
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.sub,
      role: payload.role,
      name: payload.name,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(AppError.UNAUTHORIZED('Session expired. Please log in again.'));
    }
    return next(AppError.UNAUTHORIZED('Invalid or tampered token'));
  }
}

module.exports = authMiddleware;