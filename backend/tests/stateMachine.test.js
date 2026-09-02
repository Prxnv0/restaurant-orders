// M5 state machine tests.
// Exercises the legal transition map in src/stateMachine.js.
// These confirm the rules the README explicitly requires:
//   - PLACED -> ACCEPTED, CANCELLED
//   - ACCEPTED -> PREPARING, CANCELLED
//   - PREPARING -> READY  (cannot cancel once preparing)
//   - READY -> SERVED
//   - SERVED, CANCELLED are terminal
//   - All other moves are rejected with INVALID_TRANSITION
//   - Reason in the thrown error describes what went wrong
import { describe, it, expect } from 'vitest';
const {
  VALID_TRANSITIONS,
  ALL_STATUSES,
  validNextStatuses,
  canTransition,
  assertValidTransition,
} = require('../src/stateMachine');

describe('VALID_TRANSITIONS map', () => {
  it('PLACED can move to ACCEPTED or CANCELLED', () => {
    expect(VALID_TRANSITIONS.PLACED).toEqual(['ACCEPTED', 'CANCELLED']);
  });

  it('ACCEPTED can move to PREPARING or CANCELLED', () => {
    expect(VALID_TRANSITIONS.ACCEPTED).toEqual(['PREPARING', 'CANCELLED']);
  });

  it('PREPARING can only move to READY', () => {
    expect(VALID_TRANSITIONS.PREPARING).toEqual(['READY']);
  });

  it('READY can only move to SERVED', () => {
    expect(VALID_TRANSITIONS.READY).toEqual(['SERVED']);
  });

  it('SERVED is terminal', () => {
    expect(VALID_TRANSITIONS.SERVED).toEqual([]);
  });

  it('CANCELLED is terminal', () => {
    expect(VALID_TRANSITIONS.CANCELLED).toEqual([]);
  });
});

describe('validNextStatuses', () => {
  it('returns the legal next statuses for a known current status', () => {
    expect(validNextStatuses('PLACED')).toEqual(['ACCEPTED', 'CANCELLED']);
  });

  it('returns empty array for terminal status', () => {
    expect(validNextStatuses('SERVED')).toEqual([]);
  });

  it('returns empty array for unknown status', () => {
    expect(validNextStatuses('UNKNOWN')).toEqual([]);
  });
});

describe('canTransition', () => {
  it('returns true for legal forward moves', () => {
    expect(canTransition('PLACED', 'ACCEPTED')).toBe(true);
    expect(canTransition('ACCEPTED', 'PREPARING')).toBe(true);
    expect(canTransition('PREPARING', 'READY')).toBe(true);
    expect(canTransition('READY', 'SERVED')).toBe(true);
  });

  it('returns true for legal cancellation moves', () => {
    expect(canTransition('PLACED', 'CANCELLED')).toBe(true);
    expect(canTransition('ACCEPTED', 'CANCELLED')).toBe(true);
  });

  it('returns false for skipping states', () => {
    expect(canTransition('PLACED', 'PREPARING')).toBe(false);
    expect(canTransition('PLACED', 'READY')).toBe(false);
    expect(canTransition('PLACED', 'SERVED')).toBe(false);
    expect(canTransition('ACCEPTED', 'READY')).toBe(false);
    expect(canTransition('ACCEPTED', 'SERVED')).toBe(false);
    expect(canTransition('PREPARING', 'SERVED')).toBe(false);
  });

  it('returns false for backward moves', () => {
    expect(canTransition('ACCEPTED', 'PLACED')).toBe(false);
    expect(canTransition('PREPARING', 'ACCEPTED')).toBe(false);
    expect(canTransition('PREPARING', 'PLACED')).toBe(false);
    expect(canTransition('READY', 'PREPARING')).toBe(false);
    expect(canTransition('SERVED', 'READY')).toBe(false);
  });

  it('returns false for cancellation after PREPARING', () => {
    expect(canTransition('PREPARING', 'CANCELLED')).toBe(false);
    expect(canTransition('READY', 'CANCELLED')).toBe(false);
    expect(canTransition('SERVED', 'CANCELLED')).toBe(false);
  });

  it('returns false from terminal statuses', () => {
    expect(canTransition('SERVED', 'PLACED')).toBe(false);
    expect(canTransition('SERVED', 'ACCEPTED')).toBe(false);
    expect(canTransition('CANCELLED', 'PLACED')).toBe(false);
    expect(canTransition('CANCELLED', 'ACCEPTED')).toBe(false);
  });

  it('returns false for self-transitions (handled by assertValidTransition separately)', () => {
    // canTransition allows them but assertValidTransition rejects
    expect(canTransition('PLACED', 'PLACED')).toBe(false);
  });

  it('returns false for unknown statuses', () => {
    expect(canTransition('UNKNOWN', 'ACCEPTED')).toBe(false);
    expect(canTransition('PLACED', 'UNKNOWN')).toBe(false);
  });
});

describe('assertValidTransition — happy path', () => {
  it('returns silently for legal forward moves', () => {
    expect(() => assertValidTransition('PLACED', 'ACCEPTED')).not.toThrow();
    expect(() => assertValidTransition('ACCEPTED', 'PREPARING')).not.toThrow();
    expect(() => assertValidTransition('PREPARING', 'READY')).not.toThrow();
    expect(() => assertValidTransition('READY', 'SERVED')).not.toThrow();
  });

  it('returns silently for legal cancellation moves', () => {
    expect(() => assertValidTransition('PLACED', 'CANCELLED')).not.toThrow();
    expect(() => assertValidTransition('ACCEPTED', 'CANCELLED')).not.toThrow();
  });
});

describe('assertValidTransition — illegal transitions throw AppError 409', () => {
  it('rejects skip from PLACED to PREPARING', () => {
    try {
      assertValidTransition('PLACED', 'PREPARING');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.code).toBe('CONFLICT');
      expect(err.details.code).toBe('INVALID_TRANSITION');
      expect(err.details.current_status).toBe('PLACED');
      expect(err.details.attempted_status).toBe('PREPARING');
      expect(err.details.valid_next_statuses).toEqual(['ACCEPTED', 'CANCELLED']);
    }
  });

  it('rejects skip from PLACED to READY', () => {
    try {
      assertValidTransition('PLACED', 'READY');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.details.reason).toBe('skip_states');
    }
  });

  it('rejects skip from PLACED to SERVED', () => {
    try {
      assertValidTransition('PLACED', 'SERVED');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.details.reason).toBe('skip_states');
    }
  });

  it('rejects skip from ACCEPTED to READY', () => {
    try {
      assertValidTransition('ACCEPTED', 'READY');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.details.reason).toBe('skip_states');
    }
  });

  it('rejects skip from ACCEPTED to SERVED', () => {
    try {
      assertValidTransition('ACCEPTED', 'SERVED');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.details.reason).toBe('skip_states');
    }
  });

  it('rejects skip from PREPARING to SERVED', () => {
    try {
      assertValidTransition('PREPARING', 'SERVED');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.details.reason).toBe('skip_states');
    }
  });

  it('rejects backward move from ACCEPTED to PLACED', () => {
    try {
      assertValidTransition('ACCEPTED', 'PLACED');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.details.reason).toBe('backward_transition');
    }
  });

  it('rejects backward move from PREPARING to ACCEPTED', () => {
    try {
      assertValidTransition('PREPARING', 'ACCEPTED');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.details.reason).toBe('backward_transition');
    }
  });

  it('rejects backward move from READY to PREPARING', () => {
    try {
      assertValidTransition('READY', 'PREPARING');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.details.reason).toBe('backward_transition');
    }
  });

  it('rejects backward move from SERVED to READY (SERVED is terminal)', () => {
    try {
      assertValidTransition('SERVED', 'READY');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
      // SERVED is terminal — terminal_status reason takes precedence over backward_transition
      expect(err.details.reason).toBe('terminal_status');
    }
  });

  it('rejects cancellation after PREPARING with cancel_too_late reason', () => {
    try {
      assertValidTransition('PREPARING', 'CANCELLED');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.details.reason).toBe('cancel_too_late');
      expect(err.message).toMatch(/cancel/i);
    }
  });

  it('rejects cancellation from READY with cancel_too_late reason', () => {
    try {
      assertValidTransition('READY', 'CANCELLED');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.details.reason).toBe('cancel_too_late');
    }
  });

  it('rejects all moves from SERVED (terminal)', () => {
    try {
      assertValidTransition('SERVED', 'PLACED');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.details.reason).toBe('terminal_status');
    }
  });

  it('rejects all moves from CANCELLED (terminal)', () => {
    try {
      assertValidTransition('CANCELLED', 'ACCEPTED');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.details.reason).toBe('terminal_status');
    }
  });

  it('rejects self-transition (no-op)', () => {
    try {
      assertValidTransition('PLACED', 'PLACED');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.details.reason).toBe('no_op');
    }
  });

  it('rejects unknown current status', () => {
    try {
      assertValidTransition('UNKNOWN', 'ACCEPTED');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
    }
  });

  it('rejects unknown attempted status', () => {
    try {
      assertValidTransition('PLACED', 'UNKNOWN');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(409);
    }
  });
});

describe('assertValidTransition — error message is human-readable', () => {
  it('cancelling a PREPARING order mentions the blocking status', () => {
    try {
      assertValidTransition('PREPARING', 'CANCELLED');
    } catch (err) {
      expect(err.message).toMatch(/Cannot cancel/);
      expect(err.message).toMatch(/PREPARING/);
    }
  });

  it('skipping states explains the lifecycle', () => {
    try {
      assertValidTransition('PLACED', 'READY');
    } catch (err) {
      expect(err.message).toMatch(/step-by-step|skip|lifecycle/i);
    }
  });

  it('terminal status error mentions terminal', () => {
    try {
      assertValidTransition('SERVED', 'ACCEPTED');
    } catch (err) {
      expect(err.message).toMatch(/terminal/);
    }
  });
});

describe('ALL_STATUSES', () => {
  it('contains every OrderStatus', () => {
    expect(ALL_STATUSES).toEqual([
      'PLACED',
      'ACCEPTED',
      'PREPARING',
      'READY',
      'SERVED',
      'CANCELLED',
    ]);
  });
});
