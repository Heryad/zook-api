import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.middleware';
import { StoreItemController } from '../controllers/store-item.controller';
import { AdminRole } from '../types/admin.types';

const router = Router();

// Public routes
router.get('/list', StoreItemController.getStoreItems);
router.get('/:id', StoreItemController.getStoreItemById);

// Protected routes - require admin authentication
router.use(authMiddleware);

// Store item management routes
router.post(
    '/create',
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
    StoreItemController.createStoreItem
);

router.put(
    '/:id',
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
    StoreItemController.updateStoreItem
);

router.delete(
    '/:id',
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
    StoreItemController.deleteStoreItem
);

router.patch(
    '/:id/toggle-active',
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
    StoreItemController.toggleActiveStatus
);

// Photo management routes
router.post(
    '/:id/photos',
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
    StoreItemController.addPhotos
);

router.put(
    '/:id/photos/:photoId',
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
    StoreItemController.updatePhotoPosition
);

router.delete(
    '/:id/photos/:photoId',
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
    StoreItemController.deletePhoto
);

export default router; 