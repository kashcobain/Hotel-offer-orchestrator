import express, { Request, Response, NextFunction } from 'express';
import { hotelsRouter } from './routes/hotels';
import { healthRouter } from './routes/health';
import { supplierARouter, supplierBRouter, adminRouter } from './suppliers/router';
import { logger } from './logger';

export const app = express();

app.use(express.json());

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Main aggregation API
app.use('/api/hotels', hotelsRouter);

// Health check (both suppliers + Redis)
app.use('/health', healthRouter);

// Mock supplier APIs
app.use('/supplierA', supplierARouter);
app.use('/supplierB', supplierBRouter);

// Test helper: simulate a supplier outage without restarting the service
app.use('/admin', adminRouter);

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Hotel Offer Orchestrator',
    endpoints: [
      'GET /api/hotels?city=delhi',
      'GET /api/hotels?city=delhi&minPrice=3000&maxPrice=12000',
      'GET /supplierA/hotels?city=delhi',
      'GET /supplierB/hotels?city=delhi',
      'GET /health',
      'POST /admin/supplier/A/toggle { "down": true }',
    ],
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
});

// Centralized error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err.stack || err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});
