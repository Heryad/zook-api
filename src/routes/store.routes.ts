import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.middleware';
import { StoreController } from '../controllers/store.controller';
import { AdminRole } from '../types/admin.types';

const router = Router();

// Public routes
router.get('/list', StoreController.getStores);
router.get('/:id', StoreController.getStoreById);

// Protected routes - require admin authentication
router.use(authMiddleware);

// Store management routes
router.post(
    '/create',
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
    StoreController.createStore
);

router.put(
    '/:id',
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
    StoreController.updateStore
);

router.delete(
    '/:id',
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
    StoreController.deleteStore
);

router.patch(
    '/:id/toggle-busy',
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
    StoreController.toggleBusyStatus
);

router.patch(
    '/:id/toggle-active',
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
    StoreController.toggleActiveStatus
);

export default router; 