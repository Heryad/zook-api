import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ResponseHandler } from '../utils/responseHandler';
import { AdminRole } from '../types/admin.types';
import logger from '../utils/logger';

// Extend Express Request type to include admin info
declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: string;
        role: AdminRole;
        country_id?: string;
        city_id?: string;
      };
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return ResponseHandler.error(res, 401, 'Authentication required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as {
      id: string;
      role: AdminRole;
      country_id?: string;
      city_id?: string;
    };

    req.admin = decoded;
    next();
  } catch (error) {
    logger.error('Authentication failed:', error);
    return ResponseHandler.error(res, 401, 'Invalid or expired token');
  }
};

export const roleGuard = (allowedRoles: AdminRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return ResponseHandler.error(res, 401, 'Authentication required');
    }

    if (!allowedRoles.includes(req.admin.role)) {
      return ResponseHandler.error(res, 403, 'Insufficient permissions');
    }

    next();
  };
}; 