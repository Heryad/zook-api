import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import logger from './utils/logger';
import { ResponseHandler } from './utils/responseHandler';
import { HealthCheck } from './utils/healthCheck';
import adminRoutes from './routes/admin.routes';
import countryRoutes from './routes/country.routes';
import cityRoutes from './routes/city.routes';
import paymentOptionRoutes from './routes/payment-option.routes';
import promoCodeRoutes from './routes/promo-code.routes';
import mediaRoutes from './routes/media.routes';
import categoryRoutes from './routes/category.routes';
import bannerRoutes from './routes/banner.routes';
import ratingRoutes from './routes/rating.routes';
import supportRoutes from './routes/support.routes';
import storeRoutes from './routes/store.routes';
import storeItemCategoryRoutes from './routes/store-item-category.routes';
import orderRoutes from './routes/order.routes';

dotenv.config();

const app = express();

// API Configuration
const API_PREFIX = process.env.API_PREFIX || '/api';
const API_VERSION = process.env.API_VERSION || 'v1';
const BASE_PATH = `${API_PREFIX}/${API_VERSION}`;

// Security Middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Rate Limiting
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000
});
app.use(limiter);

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Routes
app.use(`${BASE_PATH}/admin`, adminRoutes); 
app.use(`${BASE_PATH}/admin/countries`, countryRoutes);
app.use(`${BASE_PATH}/admin/cities`, cityRoutes);
app.use(`${BASE_PATH}/admin/payment-options`, paymentOptionRoutes);
app.use(`${BASE_PATH}/admin/promo-codes`, promoCodeRoutes);
app.use(`${BASE_PATH}/admin/media`, mediaRoutes);
app.use(`${BASE_PATH}/admin/categories`, categoryRoutes);
app.use(`${BASE_PATH}/admin/banners`, bannerRoutes);
app.use(`${BASE_PATH}/ratings`, ratingRoutes);  // Public ratings endpoint
app.use(`${BASE_PATH}/support`, supportRoutes); // Support system endpoints
app.use(`${BASE_PATH}/stores`, storeRoutes);   // Store management endpoints
app.use(`${BASE_PATH}/stores/:store_id/categories`, storeItemCategoryRoutes); // Store categories
app.use(`${BASE_PATH}/orders`, orderRoutes);   // Order management endpoints

// Base route for API health check
app.get(`${BASE_PATH}/health`, async (req, res) => {
  try {
    const healthStatus = await HealthCheck.getStatus();
    ResponseHandler.success(res, 200, `API ${healthStatus.status}`, healthStatus);
  } catch (error) {
    logger.error('Health check failed:', error);
    ResponseHandler.error(res, 500, 'Failed to get API health status');
  }
});

// Error Handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err.stack);
  ResponseHandler.error(res, 500, 'Internal server error');
});

// 404 Handler
app.use((req: express.Request, res: express.Response) => {
  ResponseHandler.error(res, 404, 'Route not found');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`API Base Path: ${BASE_PATH}`);
});

export default app; 