import { Router } from 'express';
import { CountryController } from '../controllers/country.controller';
import { authMiddleware, roleGuard } from '../middleware/auth.middleware';
import { AdminRole } from '../types/admin.types';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);

// Country management routes
router.get(
  '/list',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
  CountryController.getCountries
);

router.get(
  '/:id',
  roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATOR]),
  CountryController.getCountryDetails
);

router.post(
  '/create',
  roleGuard([AdminRole.SUPER_ADMIN]),
  CountryController.createCountry
);

router.put(
  '/:id',
  roleGuard([AdminRole.SUPER_ADMIN]),
  CountryController.updateCountry
);

router.delete(
  '/:id',
  roleGuard([AdminRole.SUPER_ADMIN]),
  CountryController.deleteCountry
);

export default router; 