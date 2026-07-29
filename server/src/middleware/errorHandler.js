import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  const statusCode = err.isOperational ? err.statusCode : 500;
  const message = err.isOperational ? err.message : 'Internal server error';

  if (!err.isOperational) {
    logger.error('Unhandled error', { message: err.message, stack: err.stack, path: req.originalUrl });
  }

  res.status(statusCode).json({ success: false, message });
}
