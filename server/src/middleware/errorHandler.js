export function errorHandler(err, req, res, next) {
  const statusCode = err.isOperational ? err.statusCode : 500;
  const message = err.isOperational ? err.message : 'Internal server error';

  if (!err.isOperational) {
    console.error(err);
  }

  res.status(statusCode).json({ success: false, message });
}
