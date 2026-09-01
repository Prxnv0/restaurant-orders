// Resource-ownership check for order-scoped actions.
//
// A user may act on an order if they are:
//   - A MANAGER (always), or
//   - The PRIMARY WAITER of the order, or
//   - A COLLABORATOR on the order.
//
// This middleware runs AFTER `auth` middleware, so req.user is populated.
// It loads the order and either calls next() with req.order available,
// or throws 403 / 404.
//
// Usage:
//   router.get('/:id', auth, requireOrderAccess, controller.show);
const prisma = require('../db');
const AppError = require('../utils/errors');

/**
 * Returns Express middleware that verifies the requester has access to
 * the order identified by req.params[orderParam].
 *
 * @param {string} orderParam - the URL param holding the order id (default 'id')
 */
function requireOrderAccess(orderParam = 'id') {
  return async (req, res, next) => {
    const orderId = req.params[orderParam];

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        collaborators: {
          where: { waiterId: req.user.id },
        },
      },
      select: {
        id: true,
        tableNumber: true,
        status: true,
        primaryWaiterId: true,
        archivedAt: true,
        servedAt: true,
        createdAt: true,
        updatedAt: true,
        collaborators: true, // included above for access check
      },
    });

    if (!order) {
      return next(AppError.NOT_FOUND('Order'));
    }

    const isManager = req.user.role === 'MANAGER';
    const isPrimary = order.primaryWaiterId === req.user.id;
    const isCollaborator = order.collaborators.length > 0;

    if (!isManager && !isPrimary && !isCollaborator) {
      return next(
        AppError.FORBIDDEN('You do not have access to this order')
      );
    }

    // Attach a clean order object (without the Prisma internal collaborators array)
    req.order = {
      id: order.id,
      tableNumber: order.tableNumber,
      status: order.status,
      primaryWaiterId: order.primaryWaiterId,
      archivedAt: order.archivedAt,
      servedAt: order.servedAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };

    next();
  };
}

module.exports = requireOrderAccess;