import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.middleware';
import { OrderController } from '../controllers/order.controller';
import { AdminRole } from '../types/admin.types';

const router = Router();

// Public routes
router.get('/list', OrderController.getOrders);
router.get('/:id', OrderController.getOrderById);
router.post('/create', OrderController.createOrder);

// Protected routes - require admin authentication
router.use(authMiddleware);

// Order management routes
router.put(
    '/:id',
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
    OrderController.updateOrder
);

router.patch(
    '/:id/assign-driver',
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
    OrderController.assignDriver
);

router.patch(
    '/:id/update-status',
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
    OrderController.updateOrderStatus
);

router.patch(
    '/:id/update-payment',
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
    OrderController.updatePaymentStatus
);

router.delete(
    '/:id',
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
    OrderController.deleteOrder
);

export default router; 