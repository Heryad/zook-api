import { Router } from 'express';
import { BannerController } from '../controllers/banner.controller';
import { authMiddleware, roleGuard } from '../middleware/auth.middleware';
import { AdminRole } from '../types/admin.types';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);

// Banner management routes
router.get(
  '/list',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
  BannerController.getBanners
);

router.post(
  '/create',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  BannerController.createBanner
);

router.put(
  '/:id',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  BannerController.updateBanner
);

router.delete(
  '/:id',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  BannerController.deleteBanner
);

router.put(
  '/:id/position',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  BannerController.updatePosition
);

export default router; 