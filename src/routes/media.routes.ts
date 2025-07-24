import { Router } from 'express';
import { MediaController } from '../controllers/media.controller';
import { authMiddleware, roleGuard } from '../middleware/auth.middleware';
import { AdminRole } from '../types/admin.types';
import MediaService from '../services/media.service';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);

// Media management routes
router.get(
  '/list',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
  MediaController.getMedia
);

router.post(
  '/upload',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  MediaService.upload.single('file'),  // 'file' is the field name in form data
  MediaController.uploadMedia
);

router.put(
  '/:id',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  MediaController.updateMedia
);

router.delete(
  '/:id',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  MediaController.deleteMedia
);

export default router; 