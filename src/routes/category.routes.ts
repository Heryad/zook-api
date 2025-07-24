import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller';
import { authMiddleware, roleGuard } from '../middleware/auth.middleware';
import { AdminRole } from '../types/admin.types';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);

// Category management routes
router.get(
  '/list',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
  CategoryController.getCategories
);

router.post(
  '/create',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  CategoryController.createCategory
);

router.put(
  '/:id',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  CategoryController.updateCategory
);

router.delete(
  '/:id',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  CategoryController.deleteCategory
);

router.put(
  '/:id/position',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  CategoryController.updatePosition
);

export default router; 