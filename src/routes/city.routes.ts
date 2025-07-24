import { Router } from 'express';
import { CityController } from '../controllers/city.controller';
import { authMiddleware, roleGuard } from '../middleware/auth.middleware';
import { AdminRole } from '../types/admin.types';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);

// City management routes
router.get(
  '/list',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
  CityController.getCities
);

router.post(
  '/create',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  CityController.createCity
);

router.put(
  '/:id',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  CityController.updateCity
);

router.delete(
  '/:id',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  CityController.deleteCity
);

// Zone management routes
router.get(
  '/:cityId/zones',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
  CityController.getZones
);

router.post(
  '/:cityId/zones',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  CityController.addZone
);

router.put(
  '/:cityId/zones/:zoneId',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  CityController.updateZone
);

router.delete(
  '/:cityId/zones/:zoneId',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
  CityController.deleteZone
);

export default router; 