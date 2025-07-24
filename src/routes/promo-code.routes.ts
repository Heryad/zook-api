import { Router } from 'express';
import { PromoCodeController } from '../controllers/promo-code.controller';
import { authMiddleware, roleGuard } from '../middleware/auth.middleware';
import { AdminRole } from '../types/admin.types';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);

// Promo code management routes
router.get(
  '/list',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
  PromoCodeController.getPromoCodes
);

router.post(
  '/create',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  PromoCodeController.createPromoCode
);

router.put(
  '/:id',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  PromoCodeController.updatePromoCode
);

router.delete(
  '/:id',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  PromoCodeController.deletePromoCode
);

export default router; 