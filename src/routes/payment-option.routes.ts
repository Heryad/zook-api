import { Router } from 'express';
import { PaymentOptionController } from '../controllers/payment-option.controller';
import { authMiddleware, roleGuard } from '../middleware/auth.middleware';
import { AdminRole } from '../types/admin.types';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);

// Payment option management routes
router.get(
  '/list',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
  PaymentOptionController.getPaymentOptions
);

router.post(
  '/create',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  PaymentOptionController.createPaymentOption
);

router.put(
  '/:id',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  PaymentOptionController.updatePaymentOption
);

router.delete(
  '/:id',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  PaymentOptionController.deletePaymentOption
);

router.put(
  '/:id/position',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  PaymentOptionController.updatePosition
);

export default router; 