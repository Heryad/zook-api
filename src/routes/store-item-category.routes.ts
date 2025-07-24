import { Router } from 'express';
import { StoreItemCategoryController } from '../controllers/store-item-category.controller';
import { authMiddleware, roleGuard } from '../middleware/auth.middleware';
import { AdminRole } from '../types/admin.types';

const router = Router();

// Public routes
router.get('/list', StoreItemCategoryController.getCategories);

// Protected routes (admin only)
router.post(
    '/create',
    authMiddleware,
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
    StoreItemCategoryController.createCategory
);

router.put(
    '/:id',
    authMiddleware,
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
    StoreItemCategoryController.updateCategory
);

router.delete(
    '/:id',
    authMiddleware,
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
    StoreItemCategoryController.deleteCategory
);

export default router; 