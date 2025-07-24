import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authMiddleware, roleGuard } from '../middleware/auth.middleware';
import { AdminRole } from '../types/admin.types';

const router = Router();

// Auth routes
router.post('/login', AdminController.login);
router.get('/profile', authMiddleware, AdminController.getProfile);

// Admin management routes
router.get(
  '/list',
  authMiddleware,
  roleGuard([AdminRole.ADMIN]),
  AdminController.getAllAdmins
);

router.post(
  '/create',
  authMiddleware,
  roleGuard([AdminRole.ADMIN]),
  AdminController.createAdmin
);

router.put(
  '/:id',
  authMiddleware,
  roleGuard([AdminRole.ADMIN]),
  AdminController.updateAdmin
);

router.delete(
  '/:id',
  authMiddleware,
  roleGuard([AdminRole.ADMIN]),
  AdminController.deleteAdmin
);

export default router; 