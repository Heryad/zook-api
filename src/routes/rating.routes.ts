import { Router } from 'express';
import { RatingController } from '../controllers/rating.controller';
import { authMiddleware, roleGuard } from '../middleware/auth.middleware';
import { AdminRole } from '../types/admin.types';

const router = Router();

// Public routes (no auth required)
router.get('/list', RatingController.getRatings);

// Protected routes (auth required)
router.post(
    '/create',
    authMiddleware,
    RatingController.createRating
);

router.put(
    '/:id',
    authMiddleware,
    RatingController.updateRating
);

// Admin-only routes
router.put(
    '/:id/moderate',
    authMiddleware,
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
    RatingController.moderateRating
);

router.delete(
    '/:id',
    authMiddleware,
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
    RatingController.deleteRating
);

export default router; 