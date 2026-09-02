// Order state machine.
//
// Encodes the legal status transitions for an order. This is the single
// source of truth for which moves are allowed; every endpoint that
// mutates `Order.status` goes through `assertValidTransition`.
//
// Transitions (per README Goal 4):
//   PLACED     -> ACCEPTED, CANCELLED
//   ACCEPTED   -> PREPARING, CANCELLED
//   PREPARING  -> READY                       (cannot cancel once preparing)
//   READY      -> SERVED
//   SERVED     -> (terminal)
//   CANCELLED  -> (terminal)
//
// CANCELLED is reachable only from PLACED or ACCEPTED.
// All other moves (skipping states, going backwards, post-terminal) are
// rejected with INVALID_TRANSITION.
const AppError = require('./utils/errors');

const VALID_TRANSITIONS = {
  PLACED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['SERVED'],
  SERVED: [],
  CANCELLED: [],
};

const ALL_STATUSES = Object.keys(VALID_TRANSITIONS);

/**
 * Returns the list of valid next statuses for the given current status.
 *
 * @param {string} currentStatus
 * @returns {string[]}
 */
function validNextStatuses(currentStatus) {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Returns true if the transition from -> to is allowed.
 *
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
function canTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Throws an AppError 409 INVALID_TRANSITION if the transition is not
 * allowed. Otherwise returns silently.
 *
 * The thrown error includes:
 *   - `code`: 'INVALID_TRANSITION'
 *   - `details`: { current_status, attempted_status, valid_next_statuses, reason }
 *   - `message`: a human-readable explanation
 *
 * @param {string} from
 * @param {string} to
 * @throws {AppError}
 */
function assertValidTransition(from, to) {
  if (!VALID_TRANSITIONS.hasOwnProperty(from)) {
    throw AppError.CONFLICT(
      `Current status "${from}" is not a known order status`
    ).withDetails({ code: 'INVALID_TRANSITION', current_status: from, attempted_status: to });
  }

  if (!ALL_STATUSES.includes(to)) {
    throw AppError.CONFLICT(
      `Attempted status "${to}" is not a known order status`
    ).withDetails({ code: 'INVALID_TRANSITION', current_status: from, attempted_status: to });
  }

  if (from === to) {
    throw AppError.CONFLICT(
      `Order is already in status ${from}`
    ).withDetails({
      code: 'INVALID_TRANSITION',
      current_status: from,
      attempted_status: to,
      valid_next_statuses: validNextStatuses(from),
      reason: 'no_op',
    });
  }

  if (canTransition(from, to)) {
    return; // legal
  }

  // Build a human message naming the rule that was violated
  let reason = 'illegal_transition';
  let humanMessage = `Cannot move order from ${from} to ${to}`;

  if (to === 'CANCELLED' && !['PLACED', 'ACCEPTED'].includes(from)) {
    reason = 'cancel_too_late';
    humanMessage = `Cannot cancel an order in status ${from}; cancellation is only allowed while Placed or Accepted`;
  } else if (['SERVED', 'CANCELLED'].includes(from)) {
    reason = 'terminal_status';
    humanMessage = `Order is in terminal status ${from} and cannot be changed`;
  } else if (
    (from === 'PLACED' && to === 'PREPARING') ||
    (from === 'PLACED' && to === 'READY') ||
    (from === 'PLACED' && to === 'SERVED') ||
    (from === 'ACCEPTED' && to === 'READY') ||
    (from === 'ACCEPTED' && to === 'SERVED') ||
    (from === 'PREPARING' && to === 'SERVED')
  ) {
    reason = 'skip_states';
    humanMessage = `Cannot skip from ${from} to ${to}; follow the lifecycle step-by-step`;
  } else if (
    (from === 'ACCEPTED' && to === 'PLACED') ||
    (from === 'PREPARING' && to === 'ACCEPTED') ||
    (from === 'READY' && to === 'PREPARING') ||
    (from === 'SERVED' && to === 'READY')
  ) {
    reason = 'backward_transition';
    humanMessage = `Cannot move order backward from ${from} to ${to}`;
  }

  const err = AppError.CONFLICT(humanMessage);
  err.withDetails({
    code: 'INVALID_TRANSITION',
    current_status: from,
    attempted_status: to,
    valid_next_statuses: validNextStatuses(from),
    reason,
  });
  throw err;
}

module.exports = {
  VALID_TRANSITIONS,
  ALL_STATUSES,
  validNextStatuses,
  canTransition,
  assertValidTransition,
};
