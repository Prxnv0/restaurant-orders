// Authorization middleware.
// Enforces role-based access (manager / waiter) at the route level.
//
// Usage:
//   router.post('/menu', auth, requireRole('MANAGER'), controller.create);
//
// This is the application-layer enforcement of the server-side authorization
// requirement in README goal 1 ("enforced on the server, not just hidden").
const AppError = require('../utils/errors');

function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(AppError.UNAUTHORIZED('Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.FORBIDDEN(
          `Only ${allowedRoles.join(' or ')} can perform this action`
        )
      );
    }
    next();
  };
}

module.exports = requireRole;