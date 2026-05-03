import logger from '../../utils/logger.js';

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err.statusCode && err.statusCode < 500;
  const message = isOperational ? err.message : 'Internal Server Error';

  logger.error(err.name || 'Error', {
    statusCode,
    message: err.message,
    path: req.path,
    method: req.method,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
  });
};

export default errorHandler;
