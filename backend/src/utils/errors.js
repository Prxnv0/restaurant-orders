// Custom error class for application-level errors.
// Carries an HTTP status code so the global error handler can map it
// to the right response. Used throughout the backend for authz,
// state-machine violations, and resource-not-found cases.
class AppError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status || 500;
    this.code = code || 'INTERNAL_ERROR';
    this.isOperational = true; // marks expected errors vs. bugs
  }
}

// Convenience constructors so call sites stay readable.
AppError.UNAUTHORIZED = (message) => new AppError(message || 'Unauthorized', 401, 'UNAUTHORIZED');
AppError.FORBIDDEN = (message) => new AppError(message || 'Forbidden', 403, 'FORBIDDEN');
AppError.NOT_FOUND = (resource) =>
  new AppError(`${resource || 'Resource'} not found`, 404, 'NOT_FOUND');
AppError.CONFLICT = (message) => new AppError(message || 'Conflict', 409, 'CONFLICT');
AppError.BAD_REQUEST = (message) => new AppError(message || 'Bad request', 400, 'BAD_REQUEST');

module.exports = AppError;